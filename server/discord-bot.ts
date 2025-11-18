import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, TextChannel } from 'discord.js';
import { storage } from './storage';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=discord',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Discord not connected');
  }
  return accessToken;
}

let client: Client | null = null;
let ticketCounter = 0;

export async function initializeDiscordBot() {
  try {
    const token = await getAccessToken();
    
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    client.on('ready', () => {
      console.log(`✅ Discord bot logged in as ${client?.user?.tag}`);
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;

      if (interaction.customId === 'create_ticket_general') {
        await handleTicketCreation(interaction, 'General Support');
      } else if (interaction.customId === 'create_ticket_bug') {
        await handleTicketCreation(interaction, 'Bug Report');
      } else if (interaction.customId === 'create_ticket_partnership') {
        await handleTicketCreation(interaction, 'Partnership Request');
      } else if (interaction.customId.startsWith('close_ticket_')) {
        await handleTicketClose(interaction);
      } else if (interaction.customId.startsWith('claim_ticket_')) {
        await handleTicketClaim(interaction);
      }
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (!message.channel.isThread() && message.channel.type !== ChannelType.GuildText) return;

      const channelName = (message.channel as TextChannel).name;
      if (channelName.startsWith('ticket-')) {
        const ticketNumber = channelName.replace('ticket-', '');
        const ticket = await storage.getTicketByNumber(ticketNumber);
        
        if (ticket) {
          await storage.createTicketMessage({
            ticketId: ticket.id,
            userId: message.author.id,
            username: message.author.username,
            content: message.content,
            messageId: message.id,
          });
        }
      }
    });

    await client.login(token);
    return client;
  } catch (error) {
    console.error('Failed to initialize Discord bot:', error);
    throw error;
  }
}

async function handleTicketCreation(interaction: any, category: string) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    ticketCounter++;
    const ticketNumber = `${ticketCounter.toString().padStart(4, '0')}`;
    const channelName = `ticket-${ticketNumber}`;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
    });

    const ticket = await storage.createTicket({
      ticketNumber,
      userId: interaction.user.id,
      username: interaction.user.username,
      channelId: channel.id,
      category,
      topic: category,
      status: 'open',
      claimedBy: null,
      claimedByUsername: null,
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket #${ticketNumber}`)
      .setDescription(`**Category:** ${category}\n**Created by:** <@${interaction.user.id}>\n\nA staff member will be with you shortly.`)
      .setColor(0x3dd9b3)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_ticket_${ticket.id}`)
          .setLabel('Claim Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✋'),
        new ButtonBuilder()
          .setCustomId(`close_ticket_${ticket.id}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

    await channel.send({ embeds: [embed], components: [row] });

    await storage.createTicketMessage({
      ticketId: ticket.id,
      userId: 'SYSTEM',
      username: 'System',
      content: `Ticket created by ${interaction.user.username} for ${category}`,
      messageId: null,
    });

    await interaction.editReply(`✅ Ticket created! Check <#${channel.id}>`);
  } catch (error) {
    console.error('Error creating ticket:', error);
    await interaction.editReply('❌ Failed to create ticket. Please try again.');
  }
}

async function handleTicketClaim(interaction: any) {
  try {
    const ticketId = interaction.customId.replace('claim_ticket_', '');
    const ticket = await storage.getTicketById(ticketId);

    if (!ticket) {
      await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
      return;
    }

    if (ticket.claimedBy) {
      await interaction.reply({ content: `❌ This ticket has already been claimed by ${ticket.claimedByUsername}.`, ephemeral: true });
      return;
    }

    await storage.updateTicket(ticketId, {
      claimedBy: interaction.user.id,
      claimedByUsername: interaction.user.username,
    });

    const embed = new EmbedBuilder()
      .setDescription(`✅ Ticket claimed by <@${interaction.user.id}>`)
      .setColor(0x3dd9b3)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await storage.createTicketMessage({
      ticketId,
      userId: 'SYSTEM',
      username: 'System',
      content: `Ticket claimed by ${interaction.user.username}`,
      messageId: null,
    });
  } catch (error) {
    console.error('Error claiming ticket:', error);
    await interaction.reply({ content: '❌ Failed to claim ticket.', ephemeral: true });
  }
}

async function handleTicketClose(interaction: any) {
  try {
    const ticketId = interaction.customId.replace('close_ticket_', '');
    const ticket = await storage.getTicketById(ticketId);

    if (!ticket) {
      await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
      return;
    }

    await storage.updateTicket(ticketId, {
      status: 'closed',
      closedAt: new Date(),
    });

    const embed = new EmbedBuilder()
      .setDescription(`🔒 Ticket closed by <@${interaction.user.id}>`)
      .setColor(0xed4245)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await storage.createTicketMessage({
      ticketId,
      userId: 'SYSTEM',
      username: 'System',
      content: `Ticket closed by ${interaction.user.username}`,
      messageId: null,
    });

    const channel = interaction.channel;
    if (channel) {
      setTimeout(async () => {
        await channel.delete();
      }, 5000);
    }
  } catch (error) {
    console.error('Error closing ticket:', error);
    await interaction.reply({ content: '❌ Failed to close ticket.', ephemeral: true });
  }
}

export async function sendTicketPanel(channelId: string) {
  if (!client) {
    throw new Error('Discord bot not initialized');
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('Invalid channel');
  }

  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticketing System')
    .setDescription('If you want to speak to a member of the team, please press the start button below.\n\n25/10/2025, 12:31')
    .setColor(0x5865f2)
    .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/hourglass-logo.png');

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket_general')
        .setLabel('General Support')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🎫'),
      new ButtonBuilder()
        .setCustomId('create_ticket_bug')
        .setLabel('Bug Report')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🐛'),
      new ButtonBuilder()
        .setCustomId('create_ticket_partnership')
        .setLabel('Partnership Request')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🤝')
    );

  await (channel as TextChannel).send({ embeds: [embed], components: [row] });
}

export function getDiscordClient() {
  return client;
}
