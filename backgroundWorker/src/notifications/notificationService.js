const emailNotifier = require('./emailNotifier');
const webhookNotifier = require('./webhookNotifier');
const telegramNotifier = require('./telegramNotifier');
const databaseService = require('../services/databaseService');

/**
 * Service for handling all notification methods
 */
class NotificationService {
  /**
   * Check if a notification should be sent for a transaction based on monitor settings
   * 
   * @param {Object} monitor The monitor configuration
   * @param {Object} transaction The transaction object
   * @param {boolean} isSuspicious Whether the transaction is suspicious
   * @param {boolean} isManagement Whether the transaction is a management transaction
   * @returns {boolean} Whether a notification should be sent
   */
  shouldSendNotification(monitor, transaction, isSuspicious, isManagement) {
    console.log(`Checking notification settings for monitor ${monitor.id}:`, JSON.stringify(monitor.settings));
    
    // Must have notifications enabled (check both locations due to schema transition)
    const notifyEnabled = monitor.settings.notify || monitor.notify;
    if (!notifyEnabled) {
      console.log(`- Notifications disabled for monitor ${monitor.id}`);
      return false;
    }
    
    // Must have at least one notification method configured
    if (!monitor.settings.notifications?.length) {
      console.log(`- No notification methods configured for monitor ${monitor.id}`);
      return false;
    }
    
    // Check if this is a management-only monitor and the transaction is not a management transaction
    const managementOnly = monitor.settings.managementOnly === true;
    
    if (managementOnly && !isManagement) {
      console.log(`- Management-only monitor, but transaction is not a management transaction`);
      return false;
    }
    
    // Check the alert type preference and decide if we should notify
    const alertType = monitor.settings.alertType || 'suspicious';
    let shouldNotify = false;
    
    switch (alertType) {
      case 'all':
        // Notify for all transactions
        shouldNotify = true;
        break;
      case 'suspicious':
        // Notify for suspicious transactions and management transactions
        shouldNotify = isSuspicious || isManagement;
        break;
      case 'management':
        // Notify only for management transactions
        shouldNotify = isManagement;
        break;
      default:
        // Default to suspicious transactions only (legacy behavior)
        shouldNotify = isSuspicious;
    }
    
    console.log(`- Alert type: ${alertType}, Transaction is suspicious: ${isSuspicious}, Transaction is management: ${isManagement}`);
    console.log(`- Should send notification: ${shouldNotify}`);
    
    return shouldNotify;
  }

  /**
   * Generate link information for transaction notifications
   * 
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @param {string} safeTxHash The transaction hash
   * @param {boolean} isExecuted Whether the transaction has been executed
   * @param {string} transactionHash Optional execution transaction hash
   * @returns {Object} Object containing links
   */
  generateTransactionLinks(safeAddress, network, safeTxHash, isExecuted, transactionHash) {
    const safeAppLink = `https://app.safe.global/transactions/tx?safe=${network}:${safeAddress}&id=multisig_${safeAddress}_${safeTxHash}`;
    const safeMonitorLink = `https://safemonitor.io/monitor/transactions/${safeTxHash}`;
    const etherscanLink = isExecuted 
      ? `https://${network === 'ethereum' ? '' : network + '.'}etherscan.io/tx/${transactionHash || safeTxHash}`
      : null;
      
    return {
      safeAppLink,
      safeMonitorLink,
      etherscanLink
    };
  }

  /**
   * Send notifications for a transaction to all configured notification methods
   * 
   * @param {Object} monitor The monitor configuration
   * @param {Object} transaction The transaction object
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @param {string} description Human-readable description of the transaction
   * @param {string} txType Type of transaction (normal or suspicious)
   * @param {boolean} isTest Whether this is a test notification
   * @returns {Promise<void>}
   */
  async sendNotifications(monitor, transaction, safeAddress, network, description, txType, isTest = false) {
    try {
      console.log(`Sending notification for monitor ${monitor.id} for transaction ${transaction.safeTxHash}`);
      
      // Process each notification method
      for (const notification of monitor.settings.notifications) {
        const method = notification.method;
        console.log(`Using notification method: ${method}`);
        
        // Create transaction info object with links
        const links = this.generateTransactionLinks(
          safeAddress, 
          network, 
          transaction.safeTxHash, 
          transaction.isExecuted || false,
          transaction.transactionHash
        );
        
        const txInfo = {
          safeAddress: safeAddress,
          network: network,
          type: txType,
          description: description,
          hash: transaction.safeTxHash,
          nonce: transaction.nonce,
          isExecuted: transaction.isExecuted || false,
          ...links,
          isTest: isTest
        };
        
        // Implement notification logic based on method
        switch (method) {
          case 'email':
            await emailNotifier.sendNotification(notification, txInfo);
            break;
          case 'webhook':
          case 'discord':
          case 'slack':
            await webhookNotifier.sendNotification(notification, method, txInfo);
            break;
          case 'telegram':
            await telegramNotifier.sendNotification(notification, txInfo);
            break;
          default:
            console.log(`Unknown notification method: ${method}`);
        }
      }
      
      // Record that a notification was sent for this transaction
      await databaseService.recordNotification(
        transaction.safeTxHash,
        safeAddress, 
        network, 
        txType,
        monitor.id
      );
      
      console.log(`Recorded notification for monitor ${monitor.id}, transaction ${transaction.safeTxHash}`);
    } catch (notificationError) {
      console.error('Notification error:', notificationError.message);
    }
  }
}

module.exports = new NotificationService();
