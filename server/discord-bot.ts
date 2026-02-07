import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, TextChannel, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { storage } from './storage';

let client: Client | null = null;
let ticketCounter = 0;

export async function initializeDiscordBot() {
  try {
    const token = process.env.DISCORD_BOT_TOKEN?.trim();
    
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN not found in environment variables');
    }
    
    console.log(`[Discord] Token length: ${token.length}, starts with: ${token.substring(0, 6)}...`);
    
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Error handling for the bot
    client.on('error', (error) => {
      console.error('❌ Discord bot error:', error);
    });

    client.on('warn', (warning) => {
      console.warn('⚠️ Discord bot warning:', warning);
    });

    client.on('disconnect', () => {
      console.log('⚠️ Discord bot disconnected');
    });

    client.on('reconnecting', () => {
      console.log('🔄 Discord bot reconnecting...');
    });

    client.on('ready', async () => {
      console.log(`✅ Discord bot logged in as ${client?.user?.tag}`);
      console.log(`✅ Bot is in ${client?.guilds.cache.size} server(s)`);
      
      // Load the highest ticket number from database
      try {
        const tickets = await storage.getTickets();
        if (tickets.length > 0) {
          const highestNumber = Math.max(...tickets.map(t => parseInt(t.ticketNumber)));
          ticketCounter = highestNumber;
          console.log(`✅ Loaded ticket counter: ${ticketCounter}`);
        }
      } catch (error) {
        console.error('Failed to load ticket counter:', error);
      }
      
      // Register slash commands per guild for instant availability
      if (client?.application) {
        const commands = [
          new SlashCommandBuilder()
            .setName('panel')
            .setDescription('Send the ticket panel to this channel')
            .toJSON(),
          new SlashCommandBuilder()
            .setName('verify')
            .setDescription('Send the verification panel to this channel')
            .toJSON()
        ];

        const rest = new REST({ version: '10' }).setToken(token);
        
        try {
          // Register globally
          await rest.put(
            Routes.applicationCommands(client.application.id),
            { body: commands }
          );
          console.log('✅ Global slash commands registered');

          // Also register per guild for instant availability
          for (const guild of client.guilds.cache.values()) {
            try {
              await rest.put(
                Routes.applicationGuildCommands(client.application.id, guild.id),
                { body: commands }
              );
              console.log(`✅ Slash commands registered for guild: ${guild.name} (${guild.id})`);
            } catch (guildError) {
              console.error(`Failed to register commands for guild ${guild.name}:`, guildError);
            }
          }
        } catch (error) {
          console.error('Failed to register slash commands:', error);
        }
      }
    });

    client.on('interactionCreate', async (interaction) => {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'panel') {
          try {
            await interaction.deferReply({ flags: 64 });
            await sendTicketPanel(interaction.channelId);
            await interaction.editReply({ content: '✅ Ticket panel sent!' });
          } catch (error) {
            console.error('Error sending panel:', error);
            try {
              if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Failed to send ticket panel.' });
              } else {
                await interaction.reply({ content: '❌ Failed to send ticket panel.', flags: 64 });
              }
            } catch (replyError) {
              console.error('Failed to send error response:', replyError);
            }
          }
        } else if (interaction.commandName === 'verify') {
          try {
            const serverName = interaction.guild?.name || 'Server';
            const appUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG + '.replit.app'}`;

            const embed = new EmbedBuilder()
              .setTitle('Verification required')
              .setDescription(`To gain access to **${serverName}** you need to prove you are a human by completing a captcha. Click the button below to get started!`)
              .setColor(0x111214)
              .setFooter({ text: `ONLY verify on ${appUrl}` });

            const row = new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('verify_start')
                  .setLabel('Verify')
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId('verify_why')
                  .setLabel('Why?')
                  .setStyle(ButtonStyle.Secondary)
              );

            await interaction.reply({ embeds: [embed], components: [row] });
          } catch (error) {
            console.error('Error sending verify panel:', error);
            try {
              if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: '❌ Failed to send verification panel.' });
              } else {
                await interaction.reply({ content: '❌ Failed to send verification panel.', flags: 64 });
              }
            } catch (replyError) {
              console.error('Failed to send error response:', replyError);
            }
          }
        }
        return;
      }

      // Handle button clicks
      if (!interaction.isButton()) return;

      if (interaction.customId === 'verify_start') {
        try {
          const appUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG + '.replit.app'}`;
          const clientId = process.env.DISCORD_CLIENT_ID;

          if (!clientId) {
            await interaction.reply({
              content: 'Verification is not configured yet. Please contact an administrator.',
              flags: 64
            });
            return;
          }

          const state = encodeURIComponent(JSON.stringify({
            guildId: interaction.guildId || '',
            userId: interaction.user.id,
          }));

          const redirectUri = encodeURIComponent(`${appUrl}/api/discord/callback`);
          const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`;

          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setLabel('Click here to verify')
                .setStyle(ButtonStyle.Link)
                .setURL(oauthUrl)
            );

          await interaction.reply({
            content: 'Click the link below to log in with Discord and complete your verification:',
            components: [row],
            flags: 64
          });
        } catch (err) {
          console.error('Error responding to verify button:', err);
        }
        return;
      }

      if (interaction.customId === 'verify_why') {
        try {
          await interaction.reply({
            content: 'This server uses wallet verification to prevent bots and ensure all members are real users. The verification process is quick and secure - just connect your wallet and sign a message to prove ownership.',
            flags: 64
          });
        } catch (err) {
          console.error('Error responding to why button:', err);
        }
        return;
      }

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
    await interaction.deferReply({ flags: 64 }); // 64 = ephemeral flag

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply({ content: 'This command can only be used in a server.' });
      return;
    }

    ticketCounter++;
    const ticketNumber = `${ticketCounter.toString().padStart(4, '0')}`;
    const channelName = `ticket-${ticketNumber}`;

    // Get the parent category from where the button was clicked
    const parentCategory = interaction.channel?.parent;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentCategory?.id || null, // Create under the same category
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
      .setColor(0x111214)
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

    await interaction.editReply({ content: `✅ Ticket created! Check <#${channel.id}>` });
  } catch (error) {
    console.error('Error creating ticket:', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Failed to create ticket. Please try again.' });
      } else {
        await interaction.reply({ content: '❌ Failed to create ticket. Please try again.', flags: 64 });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

async function handleTicketClaim(interaction: any) {
  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply();

    const ticketId = interaction.customId.replace('claim_ticket_', '');
    const ticket = await storage.getTicketById(ticketId);

    if (!ticket) {
      await interaction.editReply({ content: '❌ Ticket not found.' });
      return;
    }

    if (ticket.claimedBy) {
      await interaction.editReply({ content: `❌ This ticket has already been claimed by ${ticket.claimedByUsername}.` });
      return;
    }

    await storage.updateTicket(ticketId, {
      claimedBy: interaction.user.id,
      claimedByUsername: interaction.user.username,
    });

    const embed = new EmbedBuilder()
      .setDescription(`✅ Ticket claimed by <@${interaction.user.id}>`)
      .setColor(0x111214)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await storage.createTicketMessage({
      ticketId,
      userId: 'SYSTEM',
      username: 'System',
      content: `Ticket claimed by ${interaction.user.username}`,
      messageId: null,
    });
  } catch (error) {
    console.error('Error claiming ticket:', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Failed to claim ticket.' });
      } else {
        await interaction.reply({ content: '❌ Failed to claim ticket.', flags: 64 });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

async function handleTicketClose(interaction: any) {
  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply();

    const ticketId = interaction.customId.replace('close_ticket_', '');
    const ticket = await storage.getTicketById(ticketId);

    if (!ticket) {
      await interaction.editReply({ content: '❌ Ticket not found.' });
      return;
    }

    await storage.updateTicket(ticketId, {
      status: 'closed',
      closedAt: new Date(),
    });

    const embed = new EmbedBuilder()
      .setDescription(`🔒 Ticket closed by <@${interaction.user.id}>\n\nThis channel will be deleted in 5 seconds...`)
      .setColor(0x111214)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

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
        try {
          await channel.delete();
        } catch (deleteError) {
          console.error('Failed to delete channel:', deleteError);
        }
      }, 5000);
    }
  } catch (error) {
    console.error('Error closing ticket:', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Failed to close ticket.' });
      } else {
        await interaction.reply({ content: '❌ Failed to close ticket.', flags: 64 });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
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
    .setColor(0x111214)
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

export async function sendVerifyPanel(channelId: string, serverName: string) {
  if (!client) {
    throw new Error('Discord bot not initialized');
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('Invalid channel');
  }

  const appUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG + '.replit.app'}`;

  const embed = new EmbedBuilder()
    .setTitle('Verification required')
    .setDescription(`To gain access to **${serverName}** you need to prove you are a human by completing a captcha. Click the button below to get started!`)
    .setColor(0x111214)
    .setFooter({ text: `ONLY verify on ${appUrl}` });

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('verify_start')
        .setLabel('Verify')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('verify_why')
        .setLabel('Why?')
        .setStyle(ButtonStyle.Secondary)
    );

  await (channel as TextChannel).send({ embeds: [embed], components: [row] });
}

export function getDiscordClient() {
  return client;
}
