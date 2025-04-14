const axios = require('axios');
const {
  generateDiscordWebhook,
  generateSlackWebhook,
  generateGenericWebhook
} = require('../../webhook-templates');

/**
 * Service for sending webhook notifications
 */
class WebhookNotifier {
  /**
   * Send a webhook notification for a transaction
   * 
   * @param {Object} notification The notification configuration
   * @param {string} method The webhook method (webhook, discord, slack)
   * @param {Object} txInfo Transaction information
   * @returns {Promise<void>}
   */
  async sendNotification(notification, method, txInfo) {
    try {
      if (!notification.webhookUrl) {
        console.log(`No webhook URL configured for this notification`);
        return;
      }
      
      console.log(`Sending ${method} webhook to ${notification.webhookUrl}`);
      
      // Generate appropriate webhook payload based on method
      let webhookPayload;
      const contentType = 'application/json';
      
      if (method === 'discord') {
        webhookPayload = generateDiscordWebhook(txInfo);
      } else if (method === 'slack') {
        webhookPayload = generateSlackWebhook(txInfo);
      } else {
        // Generic webhook
        webhookPayload = generateGenericWebhook(txInfo, txInfo.safeAddress, txInfo.network);
      }
      
      // Send the webhook
      const response = await axios.post(notification.webhookUrl, webhookPayload, {
        headers: {
          'Content-Type': contentType
        }
      });
      
      console.log(`${method} webhook sent successfully to ${notification.webhookUrl}, status: ${response.status}`);
    } catch (webhookError) {
      console.error(`Error sending ${method} webhook notification:`, webhookError.message);
      if (webhookError.response) {
        console.error(`Error status: ${webhookError.response.status}`);
        console.error(`Error details:`, webhookError.response.data || 'No additional error details');
      }
    }
  }
}

module.exports = new WebhookNotifier();
