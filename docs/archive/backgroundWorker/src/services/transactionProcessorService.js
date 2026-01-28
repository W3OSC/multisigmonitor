const { 
  isManagementTransaction, 
  detectSuspiciousActivity, 
  createTransactionDescription,
  isTransactionNewerThanMonitor
} = require('../utils/transactionUtils');
const safeApiService = require('./safeApiService');
const databaseService = require('./databaseService');
const notificationService = require('../notifications/notificationService');
const { NETWORK_CONFIGS } = require('../config/networks');

/**
 * Service for processing Safe transactions
 */
class TransactionProcessorService {
  /**
   * Process all monitored Safes
   * 
   * @returns {Promise<void>}
   */
  async processAllMonitors() {
    console.log('Checking transactions...');

    try {
      // Get unique address + network combinations from all active monitors
      const monitors = await databaseService.getActiveMonitors();
      
      console.log(`Found ${monitors?.length || 0} active monitors`);
      
      if (!monitors || monitors.length === 0) {
        console.log('No active monitors found. Exiting check.');
        return;
      }
      
      // Group monitors by safe_address+network combination
      // This way we only scan each unique address+network pair once
      const addressNetworkMap = this.groupMonitorsByAddressAndNetwork(monitors);
      
      // Now process each unique address+network combination
      const uniqueAddressNetworkPairs = Object.values(addressNetworkMap);
      console.log(`Processing ${uniqueAddressNetworkPairs.length} unique Safe address + network combinations`);
      
      for (const pair of uniqueAddressNetworkPairs) {
        await this.processSafeAddressNetworkPair(pair);
      }
      
      console.log('Transaction check completed');
    } catch (error) {
      console.error('Unexpected error in processAllMonitors:', error);
    }
  }

  /**
   * Group monitors by unique safe address and network combinations
   * 
   * @param {Array} monitors Array of monitor configurations
   * @returns {Object} Grouped monitors by address and network
   */
  groupMonitorsByAddressAndNetwork(monitors) {
    const addressNetworkMap = {};
    monitors.forEach(monitor => {
      const key = `${monitor.safe_address.toLowerCase()}-${monitor.network.toLowerCase()}`;
      if (!addressNetworkMap[key]) {
        addressNetworkMap[key] = {
          safe_address: monitor.safe_address,
          network: monitor.network.toLowerCase(),
          monitors: []
        };
      }
      addressNetworkMap[key].monitors.push(monitor);
    });
    return addressNetworkMap;
  }

