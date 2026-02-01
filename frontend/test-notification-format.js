// Test file to verify notification channel format
// Run this in browser console on the monitor config page

// Test Telegram format conversion
const telegramNotification = {
  method: "telegram",
  enabled: true,
  telegramBotApiKey: "123456789:ABCDefGhIJKLmnoPQRstUvWxyZ",
  telegramChatId: "123456789"
};

const expectedTelegram = {
  type: "telegram",
  bot_api_key: "123456789:ABCDefGhIJKLmnoPQRstUvWxyZ",
  chat_id: "123456789"
};

// Test Discord webhook format conversion
const discordNotification = {
  method: "discord",
  enabled: true,
  webhookUrl: "https://discord.com/api/webhooks/123/abc"
};

const expectedDiscord = {
  type: "webhook",
  url: "https://discord.com/api/webhooks/123/abc",
  webhook_type: "discord"
};

// Test Slack webhook format conversion
const slackNotification = {
  method: "slack",
  enabled: true,
  webhookUrl: "https://hooks.slack.com/services/T00/B00/XXX"
};

const expectedSlack = {
  type: "webhook",
  url: "https://hooks.slack.com/services/T00/B00/XXX",
  webhook_type: "slack"
};

// Test Generic webhook format conversion
const genericNotification = {
  method: "webhook",
  enabled: true,
  webhookUrl: "https://example.com/webhook"
};

const expectedGeneric = {
  type: "webhook",
  url: "https://example.com/webhook",
  webhook_type: "generic"
};

console.log("Testing notification format conversions:");
console.log("Telegram:", JSON.stringify(expectedTelegram));
console.log("Discord:", JSON.stringify(expectedDiscord));
console.log("Slack:", JSON.stringify(expectedSlack));
console.log("Generic:", JSON.stringify(expectedGeneric));
