# Setting Up Webhook Notifications

This guide explains how to set up webhook notifications (Discord, Slack, and generic webhooks) for Safe multisig transactions.

## How It Works

The monitoring system can send webhook notifications to various services when new transactions are detected on monitored Safe addresses. The system supports:

1. **Discord** webhooks - Beautiful embeds with transaction details
2. **Slack** webhooks - Rich layouts with buttons and structured data
3. **Generic webhooks** - JSON payloads for custom integrations

Like other notifications, you can configure the system to notify for either all transactions or only suspicious ones.

## Webhook Types and Features

### Discord Webhooks

Discord webhooks include:
- Color-coded embeds (blue for normal, red for suspicious, orange for test notifications)
- Complete transaction details (network, Safe address, description, nonce, status)
- Clickable buttons to view the transaction in Safe App, Safe Monitor, and Etherscan
- Custom username and avatar for webhook messages

![Discord Webhook Example](https://cdn.discordapp.com/attachments/123456789/123456789/discord-webhook-example.png)

### Slack Webhooks

Slack webhooks include:
- Clean, structured message blocks
- Transaction details in an easy-to-read format
- Action buttons for viewing the transaction
- Color accents based on transaction type

![Slack Webhook Example](https://cdn.discordapp.com/attachments/123456789/123456789/slack-webhook-example.png)

### Generic Webhooks

For custom integrations, generic webhooks send a JSON payload containing:
- Event type (`safe_transaction`)
- Test flag
- Alert type (`normal` or `suspicious`)
- Safe details (address and network)
- Transaction information (hash, description, nonce, status)
- Links to view the transaction
- Timestamp

## Setup Instructions

### Discord Setup

1. In your Discord server, go to **Server Settings** > **Integrations** > **Webhooks**
2. Click **New Webhook**
3. Name your webhook (e.g., "Safe Monitor")
4. Choose the channel where notifications should be sent
5. Click **Copy Webhook URL**
6. In the Safe Monitor application, add this URL as a Discord webhook

### Slack Setup

1. Go to your Slack workspace and create a new app at https://api.slack.com/apps
2. Click **Create New App** > **From Scratch**
3. Name your app (e.g., "Safe Monitor") and select your workspace
4. Click **Incoming Webhooks** in the sidebar
5. Toggle **Activate Incoming Webhooks** to **On**
6. Click **Add New Webhook to Workspace**
7. Select the channel where notifications should be sent
8. Copy the webhook URL provided
9. In the Safe Monitor application, add this URL as a Slack webhook

### Generic Webhook Setup

For custom integrations, you can use any endpoint that accepts JSON POST requests:

1. Set up your custom webhook receiver endpoint
2. Configure it to accept JSON payloads
3. Add the endpoint URL to Safe Monitor as a generic webhook

## Configure Your Monitor

In the Safe Monitor application:

1. Go to **Monitor** and edit your Safe monitor settings
2. Enable notifications
3. Select your preferred webhook type (Discord, Slack, or generic)
4. Enter the webhook URL you copied from the respective service
5. Choose your Alert Type preference (all transactions or suspicious only)
6. Save your changes

## Testing Webhook Notifications

You can test your webhook setup without creating actual Safe transactions:

1. Set up your webhook as described above
2. Run the test transaction script:
   ```bash
   node insert-test-transaction.js
   ```
3. Follow the prompts to:
   - Select a monitor to test
   - Choose a transaction type (normal or suspicious)
   - Add transaction details
4. The monitoring service will detect the test transaction and send a webhook notification
5. The notification will be clearly marked as a test

## Webhook Payload Examples

### Discord Webhook Payload

```json
{
  "username": "Safe Monitor",
  "avatar_url": "https://cryptologos.cc/logos/gnosis-safe-gno-logo.png",
  "embeds": [
    {
      "title": "⚠️ SUSPICIOUS TRANSACTION",
      "color": 16724719,
      "description": "A new suspicious transaction has been detected on Safe: `0x1234...5678`",
      "fields": [
        {
          "name": "Network",
          "value": "ethereum",
          "inline": true
        },
        {
          "name": "Description",
          "value": "transfer operation",
          "inline": true
        },
        {
          "name": "Nonce",
          "value": "5",
          "inline": true
        },
        {
          "name": "Status",
          "value": "⏳ Awaiting execution",
          "inline": true
        },
        {
          "name": "Transaction Hash",
          "value": "`0xabcd...1234`",
          "inline": true
        }
      ],
      "footer": {
        "text": "Safe Monitor Notification"
      },
      "timestamp": "2025-04-11T12:30:45.123Z"
    }
  ],
  "components": [
    {
      "type": 1,
      "components": [
        {
          "type": 2,
          "style": 5,
          "label": "View in Safe App",
          "url": "https://app.safe.global/transactions/tx?safe=eth:0x1234...5678&id=multisig_0x1234...5678_0xabcd...1234"
        },
        {
          "type": 2,
          "style": 5,
          "label": "View in Safe Monitor",
          "url": "https://safemonitor.io/monitor/transactions/0xabcd...1234"
        }
      ]
    }
  ]
}
```

### Slack Webhook Payload

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "⚠️ SUSPICIOUS TRANSACTION",
        "emoji": true
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "A new suspicious transaction has been detected on Safe:\n*0x1234...5678*"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Network:*\nethereum"
        },
        {
          "type": "mrkdwn",
          "text": "*Description:*\ntransfer operation"
        }
      ]
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Nonce:*\n5"
        },
        {
          "type": "mrkdwn",
          "text": "*Status:*\n⏳ Awaiting execution"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Transaction Hash:*\n`0xabcd...1234`"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View in Safe App",
            "emoji": true
          },
          "url": "https://app.safe.global/transactions/tx?safe=eth:0x1234...5678&id=multisig_0x1234...5678_0xabcd...1234"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View in Safe Monitor",
            "emoji": true
          },
          "url": "https://safemonitor.io/monitor/transactions/0xabcd...1234"
        }
      ]
    }
  ],
  "attachments": [
    {
      "color": "#FF6B6B"
    }
  ]
}
```

### Generic Webhook Payload

```json
{
  "event_type": "safe_transaction",
  "test": false,
  "alert_type": "suspicious",
  "safe": {
    "address": "0x1234...5678",
    "network": "ethereum"
  },
  "transaction": {
    "hash": "0xabcd...1234",
    "description": "transfer operation",
    "nonce": 5,
    "status": "pending",
    "execution_hash": null
  },
  "links": {
    "safe_app": "https://app.safe.global/transactions/tx?safe=eth:0x1234...5678&id=multisig_0x1234...5678_0xabcd...1234",
    "safe_monitor": "https://safemonitor.io/monitor/transactions/0xabcd...1234"
  },
  "timestamp": "2025-04-11T12:30:45.123Z"
}
```

## Troubleshooting

If your webhooks aren't working:

1. **Verify the webhook URL** is correctly copied and hasn't expired
2. **Check the console logs** for error messages when sending webhooks
3. For Discord:
   - Ensure the webhook wasn't deleted in Discord
   - Check that the bot has permission to send messages in the channel
4. For Slack:
   - Verify the Slack app is still installed in your workspace
   - Check that the app has the necessary permissions
5. For generic webhooks:
   - Ensure your endpoint accepts POST requests with a JSON content type
   - Verify your server is properly handling the payload format
   - Check for any authentication requirements or rate limits

## Rate Limits

Be aware of rate limits imposed by the services:
- Discord: 5 webhook messages per second per channel
- Slack: Tier-based rate limits (typically 1 message per second for free workspaces)
- Custom webhooks: Depends on your implementation

The monitoring service implements basic retry logic, but persistent failures will be logged to help with troubleshooting.