  /**
   * Process a single Safe address and network combination
   * 
   * @param {Object} pair The safe address and network pair with related monitors
   * @returns {Promise<void>}
   */
  async processSafeAddressNetworkPair(pair) {
    const { safe_address, network, monitors: relatedMonitors } = pair;
    
    console.log(`\nProcessing Safe ${safe_address} on ${network}...`);
    
    try {
      // Update last check timestamp
      await databaseService.updateLastCheckTimestamp(safe_address, network);
      
      // Get the timestamp of the last check
      const lastCheckData = await databaseService.getLastCheckTimestamp(safe_address, network);
      
      // Use transaction_last_found timestamp if available for modifiedSince param
      let modifiedSinceParam = null;
      if (lastCheckData && lastCheckData.transaction_last_found) {
        modifiedSinceParam = new Date(lastCheckData.transaction_last_found).toISOString();
        console.log(`Fetching transactions modified since last found transaction: ${modifiedSinceParam}`);
      } else {
        console.log(`No previous transaction found, fetching all transactions`);
      }
      
      // Variable to track if the Safe exists
      let safeInfo = null;
      
      // First try to get Safe info to verify it exists
      try {
        safeInfo = await safeApiService.getSafeInfo(safe_address, network);
        console.log(`Safe info found for ${safe_address} on ${network}`);
      } catch (infoError) {
        console.error(`Error getting Safe info: ${infoError.message}`);
        console.error(`Safe API may not recognize this Safe address on ${network}`);
      }
      
      // Get transactions from Safe API
      let allTransactions;
      try {
        allTransactions = await safeApiService.getSafeTransactions(safe_address, network, modifiedSinceParam);
        console.log(`Received ${allTransactions.results?.length || 0} transactions from Safe API${modifiedSinceParam ? ' modified since last check' : ''}`);
      } catch (safeApiError) {
        // Different handling when the Safe exists but has no transactions
        let errorStatus = 'api_error';
        let errorMessage = safeApiError.message;
        
        // If we successfully got Safe info but no transactions, report it as "no transactions" rather than "not found"
        if (safeInfo && safeApiError.message === 'Not Found') {
          errorStatus = 'no_transactions'; 
          errorMessage = 'Safe exists but no transactions were found';
          console.log(`Safe ${safe_address} exists but has no transactions recorded in the transaction service`);
        } else if (safeApiError.message === 'Not Found') {
          errorStatus = 'safe_not_found';
        }
        
        console.log(`Status: ${errorStatus} for ${safe_address} on ${network}`);
        return; // Skip to the next address + network pair
      }
      
      // Check existing transactions in the database
      const existingTxs = await databaseService.getExistingTransactions(safe_address, network);
      
      // Count transactions (excluding status records and other non-transaction records)
      const existingTransactionCount = existingTxs?.filter(item => 
        item.result && item.result.transaction_hash
      ).length || 0;
      
      // // Process test transactions if needed
      // if (existingTransactionCount > allTransactions.results.length) {
      //   await this.processTestTransactions(existingTxs, allTransactions, safe_address, network, lastCheckData, relatedMonitors);
      // }
      
      // Process transactions from Safe API
      for (const transaction of allTransactions.results) {
        await this.processTransaction(transaction, safe_address, network, existingTxs, relatedMonitors, safeInfo);
      }
      
      console.log(`Completed processing for ${safe_address} on ${network}`);
    } catch (error) {
      console.error(`Error processing ${safe_address} on ${network}:`, error.message);
    }
  }

  // /**
  //  * Process test transactions (those in database but not in API results)
  //  * 
  //  * @param {Array} existingTxs Existing transactions in the database
  //  * @param {Object} allTransactions Transactions from Safe API
  //  * @param {string} safeAddress The Safe address
  //  * @param {string} network The network
  //  * @param {Object} lastCheckData Last check timestamp data
  //  * @param {Array} relatedMonitors Related monitors for this Safe address and network
  //  * @returns {Promise<void>}
  //  */
  // async processTestTransactions(existingTxs, allTransactions, safeAddress, network, lastCheckData, relatedMonitors) {
  //   // Build hash map of known transaction hashes from Safe API
  //   const apiTxHashes = new Set(allTransactions.results.map(tx => tx.safeTxHash));
    

    
  //   // Check for unprocessed test transactions
  //   const notifiedTxs = await databaseService.getNotificationStatus(safeAddress, network);
    
  //   const notifiedHashes = new Set(notifiedTxs.map(item => item.transaction_hash));
    
  //   // Only process test transactions that:
  //   // 1. Haven't been notified yet
  //   // 2. Were created or updated since the last check
  //   // This prevents repeated processing of old test transactions
  //   const unnotifiedTests = testTransactions.filter(item => {
  //     // Skip if already notified
  //     if (notifiedHashes.has(item.result.transaction_hash)) {
  //       return false;
  //     }
      
  //     // If we have a timestamp from the last check and the result has a scanned_at field
  //     if (lastCheckData?.checked_at && item.scanned_at) {
  //       // Compare the timestamps to see if this test transaction is newer than the last check
  //       const lastCheckTime = new Date(lastCheckData.checked_at).getTime();
  //       const itemTimestamp = new Date(item.scanned_at).getTime();
  //       return itemTimestamp > lastCheckTime;
  //     }
      
  //     // If we can't determine timing, include it as unnotified
  //     return true;
  //   });
    
  //   if (unnotifiedTests.length > 0) {
  //     console.log(`Found ${unnotifiedTests.length} unnotified test transactions`);
      
  //     // Process these test transactions specially
  //     for (const testTx of unnotifiedTests) {
  //       console.log(`Processing test transaction ${testTx.result.transaction_hash}`);
        
