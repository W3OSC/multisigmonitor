const axios = require('axios');

/**
 * Service for sending Telegram notifications
 */
class TelegramNotifier {
  /**
   * Send a Telegram notification for a transaction
   * 
   * @param {Object} notification The notification configuration
   * @param {Object} txInfo Transaction information
   * @returns {Promise<void>}
   */
  async sendNotification(notification, txInfo) {
    try {
      if (!notification.botApiKey || !notification.chatId) {
        console.log(`Missing Telegram credentials: botApiKey or chatId`);
        return;
      }
      
      console.log(`Sending Telegram notification to chat ${notification.chatId}`);
      
      // Create message with markdown formatting
      let message = `*${txInfo.type === 'suspicious' ? 'SUSPICIOUS TRANSACTION' : 'New Transaction'}*\n\n`;
      message += `*Network:* ${txInfo.network}\n`;
      message += `*Safe:* \`${txInfo.safeAddress}\`\n`;
      message += `*Description:* ${txInfo.description}\n`;
      
      if (txInfo.nonce !== undefined) {
        message += `*Nonce:* ${txInfo.nonce}\n`;
      }
      
      message += `*Status:* ${txInfo.isExecuted ? 'Executed' : 'Awaiting execution'}\n\n`;
      message += `*View transaction:*\n`;
      message += `- [Safe App](${txInfo.safeAppLink})\n`;
      message += `- [Safe Monitor](${txInfo.multisigmonitorLink})\n`;
      
      if (txInfo.etherscanLink) {
        message += `- [Etherscan](${txInfo.etherscanLink})\n`;
      }
      
      // Send the message
      const telegramApiUrl = `https://api.telegram.org/bot${notification.botApiKey}/sendMessage`;
      await axios.post(telegramApiUrl, {
        chat_id: notification.chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      
      console.log(`Telegram notification sent successfully`);
    } catch (telegramError) {
      console.error(`Error sending Telegram notification:`, telegramError.message);
    }
  }
}

module.exports = new TelegramNotifier();
