// index.js
const cron = require('node-cron');
const axios = require('axios');
const supabase = require('./supabase');
require('dotenv').config();

// Define Safe API version
const SAFE_API_VERSION = 'v2';

// API endpoints for different networks
const NETWORK_CONFIGS = {
  'ethereum': {
    txServiceUrl: 'https://safe-transaction-mainnet.safe.global',
    chainId: 1,
    name: 'Ethereum Mainnet'
  },
  'polygon': {
    txServiceUrl: 'https://safe-transaction-polygon.safe.global',
    chainId: 137,
    name: 'Polygon'
  },
  'arbitrum': {
    txServiceUrl: 'https://safe-transaction-arbitrum.safe.global',
    chainId: 42161,
    name: 'Arbitrum'
  },
  'optimism': {
    txServiceUrl: 'https://safe-transaction-optimism.safe.global',
    chainId: 10,
    name: 'Optimism'
  },
  'goerli': {
    txServiceUrl: 'https://safe-transaction-goerli.safe.global',
    chainId: 5,
    name: 'Goerli Testnet'
  },
  'sepolia': {
    txServiceUrl: 'https://safe-transaction-sepolia.safe.global',
    chainId: 11155111,
    name: 'Sepolia Testnet'
  }
};


// Function to detect suspicious transactions based on simple criteria
function detectSuspiciousActivity(transaction, safeAddress) {
  // This is a simple placeholder implementation
  // In a real system, you'd have more sophisticated detection logic
  
  // Examples of suspicious activities to check for:
  // 1. Transfers to known blacklisted addresses
  // 2. Large value transfers
  // 3. Unusual contract interactions
  // 4. Transactions during unusual times
  // 5. Rapid succession of multiple transactions
  
  // For this example, we'll just check for large value transfers
  if (transaction.value && parseInt(transaction.value) > 1000000000000000000) { // > 1 ETH
    return true;
  }
  
  // Check for multiple signers being removed at once
  if (transaction.dataDecoded && 
      transaction.dataDecoded.method === 'removeOwner' &&
      transaction.dataDecoded.parameters) {
    return true;
  }
  
  // Random suspicious flag for demo purposes (10% of transactions)
  return Math.random() < 0.1;
}

