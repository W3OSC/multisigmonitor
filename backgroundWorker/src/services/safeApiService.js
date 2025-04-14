const axios = require('axios');
const { NETWORK_CONFIGS, SAFE_API_VERSION } = require('../config/networks');

/**
 * Service for interacting with the Safe API
 */
class SafeApiService {
  /**
   * Get the Safe API service URL for a given network
   * 
   * @param {string} network The network to get the service URL for
   * @returns {string|null} The service URL or null if the network is not supported
   */
  getServiceUrl(network) {
    if (!NETWORK_CONFIGS[network]) {
      return null;
    }
    
    return NETWORK_CONFIGS[network].txServiceUrl;
  }
  
  /**
   * Get information about a Safe from the Safe API
   * 
   * @param {string} safeAddress The Safe address to get information for
   * @param {string} network The network the Safe is on
   * @returns {Promise<Object>} The Safe information
   */
  async getSafeInfo(safeAddress, network) {
    const txServiceUrl = this.getServiceUrl(network);
    if (!txServiceUrl) {
      throw new Error(`Unsupported network: ${network}`);
    }
    
    try {
      const response = await axios.get(`${txServiceUrl}/api/v1/safes/${safeAddress}`, {
        headers: {
          'accept': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error getting Safe info: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get transactions for a Safe from the Safe API
   * 
   * @param {string} safeAddress The Safe address to get transactions for
   * @param {string} network The network the Safe is on
   * @param {string|null} modifiedSince Optional ISO timestamp to filter transactions modified since
   * @returns {Promise<Object>} The transactions
   */
  async getSafeTransactions(safeAddress, network, modifiedSince = null) {
    const txServiceUrl = this.getServiceUrl(network);
    if (!txServiceUrl) {
      throw new Error(`Unsupported network: ${network}`);
    }
    
    try {
      // If we have a last check timestamp, only fetch transactions modified since then
      const params = modifiedSince ? { modified__gte: modifiedSince } : {};
      
      const response = await axios.get(`${txServiceUrl}/api/${SAFE_API_VERSION}/safes/${safeAddress}/multisig-transactions/`, {
        headers: {
          'accept': 'application/json'
        },
        params: params
      });
      
      return response.data;
    } catch (error) {
      console.error(`Safe API error for ${safeAddress} on ${network}:`, error.message);
      if (error.response) {
        console.error(`Error details:`, error.response.data || 'No additional error details');
      }
      throw error;
    }
  }
}

module.exports = new SafeApiService();
