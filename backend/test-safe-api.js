// test-safe-api.js
const axios = require('axios');

// Example Safe address from the user's input
const safeAddress = '0x0cDF1a78f00f56ba879D0aCc0FDa1789e415f23B';
const network = 'ethereum'; // mainnet

// API endpoints map
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
  }
};

// Function to fetch multisig transactions for a Safe
async function getMultisigTransactions(safeAddress, network) {
  try {
    const txServiceUrl = NETWORK_CONFIGS[network].txServiceUrl;
    console.log(`Fetching transactions from ${txServiceUrl}/api/v2/safes/${safeAddress}/multisig-transactions/`);
    
    const response = await axios.get(
      `${txServiceUrl}/api/v2/safes/${safeAddress}/multisig-transactions/`,
      {
        headers: {
          'accept': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Function to get basic Safe info
async function getSafeInfo(safeAddress, network) {
  try {
    const txServiceUrl = NETWORK_CONFIGS[network].txServiceUrl;
    console.log(`Fetching Safe info from ${txServiceUrl}/api/v1/safes/${safeAddress}`);
    
    const response = await axios.get(
      `${txServiceUrl}/api/v1/safes/${safeAddress}`,
      {
        headers: {
          'accept': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching Safe info:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Main function to demonstrate API usage
async function main() {
  console.log(`Testing Safe API with address: ${safeAddress} on ${network}`);
  
  try {
    // Get Safe information
    const safeInfo = await getSafeInfo(safeAddress, network);
    console.log('Safe Info:');
    console.log(JSON.stringify(safeInfo, null, 2));
    
    // Get multisig transactions
    const transactions = await getMultisigTransactions(safeAddress, network);
    console.log('\nMultisig Transactions:');
    console.log(`Found ${transactions.count} total transactions`);
    console.log(`Results returned: ${transactions.results.length}`);
    
    // Print the first transaction as an example
    if (transactions.results.length > 0) {
      console.log('\nExample Transaction:');
      console.log(JSON.stringify(transactions.results[0], null, 2));
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
main().catch(console.error);
