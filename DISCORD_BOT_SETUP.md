# Discord Ticketing Bot Setup Guide

## ✅ Bot is Now Running!

Your Discord ticketing bot is successfully connected and running as **Support system#5269**.

**Status: All features working perfectly! ✅**
- ✅ `/panel` slash command
- ✅ Ticket creation (3 categories)
- ✅ Claim & Close buttons
- ✅ Database persistence
- ✅ Web dashboard at `/tickets`

## 🎫 How to Use the Ticketing System

### Step 1: Send the Ticket Panel to Your Discord Server

**✨ Easy Method - Use Slash Command:**

Simply type **`/panel`** in any Discord channel where you want the ticket panel to appear!

The bot will instantly send the ticket panel with all 3 category buttons.

---

**Alternative Method - API Endpoint:**

You can also send the panel programmatically via API:

```
POST /api/discord/send-panel
Authorization: Bearer hourglass2024
Content-Type: application/json

{
  "channelId": "YOUR_CHANNEL_ID"
}
```

**How to get your Channel ID:**
1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click on the channel where you want the ticket panel
3. Click "Copy Channel ID"

### Step 2: Users Create Tickets

Once the panel is sent, users will see three buttons:
- 🎫 **General Support** (Red button)
- 🐛 **Bug Report** (Blue button)
- 🤝 **Partnership Request** (Green button)

When a user clicks a button:
1. A private ticket channel is created (e.g., `ticket-0001`)
2. Only the user and staff can see this channel
3. The ticket is logged in the database

### Step 3: Staff Manage Tickets

In each ticket channel, staff members will see two buttons:
- ✋ **Claim Ticket** - Assign the ticket to yourself
- 🔒 **Close Ticket** - Close and archive the ticket

### Step 4: View Tickets on the Web Dashboard

Visit **https://your-domain.replit.app/tickets** to:
- View all tickets (open, claimed, closed)
- Read conversation history
- Filter by status
- See ticket details (category, user, timestamps)

## 📊 Database Schema

**Tickets Table:**
- `ticketNumber` - Unique ticket number (e.g., "0001")
- `userId` - Discord user ID
- `username` - Discord username
- `channelId` - Discord channel ID
- `category` - Support category
- `status` - open, claimed, or closed
- `claimedBy` - Staff member who claimed it
- `createdAt` / `closedAt` - Timestamps

**Ticket Messages Table:**
- All messages in ticket channels are automatically saved
- Can be viewed on the web dashboard

## 🔧 Bot Configuration

**Required Discord Bot Permissions:**
- Manage Channels (create/delete ticket channels)
- Manage Roles (set channel permissions)
- Read Message History (generate transcripts)
- Send Messages (reply in tickets)
- Embed Links (rich embeds)
- Attach Files (send transcripts)

**Required Gateway Intents (Already Enabled):**
- ✅ SERVER MEMBERS INTENT
- ✅ MESSAGE CONTENT INTENT
- ✅ Guilds
- ✅ Guild Messages

## 🎨 Ticket Panel Design

The ticket panel matches the Hourglass branding:
- Dark theme background
- Teal/cyan accent colors (#3dd9b3)
- Professional institutional feel
- Clear call-to-action buttons

## 📝 Example Usage Flow

1. **Admin sends panel** → Makes API call to `/api/discord/send-panel`
2. **User clicks "General Support"** → Bot creates `ticket-0001` channel
3. **User describes issue** → Messages saved to database
4. **Staff clicks "Claim Ticket"** → Ticket assigned to staff member
5. **Staff helps user** → Conversation continues in private channel
6. **Staff clicks "Close Ticket"** → Channel deleted after 5 seconds, data preserved
7. **Admin views history** → Visits `/tickets` to see all conversations

## 🚀 Next Steps

To set up your ticket panel:

**Quick Start:**
1. Open Discord and go to the channel where you want tickets
2. Type `/panel` and press Enter
3. The ticket panel will appear with 3 buttons
4. Users can now create tickets!

**Or programmatically:**
1. Get your Discord channel ID (enable Developer Mode → right-click channel → Copy Channel ID)
2. Make a POST request to `/api/discord/send-panel` with your channel ID
3. The ticket panel will appear in that channel
4. Users can now create tickets!

## 📝 Available Commands

- `/panel` - Send the ticket panel to the current channel (Only works in Discord)

## 🔐 Security Notes

- Only authorized staff should have access to ticket channels
- The web dashboard at `/tickets` is public - consider adding authentication if needed
- Database stores all ticket conversations for compliance and history
- Bot token is securely stored in environment variables

---

Your Discord ticketing system is ready to use! 🎉