  //       const txType = testTx.result.type || 'normal';
  //       const isSuspicious = txType === 'suspicious';
  //       const description = testTx.result.description || 'Test transaction';
        
  //       // Send notifications for this test transaction
  //       for (const monitor of relatedMonitors) {
  //         // Get transaction data from the test transaction
  //         const transaction = testTx.result.transaction_data || {};
  //         const isManagement = transaction.dataDecoded ? 
  //           isManagementTransaction(transaction) : false;
          
  //         // Update transaction_last_found timestamp for test transactions too
  //         const testTimestamp = testTx.scanned_at || new Date().toISOString();
  //         await databaseService.updateTransactionLastFound(safeAddress, network, testTimestamp);
  //         console.log(`Updated transaction_last_found to ${testTimestamp} for test transaction on ${safeAddress} (${network})`);
          
  //         // Check if notification is appropriate based on monitor settings
  //         if (notificationService.shouldSendNotification(monitor, transaction, isSuspicious, isManagement)) {
  //           console.log(`TEST: Sending notification for ${testTx.result.transaction_hash}`);
            
  //           // Send the notification
  //           await notificationService.sendNotifications(
  //             monitor,
  //             { ...transaction, safeTxHash: testTx.result.transaction_hash },
  //             safeAddress,
  //             network,
  //             description,
  //             txType,
  //             true // Mark as test notification
  //           );
  //         }
  //       }
  //     }
  //   }
  // }

