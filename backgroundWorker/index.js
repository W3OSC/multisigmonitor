// index.js
const cron = require('node-cron');
const axios = require('axios');
const supabase = require('./supabase');
const { Resend } = require('resend');
const { 
  generateTransactionEmailHtml, 
  generateTransactionEmailText 
} = require('./email-templates');
const {
  generateDiscordWebhook,
  generateSlackWebhook,
  generateGenericWebhook
} = require('./webhook-templates');
require('dotenv').config();

// Configure Resend for email sending
let resend = null;
try {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend library initialized with API key');
  } else {
    console.log('⚠️ Resend API key not found. Email notifications will be logged but not sent.');
  }
} catch (err) {
  console.error('❌ Error initializing Resend client:', err.message);
}

const defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || 'notifications@safemonitor.io';
console.log(`📧 Default from email configured as: ${defaultFromEmail}`);

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
  
  
  // Check for multiple signers being removed at once
  if (transaction.dataDecoded && 
      transaction.dataDecoded.method === 'removeOwner' &&
      transaction.dataDecoded.parameters) {
    return true;
  }
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
          
          // Update the last_checks table with the current timestamp
          try {
            // First check if a record already exists
            const { data: existingCheck } = await supabase
              .from('last_checks')
              .select('id')
              .eq('safe_address', safe_address)
              .eq('network', network)
              .single();
              
            const currentTimestamp = new Date().toISOString();
            
            if (existingCheck) {
              // Update existing record
              await supabase
                .from('last_checks')
                .update({ 
                  checked_at: currentTimestamp  // Update checked_at for frontend display
                })
                .eq('id', existingCheck.id);
                
              console.log(`Updated last check timestamp for ${safe_address} on ${network}`);
            } else {
              // Create new record
              await supabase
                .from('last_checks')
                .insert({
                  safe_address: safe_address,
                  network: network,
                  checked_at: currentTimestamp  // Set checked_at for frontend display
                });
                
              console.log(`Created new last check timestamp for ${safe_address} on ${network}`);
            }
          } catch (timestampError) {
            console.error(`Error updating last check timestamp: ${timestampError.message}`);
          }
      
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
        
        // Get the timestamp of the last transaction found for this Safe address + network combination
        let lastCheckData = null;
        let modifiedSinceParam = null;
        try {
          const { data } = await supabase
            .from('last_checks')
            .select('checked_at, transaction_last_found')
            .eq('safe_address', safe_address)
            .eq('network', network)
            .single();
          
          lastCheckData = data;
          
          // Use transaction_last_found if available, otherwise fall back to checked_at
          if (lastCheckData && lastCheckData.transaction_last_found) {
            modifiedSinceParam = lastCheckData.transaction_last_found;
            console.log(`Fetching transactions modified since last transaction found: ${modifiedSinceParam}`);
          } else if (lastCheckData && lastCheckData.checked_at) {
            modifiedSinceParam = lastCheckData.checked_at;
            console.log(`No last transaction timestamp, using last check time: ${modifiedSinceParam}`);
          } else {
            console.log(`No previous check found, fetching all transactions`);
          }
        } catch (lastCheckError) {
          console.error(`Error getting last check data: ${lastCheckError.message}`);
          console.log(`No previous check found, fetching all transactions`);
        }

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
            // console.log(`Safe info found:`, JSON.stringify(safeInfo).substring(0, 200) + '...');
          } catch (infoError) {
            console.error(`Error getting Safe info: ${infoError.message}`);
            console.error(`Safe API may not recognize this Safe address on ${network}`);
          }
          
          // Use direct API call with the official Safe Transaction Service API
          // If we have a last check timestamp, only fetch transactions modified since then
          const params = modifiedSinceParam ? { modified__gte: modifiedSinceParam } : {};
          const response = await axios.get(`${txServiceUrl}/api/${SAFE_API_VERSION}/safes/${safe_address}/multisig-transactions/`, {
            headers: {
              'accept': 'application/json'
            },
            params: params
          });
          allTransactions = response.data;
          console.log(`Received ${allTransactions.results?.length || 0} transactions from Safe API${modifiedSinceParam ? ' modified since last check' : ''}`);
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
          .select('id, result, scanned_at')
          .eq('safe_address', safe_address)
          .eq('network', network);
          
        if (countError) {
          console.error('Error checking existing transactions:', countError.message);
        } else {
          // Count transactions (excluding status records and other non-transaction records)
          const existingTransactionCount = existingTxs?.filter(item => 
            item.result && item.result.transaction_hash
          ).length || 0;
          
          // Only skip if we have at least as many transactions from API as we do in our database
          // This accommodates test transactions that aren't in the Safe API results
          if (existingTransactionCount <= allTransactions.results.length) {
            console.log(`Processing ${allTransactions.results.length} transactions from Safe API plus any additional test transactions`);
          } else {
            // console.log(`Found ${existingTransactionCount} transactions in database (including test transactions)`);
            // console.log(`Safe API returned ${allTransactions.results.length} transactions`);
            
            // Build hash map of known transaction hashes from Safe API
            const apiTxHashes = new Set(allTransactions.results.map(tx => tx.safeTxHash));
            
            // Find test transactions (those in database but not in API results)
            const testTransactions = existingTxs.filter(item => 
              item.result && 
              item.result.transaction_hash && 
              !apiTxHashes.has(item.result.transaction_hash)
            );
            
            // console.log(`Found ${testTransactions.length} test transactions not in Safe API results`);
            
            // Check for unprocessed test transactions
            const { data: notifiedTxs, error: notifyError } = await supabase
              .from('notification_status')
              .select('transaction_hash')
              .in('safe_address', [safe_address])
              .in('network', [network]);
            
            if (notifyError) {
              console.error('Error checking notification status:', notifyError.message);
            } else {
              const notifiedHashes = new Set(notifiedTxs.map(item => item.transaction_hash));
              
              // Only process test transactions that:
              // 1. Haven't been notified yet
              // 2. Were created or updated since the last check
              // This prevents repeated processing of old test transactions
              const unnotifiedTests = testTransactions.filter(item => {
                // Skip if already notified
                if (notifiedHashes.has(item.result.transaction_hash)) {
                  return false;
                }
                
                // If we have a timestamp from the last check and the result has a scanned_at field
                if (lastCheckData?.checked_at && item.scanned_at) {
                  // Compare the timestamps to see if this test transaction is newer than the last check
                  const itemTimestamp = new Date(item.scanned_at).getTime();
                  const checkTimestamp = new Date(lastCheckData.checked_at).getTime();
                  return itemTimestamp > checkTimestamp;
                }
                
                // If we can't determine timing, include it as unnotified
                return true;
              });
              
              if (unnotifiedTests.length > 0) {
                console.log(`Found ${unnotifiedTests.length} unnotified test transactions`);
                
                // Process these test transactions specially
                for (const testTx of unnotifiedTests) {
                  console.log(`Processing test transaction ${testTx.result.transaction_hash}`);
                  
                  const txType = testTx.result.type || 'normal';
                  const isSuspicious = txType === 'suspicious';
                  const description = testTx.result.description || 'Test transaction';
                  
                  // Send notifications for this test transaction
                  for (const monitor of relatedMonitors) {
                    // Check if notification is appropriate
                    const notifyEnabled = monitor.settings?.notify || monitor.notify;
                    if (!notifyEnabled) continue;
                    
                    if (!monitor.settings?.notifications?.length) continue;
                    
                    // Get transaction data from the test transaction
                    const transaction = testTx.result.transaction_data || {};
                    const isManagement = transaction.dataDecoded ? 
                      isManagementTransaction(transaction) : false;
                    
                    // Check the alert type preference
                    const alertType = monitor.settings?.alertType || 'suspicious';
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
                    
                    if (shouldNotify) {
                      console.log(`TEST: Sending notification for ${testTx.result.transaction_hash}`);
                      
                      // Process each notification method
                      for (const notification of monitor.settings.notifications) {
                        const method = notification.method;
                        console.log(`TEST: Using notification method: ${method}`);
                        
                        // Get transaction data from the test transaction
                        const transaction = testTx.result.transaction_data || {};
                        const safeTxHash = testTx.result.transaction_hash;
                        
                        // Implement notification logic based on method
                        switch (method) {
                          case 'email':
                            // Email notification logic
                            try {
                              if (notification.email) {
                                console.log(`TEST: Sending email to ${notification.email}`);
                                
                                // Generate links
                                const safeAppLink = `https://app.safe.global/transactions/tx?safe=${network}:${safe_address}&id=multisig_${safe_address}_${safeTxHash}`;
                                const safeMonitorLink = `https://safemonitor.io/monitor/${safeTxHash}`;
                                const etherscanLink = transaction.isExecuted 
                                  ? `https://${network === 'ethereum' ? '' : network + '.'}etherscan.io/tx/${transaction.transactionHash || safeTxHash}`
                                  : null;
                                  
                                // Create email transaction info object
                                const txInfo = {
                                  safeAddress: safe_address,
                                  network: network,
                                  type: txType,
                                  description: description,
                                  hash: safeTxHash,
                                  nonce: transaction.nonce,
                                  isExecuted: transaction.isExecuted || false,
                                  safeAppLink,
                                  safeMonitorLink,
                                  etherscanLink,
                                  isTest: true // Mark as test email
                                };
                                
                                // Generate email content
                                const htmlContent = generateTransactionEmailHtml(txInfo);
                                const textContent = generateTransactionEmailText(txInfo);
                                
                                // Set subject based on transaction type
                                const subject = `[TEST] ${txType === 'suspicious' 
                                  ? '⚠️ SUSPICIOUS Safe Transaction Detected'
                                  : 'Safe Transaction Alert'}`;
                                
                                // Check if Resend is configured
                                if (process.env.RESEND_API_KEY) {
                                  try {
                                    const response = await resend.emails.send({
                                      from: defaultFromEmail,
                                      to: notification.email,
                                      subject: subject,
                                      html: htmlContent,
                                      text: textContent
                                    });
                                    
                                    console.log(`TEST: Email sent successfully to ${notification.email}, ID: ${response.id}`);
                                  } catch (emailSendError) {
                                    console.error(`TEST: Error sending email: ${emailSendError.message}`);
                                  }
                                } else {
                                  console.log(`TEST: Email sending is not configured. Would send email to ${notification.email}`);
                                  console.log(`TEST: Make sure RESEND_API_KEY is set in your .env file`);
                                }
                              } else {
                                console.log(`TEST: No email address configured for this notification`);
                              }
                            } catch (emailError) {
                              console.error(`TEST: Error sending email notification:`, emailError.message);
                            }
                            break;
                          case 'webhook':
                          case 'discord':
                          case 'slack':
                            // Webhook notification logic
                            try {
                              if (notification.webhookUrl) {
                                console.log(`TEST: Sending ${method} webhook to ${notification.webhookUrl}`);
                                
                                // Generate links
                                const safeAppLink = `https://app.safe.global/transactions/tx?safe=${network}:${safe_address}&id=multisig_${safe_address}_${safeTxHash}`;
                                const safeMonitorLink = `https://safemonitor.io/monitor/${safeTxHash}`;
                                const etherscanLink = transaction.isExecuted 
                                  ? `https://${network === 'ethereum' ? '' : network + '.'}etherscan.io/tx/${transaction.transactionHash || safeTxHash}`
                                  : null;
                                  
                                // Create transaction info object
                                const txInfo = {
                                  safeAddress: safe_address,
                                  network: network,
                                  type: txType,
                                  description: description,
                                  hash: safeTxHash,
                                  nonce: transaction.nonce,
                                  isExecuted: transaction.isExecuted || false,
                                  safeAppLink,
                                  safeMonitorLink,
                                  etherscanLink,
                                  isTest: true // Mark as test webhook
                                };
                                
                                // Generate appropriate webhook payload based on method
                                let webhookPayload;
                                const contentType = 'application/json';
                                
                                if (method === 'discord') {
                                  webhookPayload = generateDiscordWebhook(txInfo);
                                } else if (method === 'slack') {
                                  webhookPayload = generateSlackWebhook(txInfo);
                                } else {
                                  // Generic webhook
                                  webhookPayload = generateGenericWebhook(txInfo, safe_address, network);
                                }
                                
                                // Send the webhook
                                const response = await axios.post(notification.webhookUrl, webhookPayload, {
                                  headers: {
                                    'Content-Type': contentType
                                  }
                                });
                                
                                console.log(`TEST: ${method} webhook sent successfully to ${notification.webhookUrl}, status: ${response.status}`);
                              } else {
                                console.log(`TEST: No webhook URL configured for this notification`);
                              }
                            } catch (webhookError) {
                              console.error(`TEST: Error sending ${method} webhook notification:`, webhookError.message);
                              console.error(`TEST: Error details:`, webhookError.response?.data || 'No additional error details');
                            }
                            break;
                          case 'telegram':
                            // Telegram notification logic
                            try {
                              if (notification.botApiKey && notification.chatId) {
                                console.log(`TEST: Sending Telegram notification to chat ${notification.chatId}`);
                                
                                // Format transaction info
                                const txInfo = {
                                  safeAddress: safe_address,
                                  network: network,
                                  type: txType,
                                  description: description,
                                  hash: safeTxHash,
                                  nonce: transaction.nonce,
                                  isExecuted: transaction.isExecuted || false
                                };
                                
                                // Create message with markdown formatting
                                const safeAppLink = `https://app.safe.global/transactions/tx?safe=${network}:${safe_address}&id=multisig_${safe_address}_${safeTxHash}`;
                                const safeMonitorLink = `https://safemonitor.io/monitor/${safeTxHash}`;
                                const etherscanLink = transaction.isExecuted 
                                  ? `https://${network === 'ethereum' ? '' : network + '.'}etherscan.io/tx/${transaction.transactionHash || safeTxHash}`
                                  : null;
                                
                                let message = `🔔 *${txType === 'suspicious' ? '⚠️ SUSPICIOUS TRANSACTION' : 'New Transaction'}*\n\n`;
                                message += `*Network:* ${network}\n`;
                                message += `*Safe:* \`${safe_address}\`\n`;
                                message += `*Description:* ${description}\n`;
                                
                                if (txInfo.nonce !== undefined) {
                                  message += `*Nonce:* ${txInfo.nonce}\n`;
                                }
                                
                                message += `*Status:* ${txInfo.isExecuted ? '✅ Executed' : '⏳ Awaiting execution'}\n\n`;
                                message += `*View transaction:*\n`;
                                message += `- [Safe App](${safeAppLink})\n`;
                                message += `- [Safe Monitor](${safeMonitorLink})\n`;
                                
                                if (etherscanLink) {
                                  message += `- [Etherscan](${etherscanLink})\n`;
                                }
                                
                                message += `\n*Note:* This is a TEST transaction`;
                                
                                // Send the message
                                const telegramApiUrl = `https://api.telegram.org/bot${notification.botApiKey}/sendMessage`;
                                await axios.post(telegramApiUrl, {
                                  chat_id: notification.chatId,
                                  text: message,
                                  parse_mode: 'Markdown',
                                  disable_web_page_preview: true
                                });
                                
                                console.log(`TEST: Telegram notification sent successfully`);
                              } else {
                                console.log(`TEST: Missing Telegram credentials: botApiKey or chatId`);
                              }
                            } catch (telegramError) {
                              console.error(`TEST: Error sending Telegram notification:`, telegramError.message);
                            }
                            break;
                        }
                      }
                      
                      // Record notification
                      try {
                        await supabase.from('notification_status').insert({
                          transaction_hash: testTx.result.transaction_hash,
                          safe_address,
                          network,
                          notified_at: new Date().toISOString(),
                          transaction_type: txType,
                          monitor_id: monitor.id
                        });
                        console.log(`TEST: Recorded notification for monitor ${monitor.id}, transaction ${testTx.result.transaction_hash}`);
                      } catch (recordError) {
                        console.error('TEST: Failed to record notification status:', recordError.message);
                      }
                    }
                  }
                }
              }
            }
          }
          // if transaction length is greater than 0
          // console.log(`Processing ${allTransactions.results.length} transactions (${existingTransactionCount} already in database)`);
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
          
          // Update the transaction_last_found timestamp in the last_checks table
          try {
            const { data: lastCheckRecord } = await supabase
              .from('last_checks')
              .select('id')
              .eq('safe_address', safe_address)
              .eq('network', network)
              .single();
              
            if (lastCheckRecord) {
              await supabase
                .from('last_checks')
                .update({ 
                  transaction_last_found: new Date().toISOString()
                })
                .eq('id', lastCheckRecord.id);
                
              console.log(`Updated transaction_last_found timestamp for ${safe_address} on ${network}`);
            }
          } catch (updateTimestampError) {
            console.error(`Error updating transaction_last_found timestamp: ${updateTimestampError.message}`);
          }
          // Check if this transaction should trigger notifications
          const shouldNotify = async () => {
            try {
              // Check if we've already sent notifications for this transaction
              const { data: existingNotification, error } = await supabase
                .from('notification_status')
                .select('id')
                .eq('transaction_hash', safeTxHash)
                .eq('safe_address', safe_address)
                .eq('network', network)
                .single();
              
              if (error && error.code !== 'PGRST116') { // Not "no rows found" error
                console.error('Error checking notification status:', error);
                return false;
              }
              
              // If notification already sent, don't send again
              if (existingNotification) {
                console.log(`Notification already sent for transaction ${safeTxHash}, skipping`);
                return false;
              }
              
              // Check transaction timestamp against monitor creation time
              // Only notify for transactions that occur after the monitor was created
              return true;
            } catch (err) {
              console.error('Error checking notification status:', err.message);
              return false;
            }
          };
          
          // Helper function to determine if a transaction is newer than a monitor
          const isTransactionNewerThanMonitor = (transaction, monitor) => {
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
          };
          
          // Send notifications based on transaction type and notification settings
          const needsNotification = await shouldNotify();
          
          // Check if the transaction type matches notification preferences
          const shouldSendNotification = (monitor) => {
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
            const isManagement = isManagementTransaction(transaction);
            
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
          };
          
          if (needsNotification) {
            for (const monitor of relatedMonitors) {
              // Only send notifications if the transaction is newer than the monitor
              // This prevents notifications for historical transactions when a new monitor is added
              if (shouldSendNotification(monitor) && isTransactionNewerThanMonitor(transaction, monitor)) {
                console.log(`Transaction date: ${transaction.submissionDate || transaction.executionDate}, Monitor created: ${monitor.created_at}`);
                try {
                  console.log(`Sending notification for monitor ${monitor.id} for transaction ${safeTxHash}`);
                  
                  // Process each notification method
                  for (const notification of monitor.settings.notifications) {
                    const method = notification.method;
                    console.log(`Using notification method: ${method}`);
                    
                    // Implement notification logic based on method
                    switch (method) {
                      case 'email':
                        // Email notification logic
                        try {
                          if (notification.email) {
                            console.log(`Sending email to ${notification.email}`);
                            
                            // Generate links
                            const safeAppLink = `https://app.safe.global/transactions/tx?safe=${network}:${safe_address}&id=multisig_${safe_address}_${safeTxHash}`;
                            const safeMonitorLink = `https://safemonitor.io/monitor/${safeTxHash}`;
                            const etherscanLink = transaction.isExecuted 
                              ? `https://${network === 'ethereum' ? '' : network + '.'}etherscan.io/tx/${transaction.transactionHash || safeTxHash}`
                              : null;
                              
                            // Create email transaction info object
                            const txInfo = {
                              safeAddress: safe_address,
                              network: network,
                              type: txType,
                              description: description,
                              hash: safeTxHash,
                              nonce: transaction.nonce,
                              isExecuted: transaction.isExecuted || false,
                              safeAppLink,
                              safeMonitorLink,
                              etherscanLink,
                              isTest: false
                            };
                            
                            if (resend) {
                              // Generate email content
                              const htmlContent = generateTransactionEmailHtml(txInfo);
                              const textContent = generateTransactionEmailText(txInfo);
                              
                              // Set subject based on transaction type
                              const subject = txType === 'suspicious' 
                                ? `⚠️ SUSPICIOUS Safe Transaction Detected`
                                : `Safe Transaction Alert`;
                              
                              const response = await resend.emails.send({
                                from: defaultFromEmail,
                                to: notification.email,
                                subject: subject,
                                html: htmlContent,
                                text: textContent
                              });
                              
                              console.log(`Email sent successfully to ${notification.email}, ID: ${response.id}`);
                            } else {
                              console.log(`Email sending is not configured. Would send email to ${notification.email}`);
                            }
                          } else {
                            console.log(`No email address configured for this notification`);
                          }
                        } catch (emailError) {
                          console.error(`Error sending email notification:`, emailError.message);
                        }
                        break;
                      case 'webhook':
                      case 'discord':
                      case 'slack':
                        // Webhook notification logic
                        try {
                          if (notification.webhookUrl) {
                            console.log(`Sending ${method} webhook to ${notification.webhookUrl}`);
                            
                            // Generate links
                            const safeAppLink = `https://app.safe.global/transactions/tx?safe=${network}:${safe_address}&id=multisig_${safe_address}_${safeTxHash}`;
                            const safeMonitorLink = `https://safemonitor.io/monitor/${safeTxHash}`;
                            const etherscanLink = transaction.isExecuted 
                              ? `https://${network === 'ethereum' ? '' : network + '.'}etherscan.io/tx/${transaction.transactionHash || safeTxHash}`
                              : null;
                              
                            // Create transaction info object
                            const txInfo = {
                              safeAddress: safe_address,
                              network: network,
                              type: txType,
                              description: description,
                              hash: safeTxHash,
                              nonce: transaction.nonce,
                              isExecuted: transaction.isExecuted || false,
                              safeAppLink,
                              safeMonitorLink,
                              etherscanLink,
                              isTest: false // Regular transaction, not a test
                            };
                            
                            // Generate appropriate webhook payload based on method
                            let webhookPayload;
                            const contentType = 'application/json';
                            
                            if (method === 'discord') {
                              webhookPayload = generateDiscordWebhook(txInfo);
                            } else if (method === 'slack') {
                              webhookPayload = generateSlackWebhook(txInfo);
                            } else {
                              // Generic webhook
                              webhookPayload = generateGenericWebhook(txInfo, safe_address, network);
                            }
                            
                            // Send the webhook
                            const response = await axios.post(notification.webhookUrl, webhookPayload, {
                              headers: {
                                'Content-Type': contentType
                              }
                            });
                            
                            console.log(`${method} webhook sent successfully to ${notification.webhookUrl}, status: ${response.status}`);
                          } else {
                            console.log(`No webhook URL configured for this notification`);
                          }
                        } catch (webhookError) {
                          console.error(`Error sending ${method} webhook notification:`, webhookError.message);
                          if (webhookError.response) {
                            console.error(`Error status: ${webhookError.response.status}`);
                            console.error(`Error details:`, webhookError.response.data || 'No additional error details');
                          }
                        }
                        break;
                      case 'telegram':
                        // Telegram notification logic
                        try {
                          if (notification.botApiKey && notification.chatId) {
                            console.log(`Sending Telegram notification to chat ${notification.chatId}`);
                            
                            // Format transaction info
                            const txInfo = {
                              safeAddress: safe_address,
                              network: network,
                              type: txType,
                              description: description,
                              hash: safeTxHash,
                              nonce: transaction.nonce,
                              isExecuted: transaction.isExecuted || false
                            };
                            
                            // Create message with markdown formatting
                            const safeAppLink = `https://app.safe.global/transactions/tx?safe=${network}:${safe_address}&id=multisig_${safe_address}_${safeTxHash}`;
                            const safeMonitorLink = `https://safemonitor.io/monitor/${safeTxHash}`;
                            const etherscanLink = transaction.isExecuted 
                              ? `https://${network === 'ethereum' ? '' : network + '.'}etherscan.io/tx/${transaction.transactionHash || safeTxHash}`
                              : null;
                            
                            let message = `🔔 *${txType === 'suspicious' ? '⚠️ SUSPICIOUS TRANSACTION' : 'New Transaction'}*\n\n`;
                            message += `*Network:* ${network}\n`;
                            message += `*Safe:* \`${safe_address}\`\n`;
                            message += `*Description:* ${description}\n`;
                            
                            if (txInfo.nonce !== undefined) {
                              message += `*Nonce:* ${txInfo.nonce}\n`;
                            }
                            
                            message += `*Status:* ${txInfo.isExecuted ? '✅ Executed' : '⏳ Awaiting execution'}\n\n`;
                            message += `*View transaction:*\n`;
                            message += `- [Safe App](${safeAppLink})\n`;
                            message += `- [Safe Monitor](${safeMonitorLink})\n`;
                            
                            if (etherscanLink) {
                              message += `- [Etherscan](${etherscanLink})\n`;
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
                          } else {
                            console.log(`Missing Telegram credentials: botApiKey or chatId`);
                          }
                        } catch (telegramError) {
                          console.error(`Error sending Telegram notification:`, telegramError.message);
                        }
                        break;
                    }
                  }
                  
                  // Record that a notification was sent for this transaction
                  try {
                    await supabase
                      .from('notification_status')
                      .insert({
                        transaction_hash: safeTxHash,
                        safe_address: safe_address,
                        network: network,
                        notified_at: new Date().toISOString(),
                        transaction_type: txType,
                        monitor_id: monitor.id
                      });
                    console.log(`Recorded notification for monitor ${monitor.id}, transaction ${safeTxHash}`);
                  } catch (recordError) {
                    console.error('Failed to record notification status:', recordError.message);
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
