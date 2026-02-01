# Notifications Setup Guide

This guide explains how to configure Telegram and Webhook notifications for your Safe multisig monitors.

## Overview

The multisig monitor supports two notification channels:
1. **Telegram** - Get instant alerts in your Telegram app
2. **Webhooks** - Send alerts to Discord, Slack, or any custom webhook endpoint

## Telegram Notifications

### Simple Setup - Just Your Chat ID!

The system uses a shared Telegram bot, so you only need to provide your Chat ID. No need to create your own bot!

### Get Your Chat ID

1. Open Telegram and search for `@userinfobot`
2. Start a chat with @userinfobot
3. Send any message to the bot
4. It will reply with your user information, including your **Chat ID**
   - Format: `123456789` (a numeric ID)

### Configure in Multisig Monitor

1. Go to your [Monitors page](http://localhost:7110/monitor)
2. Click on a monitor to edit it
3. Scroll to the Notifications section
4. Enable **Telegram** toggle
5. Enter your **Chat ID**
6. Click **Update Monitor**

### What You'll Receive

When a new transaction is detected, you'll receive a formatted message like:

```
⚠️ **SUSPICIOUS TRANSACTION**

**Network:** ethereum
**Safe:** `0x1234...5678`
**Description:** High-risk transaction detected
**Nonce:** 42
**Status:** ⏳ Awaiting execution

[View in Safe App](https://app.safe.global/...)
```

### Testing Your Setup

The system uses a shared bot token configured in the backend. To test:
1. Make sure `TELEGRAM_BOT_TOKEN` is set in your backend environment
2. Configure your Chat ID in a monitor
3. The worker will send notifications automatically when transactions are detected

You can also test the bot manually by sending a message to it on Telegram to verify it's working.

## Webhook Notifications

Webhooks allow you to receive notifications in Discord, Slack, or any custom endpoint that accepts HTTP POST requests.

### Discord Webhooks

#### Step 1: Create Discord Webhook

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Configure the webhook:
   - Choose a channel for notifications
   - Customize name and avatar (optional)
5. Click **Copy Webhook URL**
   - Format: `https://discord.com/api/webhooks/...`

#### Step 2: Configure in Multisig Monitor

1. Go to your [Monitors page](http://localhost:7110/monitor)
2. Click on a monitor to edit it
3. Scroll to the Notifications section
4. Enable **Discord** toggle
5. Paste your **Webhook URL**
6. Click **Update Monitor**

#### What You'll Receive

Discord will display a rich embed with:
- Color-coded alerts (🔴 Red for suspicious, 🟠 Orange for management, 🟢 Green for normal)
- Formatted transaction details
- Clickable link to view in Safe App

### Slack Webhooks

#### Step 1: Create Slack Webhook

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name your app (e.g., "Safe Monitor")
4. Choose your workspace
5. Go to **Incoming Webhooks** → Toggle **Activate Incoming Webhooks**
6. Click **Add New Webhook to Workspace**
7. Choose a channel for notifications
8. Click **Copy** to get your webhook URL
   - Format: `https://hooks.slack.com/services/...`

#### Step 2: Configure in Multisig Monitor

1. Go to your [Monitors page](http://localhost:7110/monitor)
2. Click on a monitor to edit it
3. Scroll to the Notifications section
4. Enable **Slack** toggle
5. Paste your **Webhook URL**
6. Click **Update Monitor**

### Generic Webhooks

For custom integrations or other services that accept webhooks:

1. Enable **Webhook** toggle in your monitor settings
2. Enter your webhook endpoint URL
3. Your endpoint will receive POST requests with JSON payload:

```json
{
  "safe_address": "0x1234...5678",
  "network": "ethereum",
  "transaction_hash": "0xabc...def",
  "alert_type": "Suspicious",
  "description": "High-risk transaction detected",
  "nonce": 42,
  "is_executed": false
}
```

### Testing Webhooks

Test your webhook URL before configuring:

**Discord:**
```bash
curl -X POST "<YOUR_DISCORD_WEBHOOK_URL>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message from Safe Monitor!"}'
```

**Slack:**
```bash
curl -X POST "<YOUR_SLACK_WEBHOOK_URL>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message from Safe Monitor!"}'
```

**Generic:**
```bash
curl -X POST "<YOUR_WEBHOOK_URL>" \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'
```

## Multiple Notification Channels

You can enable multiple notification channels for a single monitor:
- ✅ Telegram + Discord
- ✅ Telegram + Slack  
- ✅ All three at once

Each channel will receive notifications independently when transactions are detected.

## Alert Types

You can configure which types of transactions trigger notifications:

- **All transactions** - Get notified for every transaction
- **Management and Suspicious only** - Only critical events
- **Suspicious only** - Only high-risk transactions

Configure this in the "Alert Type" section when editing your monitor.

## Troubleshooting

### Telegram Not Receiving Messages

1. **Check Chat ID**: Make sure you're using the correct numeric Chat ID from @userinfobot
2. **Verify Bot Token**: Ensure `TELEGRAM_BOT_TOKEN` is properly set in backend environment
3. **Check Bot Status**: Send a message directly to the bot on Telegram to verify it's active
4. **Worker Running**: Ensure the monitor worker process is running and checking for transactions

### Discord Webhook Failing

1. **Verify URL**: Check that you copied the complete webhook URL
2. **Channel Permissions**: Ensure the webhook has permission to post in the channel
3. **URL Not Expired**: Discord webhooks can be deleted; create a new one if needed
4. **Test Manually**: Use the curl command above to test the webhook directly

### Slack Webhook Failing

1. **App Installation**: Ensure your Slack app is properly installed to the workspace
2. **Channel Access**: Verify the webhook has access to post in the selected channel
3. **URL Format**: Slack webhook URLs follow a specific format - don't modify them
4. **Test Manually**: Use the curl command above to test the webhook directly

## Security Notes

- **Bot Token Security**: The shared `TELEGRAM_BOT_TOKEN` should be kept secure in environment variables
- **Chat ID Privacy**: Chat IDs are user-specific and stored securely per monitor
- **Webhook URL Security**: Treat webhook URLs as secrets - they grant posting access
- **Discord URL Rotation**: You can delete and recreate Discord webhooks at any time
- **Monitor Permissions**: Only you can see and configure your monitors and their notification settings

## Backend Format

For developers: The backend expects notification channels in this format:

```json
{
  "notificationChannels": [
    {
      "type": "telegram",
      "chat_id": "123456789"
    },
    {
      "type": "webhook",
      "url": "https://...",
      "webhook_type": "discord"
    }
  ]
}
```

Where `webhook_type` can be: `discord`, `slack`, or `generic`.

The backend uses the shared `TELEGRAM_BOT_TOKEN` from environment variables - users only provide their Chat ID.