  /**
   * Process a single transaction
   * 
   * @param {Object} transaction The transaction from Safe API
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @param {Array} existingTxs Existing transactions in the database
   * @param {Array} relatedMonitors Related monitors for this Safe address and network
   * @param {Object} safeInfo Safe information including version
   * @returns {Promise<void>}
   */
  async processTransaction(transaction, safeAddress, network, existingTxs, relatedMonitors, safeInfo = null) {
    // Extract the safeTxHash
    const safeTxHash = transaction.safeTxHash;
    
    // Check if this transaction has already been processed for this safe_address + network
    const existingTx = existingTxs?.find(item => 
      item.result && 
      item.result.transaction_hash === safeTxHash
    );
    
    // Always update transaction_last_found regardless of whether it's a new transaction
    const timestamp = new Date().toISOString();
    await databaseService.updateTransactionLastFound(safeAddress, network, timestamp);
    
    // Prepare security analysis options with hash verification data
    const analysisOptions = {};
    
    // Add chain ID from network config
    const networkConfig = NETWORK_CONFIGS[network];
    if (networkConfig) {
      analysisOptions.chainId = networkConfig.chainId;
    }
    
    // Add Safe version if available
    if (safeInfo && safeInfo.version) {
      analysisOptions.safeVersion = safeInfo.version;
    }
    
    // Get previous nonce for sequence checking (from existing transactions)
    if (existingTxs && existingTxs.length > 0) {
      const transactionWithNonces = existingTxs
        .filter(item => item.result && item.result.transaction_data && 
                typeof item.result.transaction_data.nonce === 'number')
        .sort((a, b) => b.result.transaction_data.nonce - a.result.transaction_data.nonce);
      
      if (transactionWithNonces.length > 0) {
        analysisOptions.previousNonce = transactionWithNonces[0].result.transaction_data.nonce;
      }
    }
    
    // If transaction already exists, check if it needs to be updated
    if (existingTx) {
      const shouldUpdate = await this.shouldUpdateTransaction(transaction, existingTx, safeAddress, network);
      if (shouldUpdate) {
        // Update the existing transaction with new data
        console.log(`Updating existing transaction ${safeTxHash} with new data`);
        
        // Perform enhanced security analysis with hash verification
        const securityAnalysis = require('./securityAnalysisService');
        const analysis = securityAnalysis.analyzeTransaction(transaction, safeAddress, analysisOptions);
        
        // Determine if the transaction is suspicious based on analysis
        const isSuspicious = analysis.isSuspicious;
        const txType = isSuspicious ? 'suspicious' : 'normal';
        
        // Create a simplified description of the transaction
        const description = createTransactionDescription(transaction);
        
        // Update the transaction in database with security analysis
        await databaseService.updateTransaction(existingTx.id, safeAddress, network, transaction, description, txType, analysis);
        console.log(`Transaction ${safeTxHash} updated successfully with enhanced security analysis`);
        
        // Continue to check for notifications
      } else {
        console.log(`Transaction ${safeTxHash} already processed, no changes detected`);
        return;
      }
    } else {
      // This is a new transaction we haven't seen before
      console.log(`New transaction found for Safe ${safeAddress}: ${safeTxHash}`);
      
      // Perform enhanced security analysis with hash verification
      const securityAnalysis = require('./securityAnalysisService');
      const analysis = securityAnalysis.analyzeTransaction(transaction, safeAddress, analysisOptions);
      
      // Determine if the transaction is suspicious based on analysis
      const isSuspicious = analysis.isSuspicious;
      const txType = isSuspicious ? 'suspicious' : 'normal';
      console.log(`Transaction ${safeTxHash} classified as ${txType} with ${analysis.riskLevel} risk level`);
      
      // Create a simplified description of the transaction
      const description = createTransactionDescription(transaction);
      
      // Save result to database with security analysis
      await databaseService.saveTransaction(safeAddress, network, transaction, description, txType, analysis);
      console.log(`Transaction ${safeTxHash} saved successfully with enhanced security analysis`);
    }
    
    // Transaction processing continues for all transactions...
    
    // Check if we should send notifications
    const needsNotification = !(await databaseService.hasNotificationBeenSent(safeTxHash, safeAddress, network));
    
    if (needsNotification) {
      for (const monitor of relatedMonitors) {
        // Only send notifications if the transaction is newer than the monitor
        // This prevents notifications for historical transactions when a new monitor is added
        if (isTransactionNewerThanMonitor(transaction, monitor)) {
          console.log(`Transaction date: ${transaction.submissionDate || transaction.executionDate}, Monitor created: ${monitor.created_at}`);
          
          const isManagement = isManagementTransaction(transaction);
          // Get the suspicious status (need to detect it again in this scope)
          const isSuspicious = detectSuspiciousActivity(transaction, safeAddress);
          // Get transaction description (need to create it again in this scope)
          const description = createTransactionDescription(transaction);
          // Get transaction type from suspicious status
          const txType = isSuspicious ? 'suspicious' : 'normal';
          
          // Check if notification is appropriate based on monitor settings
          // Get the security analysis if available for special event handling
          const securityAnalysis = require('./securityAnalysisService');
          const analysis = securityAnalysis.analyzeTransaction(transaction, safeAddress, analysisOptions);
          
          if (notificationService.shouldSendNotification(monitor, transaction, isSuspicious, isManagement, analysis)) {
            // Send notifications
            await notificationService.sendNotifications(
              monitor,
              transaction,
              safeAddress,
              network,
              description,
              txType
            );
          }
        }
      }
    }
  }
  /**
   * Check if a transaction needs to be updated by comparing it with the existing data
   * 
   * @param {Object} transaction The transaction from Safe API
   * @param {Object} existingTx The existing transaction from the database
   * @param {string} safeAddress The Safe address
   * @param {string} network The network
   * @returns {Promise<boolean>} True if the transaction should be updated
   */
  async shouldUpdateTransaction(transaction, existingTx, safeAddress, network) {
    try {
      // Extract existing transaction data
      const existingData = existingTx.result.transaction_data || {};
      
      // Check for changes in key properties that might require an update
      const isExecutionChanged = existingData.isExecuted !== transaction.isExecuted;
      const isConfirmationsChanged = 
        !existingData.confirmations || 
        !transaction.confirmations || 
        existingData.confirmations.length !== transaction.confirmations.length;
      const isExecutionDateChanged = existingData.executionDate !== transaction.executionDate;
      const isTransactionHashChanged = existingData.transactionHash !== transaction.transactionHash;
      
      // If any significant property has changed, we should update
      return isExecutionChanged || isConfirmationsChanged || isExecutionDateChanged || isTransactionHashChanged;
    } catch (error) {
      console.error(`Error comparing transactions: ${error.message}`);
      // If we encounter an error during comparison, update to be safe
      return true;
    }
  }
}

module.exports = new TransactionProcessorService();
