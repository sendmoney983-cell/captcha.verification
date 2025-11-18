# Discord Bot Deployment Troubleshooting

## ✅ Bot Works in Development

Your bot is successfully running in development mode:
- ✅ Bot logged in as **Support system#5269**
- ✅ Connected to 1 Discord server
- ✅ Slash commands registered
- ✅ Ticket counter loaded from database

## ❌ Bot Goes Offline After Deployment

**TL;DR - The Fix:**
1. Go to your Replit deployment settings
2. Add environment variable: `DISCORD_BOT_TOKEN` = `your_bot_token`
3. Use "Reserved VM" deployment type (NOT Static)
4. Redeploy

**Why:** Replit secrets (Tools → Secrets) only work in development. Production deployments need environment variables added separately.

---

If your bot goes offline after you deploy (publish) your app, follow these steps:

---

## Step 1: Add Discord Bot Token to Deployment

### ⚠️ CRITICAL: Secrets Must Be Added During Deployment

**Important:** Secrets in the Replit Secrets panel (Tools → Secrets) are ONLY available in development. They do NOT automatically transfer to production deployments.

### How to Add Secrets to Your Deployment:

#### Option A: During Initial Deployment

1. **Click the "Deploy" button** in Replit
2. **Choose "Reserved VM"** deployment type (required for Discord bots)
   - Don't use "Static" - it won't work for bots
   - Reserved VM keeps your bot running 24/7
3. **In the deployment configuration, find "Environment Variables"**
4. **Add your secret:**
   - Key: `DISCORD_BOT_TOKEN`
   - Value: Your bot token from Discord Developer Portal
5. **Click "Deploy"**

#### Option B: Update Existing Deployment

1. **Go to your deployed app** (click "Deployments" tab)
2. **Click on your active deployment**
3. **Click "Configure" or "Edit deployment"**
4. **Find "Environment Variables" section**
5. **Add or update:**
   - Key: `DISCORD_BOT_TOKEN`
   - Value: Your bot token
6. **Save and redeploy**

---

## Step 2: Verify Discord Bot Intents

Your bot needs these intents enabled in the Discord Developer Portal:

1. **Go to:** https://discord.com/developers/applications
2. **Select your bot application:** "Support system"
3. **Go to the "Bot" tab** (left sidebar)
4. **Scroll down to "Privileged Gateway Intents"**
5. **Enable these intents:**
   - ✅ **SERVER MEMBERS INTENT**
   - ✅ **MESSAGE CONTENT INTENT**

6. **Click "Save Changes"**

---

## Step 3: Check Deployment Logs

After deploying, check the production logs to see if the bot is connecting:

1. **In Replit, after deployment, click "View Logs"** or check the deployment console
2. **Look for these messages:**
   - ✅ `Discord bot initialized successfully`
   - ✅ `Discord bot logged in as Support system#5269`
   - ✅ `Bot is in 1 server(s)`
   - ✅ `Loaded ticket counter: X`
   - ✅ `Slash commands registered`

3. **If you see error messages instead:**
   - ❌ `DISCORD_BOT_TOKEN not found` → Go back to Step 1
   - ❌ `Invalid token` → Your token is wrong, regenerate it in Discord Developer Portal
   - ❌ `Disallowed intents` → Go back to Step 2

---

## Step 4: Restart Your Deployment

After making changes to secrets or Discord settings:

1. **Redeploy your app** (this will restart the bot with new settings)
2. **Wait 30-60 seconds** for the bot to connect
3. **Check your Discord server** - the bot should show as "Online"

---

## Common Issues & Solutions

### Issue: Bot shows offline in Discord but logs say it's connected

**Solution:** 
- The bot might be connecting and disconnecting rapidly
- Check if you have multiple instances of the bot running (old deployments)
- Make sure you've only invited the bot to your server once

### Issue: Bot connects but slash commands don't appear

**Solution:**
- Discord takes up to 1 hour to sync slash commands globally
- Try removing the bot and re-inviting it with this URL:
  ```
  https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=8&scope=bot%20applications.commands
  ```
- Replace `YOUR_BOT_CLIENT_ID` with your actual bot client ID

### Issue: "The application did not respond" errors

**Solution:**
- This is already fixed in the code with `deferReply()`
- If you still see this, the bot might be offline or overloaded
- Check deployment logs for errors

---

## How to Get Help

If the bot is still not working after trying all steps above:

1. **Check deployment logs** and copy any error messages
2. **Verify the bot is online in Discord** (green dot next to name)
3. **Test the `/panel` command** in your Discord server
4. **Share any error messages** for further debugging

---

## Quick Checklist

Before asking for help, verify:

- [ ] `DISCORD_BOT_TOKEN` is added to **Deployment Environment Variables** (not just Secrets)
- [ ] Deployment type is **"Reserved VM"** (not Static)
- [ ] Bot has **SERVER MEMBERS INTENT** enabled in Discord Developer Portal
- [ ] Bot has **MESSAGE CONTENT INTENT** enabled in Discord Developer Portal
- [ ] Bot is invited to your Discord server
- [ ] App has been **redeployed** after making changes
- [ ] Checked **deployment logs** for error messages (not dev logs)
- [ ] Bot shows as **"Online"** in Discord server member list

---

## Success Indicators

Your bot is working correctly when you see:

1. ✅ Bot shows **green "Online" status** in Discord
2. ✅ `/panel` command appears when you type `/` in your server
3. ✅ Clicking buttons creates ticket channels
4. ✅ Tickets appear in the web dashboard at `/tickets`

---

**Current Status:** Development ✅ | Production ❓

Once you verify the bot is working in production, update this file!
