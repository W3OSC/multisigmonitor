const { getEmailClient, defaultFromEmail } = require('../config/email');
const { generateTransactionEmailHtml, generateTransactionEmailText } = require('../../email-templates');

/**
 * Service for sending email notifications
 */
class EmailNotifier {
  /**
   * Send an email notification for a transaction
   * 
   * @param {Object} notification The notification configuration
   * @param {Object} txInfo Transaction information
   * @returns {Promise<void>}
   */
  async sendNotification(notification, txInfo) {
    try {
      if (!notification.email) {
        return;
      }
      
      console.log(`Sending email to ${notification.email}`);
      
      // Generate email content
      const htmlContent = generateTransactionEmailHtml(txInfo);
      const textContent = generateTransactionEmailText(txInfo);
      
      // Set subject based on transaction type
      const subject = `${txInfo.type === 'suspicious' ? 'Suspicious Safe Transaction Detected' : 'Multisig Transaction Detected'}`;
      
      const resend = getEmailClient();
      if (resend) {
        try {
          const response = await resend.emails.send({
            from: defaultFromEmail,
            to: notification.email,
            subject: subject,
            html: htmlContent,
            text: textContent
          });
          
          console.log(`Email sent successfully to ${notification.email}, ID: ${response.id}`);
        } catch (emailSendError) {
          console.error(`Error sending email: ${emailSendError.message}`);
        }
      } else {
        console.log(`RESEND_API_KEY is set as environment variable`);
      }
    } catch (emailError) {
      console.error(`Error sending email notification:`, emailError.message);
    }
  }
}

module.exports = new EmailNotifier();
