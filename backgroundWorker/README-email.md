# Setting Up Email Notifications

This guide explains how to set up email notifications for multisig transactions using Resend.

## How It Works

The monitoring system can send email notifications to users when new transactions are detected on their monitored Safe. The system can be configured to notify for either:

1. All transactions
2. Only suspicious transactions

**Important Note:** To prevent notification spam, the system will only notify you about transactions that occur **after** you add a Safe address to monitoring. Historical transactions that existed before you set up monitoring will not trigger notifications.

## Email Notifications with Resend

This service uses [Resend](https://resend.com/) to send email notifications. Resend is a developer-friendly email service that offers:

- Simple API integration
- High deliverability
- Usage-based pricing with a generous free tier (3,000 emails/month)
- Detailed email analytics

## Setup Instructions

### Step 1: Create a Resend Account

1. Sign up for a free account at [resend.com](https://resend.com/)
2. Verify your domain or use Resend's shared domain for testing
3. Generate an API key from the Resend dashboard

### Step 2: Configure the Monitoring Service

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Resend API key to the `.env` file:
   ```
   RESEND_API_KEY=re_1234567890abcdefghijklmnopqrstuvwxyz
   ```

3. Optionally, configure a custom "from" email address:
   ```
   DEFAULT_FROM_EMAIL=notifications@yourdomain.com
   ```
   Note: If using a custom domain, it must be verified in your Resend account.

### Step 3: Configure Your Monitor

In the Safe Watch application:

1. Go to "Monitor" and edit your Safe monitor settings
2. Enable notifications
3. Select "Email" as a notification method
4. Enter your email address
5. Choose your Alert Type preference (all transactions or suspicious only)
6. Save your changes

## Email Notification Format

Email notifications include:

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

Emails have both HTML and plain text versions for compatibility with all email clients.

## Testing Email Notifications

You can test your email notification setup without creating actual Safe transactions:

1. Make sure your Resend API key is configured in the `.env` file
2. Run the test transaction script:
   ```bash
   node insert-test-transaction.js
   ```
3. Follow the prompts to:
   - Select a monitor to test
   - Choose the transaction type (normal or suspicious)
   - Add other transaction details
4. The test script will insert a mock transaction that will be picked up by the monitoring service on its next check cycle (within 1 minute)
5. Email notifications will be sent according to your monitor's notification settings

## Troubleshooting

If you're not receiving notifications:

1. Check the console logs for any errors related to Resend
2. Verify your API key is correct and active in your Resend dashboard
3. Check your spam/junk folder
4. Ensure the email address in your monitor settings is correct
5. Check that notifications are enabled for your monitor
6. Ensure the monitor was created before any transactions you expect to be notified about

## Email Analytics

Resend provides detailed analytics for your email notifications, including:

- Delivery rates
- Open rates
- Click rates
- Bounces and complaints

Access these from your Resend dashboard to monitor your notification performance.
