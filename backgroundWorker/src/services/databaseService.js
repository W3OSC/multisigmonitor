const supabase = require('../../supabase');

/**
 * Service for interacting with the database (Supabase)
 */
class DatabaseService {
  /**
   * Get all active monitors from the database
   * 
   * @returns {Promise<Array>} Array of active monitors
   */
  async getActiveMonitors() {
    const { data: monitors, error } = await supabase
      .from('monitors')
      .select('id, safe_address, network, settings, created_at')
      .filter('settings->active', 'neq', false);
    
    if (error) {
      console.error('Error fetching monitors:', error.message);
      throw error;
    }
    
    return monitors || [];
  }
  
  /**
   * Get the last check timestamp for a Safe address and network
   * 
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @returns {Promise<Object|null>} The last check data or null if not found
   */
  async getLastCheckTimestamp(safeAddress, network) {
    try {
      const { data } = await supabase
        .from('last_checks')
        .select('unix_timestamp')
        .eq('safe_address', safeAddress)
        .eq('network', network)
        .single();
      
      return data;
    } catch (error) {
      console.error(`Error getting last check data: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Update the last check timestamp for a Safe address and network
   * 
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @returns {Promise<void>}
   */
  async updateLastCheckTimestamp(safeAddress, network) {
    const timestamp = Date.now();
    
    try {
      // First check if a record already exists
      const { data: existingCheck } = await supabase
        .from('last_checks')
        .select('id')
        .eq('safe_address', safeAddress)
        .eq('network', network)
        .single();
        
      if (existingCheck) {
        // Update existing record
        await supabase
          .from('last_checks')
          .update({ 
            checked_at: new Date().toISOString(),
            unix_timestamp: timestamp
          })
          .eq('id', existingCheck.id);
          
        console.log(`Updated last check timestamp for ${safeAddress} on ${network}`);
      } else {
        // Create new record
        await supabase
          .from('last_checks')
          .insert({
            safe_address: safeAddress,
            network: network,
            checked_at: new Date().toISOString(),
            unix_timestamp: timestamp
          });
          
        console.log(`Created new last check timestamp for ${safeAddress} on ${network}`);
      }
    } catch (error) {
      console.error(`Error updating last check timestamp: ${error.message}`);
      throw error;
    }
    
    return timestamp;
  }
  
  /**
   * Get existing transactions for a Safe address and network
   * 
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @returns {Promise<Array>} Array of existing transactions
   */
  async getExistingTransactions(safeAddress, network) {
    const { data: existingTxs, error } = await supabase
      .from('results')
      .select('id, result, scanned_at')
      .eq('safe_address', safeAddress)
      .eq('network', network);
      
    if (error) {
      console.error('Error checking existing transactions:', error.message);
      throw error;
    }
    
    return existingTxs || [];
  }
  
  /**
   * Save a new transaction to the database
   * 
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @param {Object} transaction The transaction object
   * @param {string} description Human-readable description of the transaction
   * @param {string} type Type of transaction (normal or suspicious)
   * @returns {Promise<void>}
   */
  async saveTransaction(safeAddress, network, transaction, description, type) {
    const safeTxHash = transaction.safeTxHash;
    const timestamp = new Date().toISOString();
    
    const { error } = await supabase.from('results').insert({
      safe_address: safeAddress,
      network: network,
      result: {
        transaction_hash: safeTxHash,
        transaction_data: transaction,
        description: description,
        type: type
      },
      scanned_at: timestamp
    });
    
    if (error) {
      console.error('DB error saving transaction:', error.message);
      throw error;
    }
    
    return;
  }
  
  /**
   * Check if a notification has already been sent for a transaction
   * 
   * @param {string} transactionHash The transaction hash
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @returns {Promise<boolean>} True if a notification has already been sent
   */
  async hasNotificationBeenSent(transactionHash, safeAddress, network) {
    try {
      const { data: existingNotification, error } = await supabase
        .from('notification_status')
        .select('id')
        .eq('transaction_hash', transactionHash)
        .eq('safe_address', safeAddress)
        .eq('network', network)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not "no rows found" error
        console.error('Error checking notification status:', error);
        return true; // Assume already sent to avoid duplicate notifications
      }
      
      return !!existingNotification;
    } catch (err) {
      console.error('Error checking notification status:', err.message);
      return true; // Assume already sent to avoid duplicate notifications
    }
  }
  
  /**
   * Record that a notification was sent for a transaction
   * 
   * @param {string} transactionHash The transaction hash
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @param {string} transactionType The transaction type
   * @param {number} monitorId The monitor ID
   * @returns {Promise<void>}
   */
  async recordNotification(transactionHash, safeAddress, network, transactionType, monitorId) {
    try {
      await supabase.from('notification_status').insert({
        transaction_hash: transactionHash,
        safe_address: safeAddress,
        network: network,
        notified_at: new Date().toISOString(),
        transaction_type: transactionType,
        monitor_id: monitorId
      });
      
      console.log(`Recorded notification for monitor ${monitorId}, transaction ${transactionHash}`);
    } catch (error) {
      console.error('Failed to record notification status:', error.message);
      throw error;
    }
  }
  
  /**
   * Get notification status for transactions on a specific safe and network
   * 
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @returns {Promise<Array>} Array of notification statuses
   */
  async getNotificationStatus(safeAddress, network) {
    const { data: notifiedTxs, error } = await supabase
      .from('notification_status')
      .select('transaction_hash')
      .in('safe_address', [safeAddress])
      .in('network', [network]);
    
    if (error) {
      console.error('Error checking notification status:', error.message);
      throw error;
    }
    
    return notifiedTxs || [];
  }
}

module.exports = new DatabaseService();
