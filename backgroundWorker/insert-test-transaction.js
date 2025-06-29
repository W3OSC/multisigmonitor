#!/usr/bin/env node
// insert-test-transaction.js
// A script to insert a mock transaction directly into the database
// This will trigger notifications on the next check cycle without creating a real Safe transaction

const supabase = require('./supabase');
const { createInterface } = require('readline');
const crypto = require('crypto');

// The readline interface for asking questions in the console
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask a question and get the answer
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to generate a random transaction hash
function generateRandomTxHash() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

// Main function
async function insertTestTransaction() {
  try {
    console.log('\n🧪 Safe Transaction Test Generator 🧪\n');
    console.log('This script will insert a mock transaction into the database');
    console.log('On the next check cycle, the notification system will detect and process it\n');
    
    // Get all monitors
    const { data: monitors, error: fetchError } = await supabase
      .from('monitors')
      .select('id, safe_address, network, settings, created_at')
      .order('created_at', { ascending: false });
      
    if (fetchError) {
      console.error('❌ Error fetching monitors:', fetchError.message);
      return;
    }
    
    if (!monitors || monitors.length === 0) {
      console.error('❌ No monitors found');
      return;
    }
    
    // Let user choose a monitor
    console.log('Available monitors:');
    monitors.forEach((monitor, i) => {
      const notify = monitor.settings?.notify ? '✅' : '❌';
      console.log(`${i + 1}. ${monitor.safe_address} on ${monitor.network} (Notifications: ${notify})`);
    });
    
    const monitorChoice = await askQuestion('\nChoose a monitor (number): ');
    const monitorIndex = parseInt(monitorChoice) - 1;
    
    if (isNaN(monitorIndex) || monitorIndex < 0 || monitorIndex >= monitors.length) {
      console.error('❌ Invalid choice');
      return;
    }
    
    const selectedMonitor = monitors[monitorIndex];
    console.log(`\n✅ Selected monitor for Safe ${selectedMonitor.safe_address} on ${selectedMonitor.network}`);
    console.log(`Created at: ${selectedMonitor.created_at}`);
    
    // Check if notifications are enabled
    const notifyEnabled = selectedMonitor.settings?.notify || selectedMonitor.settings?.notifications?.length > 0;
    if (!notifyEnabled) {
      console.log('⚠️ Warning: Notifications appear to be disabled for this monitor');
      const proceed = await askQuestion('Do you want to proceed anyway? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('Exiting...');
        return;
      }
    }
    
    // Get transaction parameters
    const txType = await askQuestion('\nTransaction type (normal/suspicious) [normal]: ');
    const isSuspicious = txType.toLowerCase() === 'suspicious';
    
    const description = await askQuestion('Transaction description [Test transaction]: ');
    const finalDescription = description || 'Test transaction';
    
    const valueInput = await askQuestion('Transaction value in ETH [0]: ');
    const value = valueInput ? parseFloat(valueInput) : 0;
    
    const executedInput = await askQuestion('Mark as executed? (y/n) [n]: ');
    const isExecuted = executedInput.toLowerCase() === 'y';
    
    // Generate a random transaction hash
    const safeTxHash = generateRandomTxHash();
    const executionHash = isExecuted ? generateRandomTxHash() : null;
    
    // Create the timestamp - ensure it's newer than the monitor creation time
    const monitorCreatedAt = new Date(selectedMonitor.created_at);
    const now = new Date();
    const txTimestamp = now.toISOString();
    
    // Check that the timestamp is newer than the monitor creation
    if (now <= monitorCreatedAt) {
      console.error('❌ Error: Current time is not newer than monitor creation time (this should not happen)');
      return;
    }
    
    // Create the mock transaction data
    const mockTransaction = {
      nonce: Math.floor(Math.random() * 100),
      safeTxHash: safeTxHash,
      submissionDate: txTimestamp,
      executionDate: isExecuted ? txTimestamp : null,
      isExecuted: isExecuted,
      value: (value * 1e18).toString(),
      transactionHash: executionHash,
      dataDecoded: finalDescription.includes('operation') ? {
        method: finalDescription.split(' ')[0],
        parameters: []
      } : null
    };
    
    // Create the result record
    const resultRecord = {
      safe_address: selectedMonitor.safe_address,
      network: selectedMonitor.network,
      result: {
        transaction_hash: safeTxHash,
        transaction_data: mockTransaction,
        description: finalDescription,
        type: isSuspicious ? 'suspicious' : 'normal'
      },
      scanned_at: txTimestamp
    };
    
    console.log('\nPrepared mock transaction:');
    console.log('----------------------------');
    console.log(`Transaction hash: ${safeTxHash}`);
    console.log(`Type: ${isSuspicious ? 'suspicious' : 'normal'}`);
    console.log(`Description: ${finalDescription}`);
    console.log(`Safe: ${selectedMonitor.safe_address}`);
    console.log(`Network: ${selectedMonitor.network}`);
    console.log(`Value: ${value} ETH`);
    console.log(`Nonce: ${mockTransaction.nonce}`);
    console.log(`Executed: ${isExecuted}`);
    if (isExecuted) {
      console.log(`Execution hash: ${executionHash}`);
    }
    console.log(`Timestamp: ${txTimestamp}`);
    console.log('----------------------------');
    
    const confirmInsert = await askQuestion('\nInsert this transaction into the database? (y/n): ');
    if (confirmInsert.toLowerCase() !== 'y') {
      console.log('Operation canceled');
      return;
    }
    
    // Insert the mock transaction into the database
    console.log('Inserting transaction into database...');
    const { error: insertError } = await supabase
      .from('results')
      .insert(resultRecord);
      
    if (insertError) {
      console.error('❌ Error inserting transaction:', insertError.message);
      return;
    }
    
    console.log('✅ Mock transaction successfully inserted!');
    console.log('\nThe notification system will detect this transaction on the next check cycle');
    console.log('The check cycle runs every minute by default');
    console.log('\nLinks that will be included in notifications:');
    console.log(`- Safe App: https://app.safe.global/transactions/tx?safe=${selectedMonitor.network}:${selectedMonitor.safe_address}&id=multisig_${selectedMonitor.safe_address}_${safeTxHash}`);
    console.log(`- Safe Monitor: https://multisigmonitor.com/monitor/${safeTxHash}`);
    if (isExecuted) {
      console.log(`- Etherscan: https://${selectedMonitor.network === 'ethereum' ? '' : selectedMonitor.network + '.'}etherscan.io/tx/${executionHash}`);
    }
    
    // Optionally record already as notified
    const skipNotify = await askQuestion('\nDo you want to mark this transaction as already notified? (y/n) [n]: ');
    if (skipNotify.toLowerCase() === 'y') {
      console.log('Recording notification status to skip actual notifications...');
      const { error: statusError } = await supabase
        .from('notification_status')
        .insert({
          transaction_hash: safeTxHash,
          safe_address: selectedMonitor.safe_address,
          network: selectedMonitor.network,
          notified_at: new Date().toISOString(),
          transaction_type: isSuspicious ? 'suspicious' : 'normal',
          monitor_id: selectedMonitor.id
        });
        
      if (statusError) {
        console.error('❌ Error recording notification status:', statusError.message);
      } else {
        console.log('✅ Transaction marked as already notified');
      }
    } else {
      console.log('Transaction will trigger notifications on next check cycle');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    rl.close();
  }
}

// Run the script
insertTestTransaction();
