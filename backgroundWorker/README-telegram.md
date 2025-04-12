# Setting Up Telegram Notifications

This guide explains how to set up Telegram notifications for Safe multisig transactions.

## How It Works

The monitoring system can send notifications to your Telegram account or group when new transactions are detected on your monitored Safe. The system can be configured to notify for either:

1. All transactions
2. Only suspicious transactions

**Important Note:** To prevent notification spam, the system will only notify you about transactions that occur **after** you add a Safe address to monitoring. Historical transactions that existed before you set up monitoring will not trigger notifications.

## Setup Instructions

### Step 1: Create a Telegram Bot

You need to create a Telegram bot that will send you notifications:

1. Open Telegram and search for `@BotFather`
2. Start a chat with BotFather and send the command `/newbot`
3. Follow the prompts to create a bot - choose a name and username
4. Once created, BotFather will provide an API token that looks like this:
   ```
   123456789:ABCDefGhIJklmNoPQRstUvwxYZ
   ```
5. Copy this token - you'll need it for the monitor configuration

### Step 2: Get Your Chat ID

You need your Telegram chat ID to receive messages:

#### For personal notifications:

1. Search for `@userinfobot` on Telegram
2. Start a chat and it will display your chat ID (a number like `123456789`)
3. Copy this ID

#### For group notifications:

1. Add your bot to the group
2. Send a message in the group mentioning the bot
3. Access `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id": -123456789}` in the response (note that group IDs are negative numbers)
5. Copy this ID

### Step 3: Configure Your Monitor

In the Safe Watch application:

1. Go to "Monitor" and edit your Safe monitor settings
2. Enable notifications
3. Select "Telegram" as a notification method
4. Enter your Bot API Key (token) from Step 1
5. Enter your Chat ID from Step 2
6. Choose your Alert Type preference (all transactions or suspicious only)
7. Save your changes

### Testing Your Setup

To verify your setup is working correctly:

1. Send a message to your bot directly to confirm it's active
2. Wait for the next check cycle to run (~1 minute)
3. Any new transactions on your monitored Safe will trigger notifications
4. Check the application logs for any errors if notifications don't arrive

## Notification Format

Telegram notifications include:

- Transaction type (normal or suspicious)
- Network name
- Safe address
- Transaction description
- Transaction nonce (if available)
- Execution status
- Links to view the transaction in:
  - Safe App (official Safe interface)
  - Safe Monitor (your monitoring dashboard)
  - Etherscan (if the transaction has been executed)

## Troubleshooting

If you're not receiving notifications:

1. Check that your bot is active and can send you messages directly
2. Verify your Bot API Key is entered correctly
3. Confirm your Chat ID is correct
4. Check the application logs for any errors
5. Ensure your Safe has new transactions (notifications are only sent for new transactions)
6. Verify that you've selected the appropriate alert type for your needs

## Security Considerations

- Keep your Bot API Key private - anyone with this token can send messages as your bot
- For public groups, consider using a dedicated group just for Safe notifications
- Telegram messages are not end-to-end encrypted - don't include sensitive information in notifications