// Main function to check transactions
async function checkTransactions() {
  // console.log('Checking transactions...');

  try {
    // Get unique address + network combinations from all active monitors
    // console.log('Fetching unique Safe addresses to monitor...');
    const { data: monitors, error } = await supabase
      .from('monitors')
      .select('id, safe_address, network, settings')
      .filter('settings->active', 'neq', false); // Get all active monitors
    
    if (error) {
      console.error('Error fetching monitors:', error.message);
      return;
    }
    
    // console.log(`Found ${monitors?.length || 0} active monitors`);
    
    if (!monitors || monitors.length === 0) {
      console.log('No active monitors found. Exiting check.');
      return;
    }
    
    // Group monitors by safe_address+network combination
    // This way we only scan each unique address+network pair once
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
    
    // Now process each unique address+network combination
    const uniqueAddressNetworkPairs = Object.values(addressNetworkMap);
    // console.log(`Processing ${uniqueAddressNetworkPairs.length} unique Safe address + network combinations`);
    
    for (const pair of uniqueAddressNetworkPairs) {
      const { safe_address, network, monitors: relatedMonitors } = pair;
      
      console.log(`\nProcessing Safe ${safe_address} on ${network}...`);
      
      // Skip if the network is not supported
      if (!NETWORK_CONFIGS[network]) {
        console.error(`Unsupported network: ${network} for Safe ${safe_address}`);
        continue;
      }
      
      const txServiceUrl = NETWORK_CONFIGS[network].txServiceUrl;
      
      try {
        // Get all transactions for the Safe
        // console.log(`Fetching transactions from Safe API for ${safe_address}...`);
        let allTransactions;
        
        // Variable to track if the Safe exists
        let safeInfo = null;
        
        try {
          // console.log(`Calling Safe API with URL: ${NETWORK_CONFIGS[network].txServiceUrl}`);
          // console.log(`Full Safe address being checked: ${safe_address}`);
          
          try {
            // Add debugging request to get Safe info to verify it exists
            const safeInfoResponse = await axios.get(`${NETWORK_CONFIGS[network].txServiceUrl}/api/v1/safes/${safe_address}`, {
              headers: {
                'accept': 'application/json'
              }
            });
            safeInfo = safeInfoResponse.data;
            console.log(`Safe info found:`, JSON.stringify(safeInfo).substring(0, 200) + '...');
          } catch (infoError) {
            console.error(`Error getting Safe info: ${infoError.message}`);
            console.error(`Safe API may not recognize this Safe address on ${network}`);
          }
          
          // Use direct API call with the official Safe Transaction Service API
          const response = await axios.get(`${txServiceUrl}/api/${SAFE_API_VERSION}/safes/${safe_address}/multisig-transactions/`, {
            headers: {
              'accept': 'application/json'
            }
          });
          allTransactions = response.data;
          console.log(`Received ${allTransactions.results?.length || 0} transactions from Safe API`);
        } catch (safeApiError) {
          console.error(`Safe API error for ${safe_address} on ${network}:`, safeApiError.message);
          console.error(`Error details:`, safeApiError.response?.data || 'No additional error details');
          
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
          
          const lastCheckTimestamp = new Date().toISOString();
          
          // Just log the error, no need to store it in the database
          console.log(`Status: ${errorStatus} for ${safe_address} on ${network}`);
          
          continue; // Skip to the next address + network pair
        }
        
        const timestamp = new Date().toISOString();
        
        // First, check how many transactions we already have in the database for this safe+network
        const { data: existingTxs, error: countError } = await supabase
          .from('results')
          .select('id, result')
          .eq('safe_address', safe_address)
          .eq('network', network);
          
        if (countError) {
          console.error('Error checking existing transactions:', countError.message);
        } else {
          // Count transactions (excluding status records and other non-transaction records)
          const existingTransactionCount = existingTxs?.filter(item => 
            item.result && item.result.transaction_hash
          ).length || 0;
          
          // If transaction counts match, we can skip processing
          if (existingTransactionCount === allTransactions.results.length) {
            console.log(`All ${existingTransactionCount} transactions for Safe ${safe_address} on ${network} already processed. Skipping transaction processing.`);
            
            // No need to store status in the database
            // console.log(`All transactions already processed for ${safe_address} on ${network}`);
            
            continue; // Skip to the next address + network pair
          }
          
          console.log(`Processing ${allTransactions.results.length} transactions (${existingTransactionCount} already in database)`);
        }
        
        // Process each transaction
        for (const transaction of allTransactions.results) {
          // Extract the safeTxHash - ensure consistent handling between SafeApiKit and direct API
          const safeTxHash = transaction.safeTxHash;
          // console.log(`Processing transaction ${safeTxHash}`);
          
          // Check if this transaction has already been processed for this safe_address + network
          // Using a text-based comparison instead of JSON path
          const { data: existingTxs, error: txError } = await supabase
            .from('results')
            .select('id, result')
            .eq('safe_address', safe_address)
            .eq('network', network);
          
          if (txError) {
            console.error('Error checking existing transaction:', txError.message);
            continue;
          }
          
          // Check if any of the results has this transaction hash
          const existingTx = existingTxs?.find(item => 
            item.result && 
            item.result.transaction_hash === safeTxHash
          );
          
          // Skip if transaction has already been processed
          if (existingTx) {
            // console.log(`Transaction ${transaction.safeTxHash} already processed, skipping`);
            continue;
          }
          
          // console.log(`New transaction found for Safe ${safe_address}: ${safeTxHash}`);
          
          // Determine if the transaction is suspicious
          const isSuspicious = detectSuspiciousActivity(transaction, safe_address);
          const txType = isSuspicious ? 'suspicious' : 'normal';
          // console.log(`Transaction ${safeTxHash} classified as ${txType}`);
          
          // Create a simplified description of the transaction
          let description = 'Unknown transaction';
          
          if (transaction.dataDecoded) {
            description = `${transaction.dataDecoded.method} operation`;
          } else if (transaction.value && parseInt(transaction.value) > 0) {
            description = `Transfer of ${parseFloat(transaction.value) / 1e18} ETH`;
          }
          
          // Save result to Supabase
          // console.log(`Saving transaction ${safeTxHash} to database...`);
          const { error: dbError } = await supabase.from('results').insert({
            safe_address: safe_address,
            network: network,
            result: {
              transaction_hash: safeTxHash,
              transaction_data: transaction,
              description: description,
              type: txType
            },
            scanned_at: timestamp
          });
          
          if (dbError) {
            console.error('DB error saving transaction:', dbError.message);
            continue;
          }
          
          console.log(`Transaction ${safeTxHash} saved successfully`);
          
          // Send notifications for each monitor if suspicious
          if (isSuspicious) {
            for (const monitor of relatedMonitors) {
              if (monitor.settings.notify && monitor.settings.notifications?.length > 0) {
                try {
                  console.log(`Sending notification for monitor ${monitor.id} for suspicious transaction ${safeTxHash}`);
                  
                  // Process each notification method
                  for (const notification of monitor.settings.notifications) {
                    const method = notification.method;
                    console.log(`Using notification method: ${method}`);
                    
                    // Implement notification logic based on method
                    switch (method) {
                      case 'email':
                        // Email notification logic
                        console.log(`Would send email to ${notification.email}`);
                        break;
                      case 'webhook':
                      case 'discord':
                      case 'slack':
                        // Webhook notification logic
                        if (notification.webhookUrl) {
                          console.log(`Would send webhook to ${notification.webhookUrl}`);
                          // Uncomment to actually send webhook notifications
                          /*
                          try {
                            await axios.post(notification.webhookUrl, {
                              safeAddress: safe_address,
                              txHash: safeTxHash,
                              network: network,
                              description: description,
                              type: txType
                            });
                          } catch (webhookError) {
                            console.error(`Webhook notification error:`, webhookError.message);
                          }
                          */
                        }
                        break;
                      case 'telegram':
                        // Telegram notification logic
                        console.log(`Would send Telegram notification to chat ${notification.chatId}`);
                        break;
                    }
                  }
                } catch (notificationError) {
                  console.error('Notification error:', notificationError.message);
                }
              }
            }
          }
        }
        
        // No status tracking needed - we're done processing transactions
        console.log(`Completed processing for ${safe_address} on ${network}`);
        
      } catch (error) {
        console.error(`Error processing ${safe_address} on ${network}:`, error.message);
        
        // Record the error
        try {
          // Just log the error, no need to store it
          console.log(`Error state for ${safe_address} on ${network}: ${error.message}`);
        } catch (recordError) {
          console.error('Failed to record error state:', recordError.message);
        }
      }
    }
    
    // console.log('Transaction check completed');
    
  } catch (error) {
    console.error('Unexpected error in checkTransactions:', error);
  }
}

// Run immediately on startup
console.log('Starting Safe monitoring service...');
checkTransactions();

// Schedule the task to run every minute
// console.log('Setting up cron schedule for every minute');
cron.schedule('* * * * *', checkTransactions);
