/**
 * Function to detect if a transaction is related to Safe management/configuration
 * These include owner management, threshold changes, module management, guard settings, etc.
 * 
 * @param {Object} transaction The transaction object from the Safe API
 * @returns {boolean} True if the transaction is a management transaction
 */
function isManagementTransaction(transaction) {
  // Skip if no decoded data (most likely a simple transfer)
  if (!transaction.dataDecoded) {
    return false;
  }
  
  // Define management-related methods
  const managementMethods = [
    // Owner management
    'addOwnerWithThreshold',
    'removeOwner',
    'swapOwner',
    'changeThreshold',
    
    // Module management
    'enableModule',
    'disableModule',
    
    // Guard management
    'setGuard',
    
    // Fallback management
    'setFallbackHandler',
    
    // Other Safe management functions
    'changeMasterCopy',
    'setup',
    'execTransactionFromModule',
    'execTransactionFromModuleReturnData',
    'approveHash',
    'setStorageAt'
  ];
  
  // Check if the transaction method is in our list of management methods
  return managementMethods.includes(transaction.dataDecoded.method);
}

/**
 * Function to detect suspicious transactions based on simple criteria
 * 
 * @param {Object} transaction The transaction object from the Safe API
 * @param {string} safeAddress The Safe address being monitored
 * @returns {boolean} True if the transaction is suspicious
 */
function detectSuspiciousActivity(transaction, safeAddress) {
  // This is a simple placeholder implementation
  // In a real system, you'd have more sophisticated detection logic
  
  // Examples of suspicious activities to check for:
  // 1. Transfers to known blacklisted addresses
  // 2. Large value transfers
  // 3. Unusual contract interactions
  // 4. Transactions during unusual times
  // 5. Rapid succession of multiple transactions
  
  // Check for multiple signers being removed at once
  if (transaction.dataDecoded && 
      transaction.dataDecoded.method === 'removeOwner' &&
      transaction.dataDecoded.parameters) {
    return true;
  }
  
  return false;
}

/**
 * Helper function to create a simplified description of a transaction
 * 
 * @param {Object} transaction The transaction object from the Safe API
 * @returns {string} A human-readable description of the transaction
 */
function createTransactionDescription(transaction) {
  if (transaction.dataDecoded) {
    return `${transaction.dataDecoded.method} operation`;
  } else if (transaction.value && parseInt(transaction.value) > 0) {
    return `Transfer of ${parseFloat(transaction.value) / 1e18} ETH`;
  }
  
  return 'Unknown transaction';
}

/**
 * Helper function to determine if a transaction is newer than a monitor
 * 
 * @param {Object} transaction The transaction object from the Safe API
 * @param {Object} monitor The monitor configuration object
 * @returns {boolean} True if the transaction is newer than the monitor
 */
function isTransactionNewerThanMonitor(transaction, monitor) {
  try {
    // Get transaction submission timestamp
    const txTimestamp = transaction.submissionDate || transaction.executionDate || null;
    if (!txTimestamp) {
      // If no timestamp can be found, assume it's an old transaction
      return false;
    }
    
    // Get monitor creation time
    const monitorCreatedAt = monitor.created_at;
    if (!monitorCreatedAt) {
      // If we can't determine when the monitor was created, be cautious and don't notify
      return false;
    }
    
    // Compare timestamps (both in ISO format)
    return new Date(txTimestamp) > new Date(monitorCreatedAt);
  } catch (err) {
    console.error('Error comparing timestamps:', err.message);
    // If we encounter an error, don't notify
    return false;
  }
}

module.exports = {
  isManagementTransaction,
  detectSuspiciousActivity,
  createTransactionDescription,
  isTransactionNewerThanMonitor
};
