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
 * Function to detect suspicious transactions using comprehensive security analysis
 * 
 * @param {Object} transaction The transaction object from the Safe API
 * @param {string} safeAddress The Safe address being monitored
 * @returns {boolean} True if the transaction is suspicious
 */
function detectSuspiciousActivity(transaction, safeAddress) {
  try {
    const securityAnalysis = require('../services/securityAnalysisService');
    const analysis = securityAnalysis.analyzeTransaction(transaction, safeAddress);
    
    // Log detailed analysis for monitoring purposes
    if (analysis.warnings.length > 0) {
      console.log(`Security analysis for transaction ${transaction.safeTxHash}:`);
      console.log(`- Risk Level: ${analysis.riskLevel.toUpperCase()}`);
      console.log(`- Warnings: ${analysis.warnings.join(', ')}`);
      if (analysis.details.length > 0) {
        console.log('- Details:');
        analysis.details.forEach(detail => {
          console.log(`  * [${detail.severity.toUpperCase()}] ${detail.message}`);
        });
      }
    }
    
    return analysis.isSuspicious;
  } catch (error) {
    console.error('Error in security analysis:', error);
    
    // Fallback to basic detection if security analysis fails
    if (transaction.dataDecoded && 
        transaction.dataDecoded.method === 'removeOwner' &&
        transaction.dataDecoded.parameters) {
      return true;
    }
    
    return false;
  }
}

/**
 * Helper function to create a simplified description of a transaction
 * 
 * @param {Object} transaction The transaction object from the Safe API
 * @returns {string} A human-readable description of the transaction
 */
function createTransactionDescription(transaction) {
  let description = '';
  
  // Base description
  if (transaction.dataDecoded) {
    description = `${transaction.dataDecoded.method} operation`;
  } else if (transaction.value && parseInt(transaction.value) > 0) {
    const ethValue = parseFloat(transaction.value) / 1e18;
    description = `Transfer of ${ethValue} ETH`;
  } else {
    description = 'Unknown transaction';
  }
  
  // Add security context if available
  try {
    const securityAnalysis = require('../services/securityAnalysisService');
    const analysis = securityAnalysis.analyzeTransaction(transaction, '');
    
    if (analysis.warnings.length > 0) {
      description += ` [${analysis.riskLevel.toUpperCase()} RISK: ${analysis.warnings.join(', ')}]`;
    }
  } catch (error) {
    // Silently fail if security analysis is not available
  }
  
  return description;
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
