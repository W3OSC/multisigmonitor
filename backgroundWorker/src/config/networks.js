// Network configuration for Safe API
const SAFE_API_VERSION = 'v2';

// API endpoints for different networks
const NETWORK_CONFIGS = {
  'ethereum': {
    txServiceUrl: 'https://safe-transaction-mainnet.safe.global',
    chainId: 1,
    name: 'Ethereum Mainnet'
  },
  'sepolia': {
    txServiceUrl: 'https://safe-transaction-sepolia.safe.global',
    chainId: 11155111,
    name: 'Sepolia Testnet'
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
  }
};

module.exports = {
  SAFE_API_VERSION,
  NETWORK_CONFIGS
};
