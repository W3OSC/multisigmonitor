/**
 * Hash Verification Service for Safe Transactions
 * 
 * This service calculates and verifies Safe transaction hashes
 * to ensure transaction integrity and detect potential tampering.
 */

const { ethers } = require('ethers');

// Safe contract constants
const DOMAIN_SEPARATOR_TYPEHASH = '0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218';
const DOMAIN_SEPARATOR_TYPEHASH_OLD = '0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749';
const SAFE_TX_TYPEHASH = '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8';
const SAFE_TX_TYPEHASH_OLD = '0x14d461bc7412367e924637b363c7bf29b8f47e2f84869f4426e5633d8af47b20';

class HashVerificationService {
  /**
   * Calculate the domain hash for a Safe transaction
   * 
   * @param {string} version - Safe version (e.g., "1.3.0")
   * @param {string} chainId - Chain ID
   * @param {string} safeAddress - Safe contract address
   * @returns {string} The domain hash
   */
  calculateDomainHash(version, chainId, safeAddress) {
    try {
      // Validate address format
      if (!ethers.isAddress(safeAddress)) {
        throw new Error(`Invalid Safe address: ${safeAddress}`);
      }
      
      const cleanVersion = this.parseVersion(version);
      let domainSeparatorTypehash = DOMAIN_SEPARATOR_TYPEHASH;
      let domainData;

      // Safe multisig versions <= 1.2.0 use a legacy (i.e. without chainId) DOMAIN_SEPARATOR_TYPEHASH value.
      // Starting with version 1.3.0, the chainId field was introduced
      if (this.compareVersions(cleanVersion, '1.2.0') <= 0) {
        domainSeparatorTypehash = DOMAIN_SEPARATOR_TYPEHASH_OLD;
        domainData = ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'address'],
          [domainSeparatorTypehash, safeAddress]
        );
      } else {
        domainData = ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'uint256', 'address'],
          [domainSeparatorTypehash, chainId, safeAddress]
        );
      }

      return ethers.keccak256(domainData);
    } catch (error) {
      console.error('Error calculating domain hash:', error);
      throw new Error(`Failed to calculate domain hash: ${error.message}`);
    }
  }

  /**
   * Calculate the message hash for a Safe transaction
   * 
   * @param {Object} transaction - Transaction object
   * @param {string} version - Safe version
   * @returns {string} The message hash
   */
  calculateMessageHash(transaction, version) {
    try {
      const cleanVersion = this.parseVersion(version);
      let safeTxTypehash = SAFE_TX_TYPEHASH;

      // Versions < 1.0.0 use legacy typehash (dataGas instead of baseGas)
      if (this.compareVersions(cleanVersion, '1.0.0') < 0) {
        safeTxTypehash = SAFE_TX_TYPEHASH_OLD;
      }

      // Calculate data hash (keccak256 of the data field)
      const dataHash = ethers.keccak256(transaction.data || '0x');

      // Encode the Safe transaction struct
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        [
          'bytes32', // typehash
          'address', // to
          'uint256', // value
          'bytes32', // data hash
          'uint8',   // operation
          'uint256', // safeTxGas
          'uint256', // baseGas (or dataGas for old versions)
          'uint256', // gasPrice
          'address', // gasToken
          'address', // refundReceiver
          'uint256'  // nonce
        ],
        [
          safeTxTypehash,
          transaction.to || ethers.ZeroAddress,
          transaction.value || 0,
          dataHash,
          transaction.operation || 0,
          transaction.safeTxGas || 0,
          transaction.baseGas || transaction.dataGas || 0,
          transaction.gasPrice || 0,
          transaction.gasToken || ethers.ZeroAddress,
          transaction.refundReceiver || ethers.ZeroAddress,
          transaction.nonce || 0
        ]
      );

      return ethers.keccak256(encoded);
    } catch (error) {
      console.error('Error calculating message hash:', error);
      throw new Error(`Failed to calculate message hash: ${error.message}`);
    }
  }

  /**
   * Calculate the Safe transaction hash
   * 
   * @param {string} domainHash - The domain hash
   * @param {string} messageHash - The message hash
   * @returns {string} The Safe transaction hash
   */
  calculateSafeTxHash(domainHash, messageHash) {
    try {
      // EIP-712 encoding: 0x19 0x01 <domainHash> <messageHash>
      const encoded = ethers.solidityPacked(
        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
        ['0x19', '0x01', domainHash, messageHash]
      );

      return ethers.keccak256(encoded);
    } catch (error) {
      console.error('Error calculating Safe tx hash:', error);
      throw new Error(`Failed to calculate Safe tx hash: ${error.message}`);
    }
  }

  /**
   * Verify transaction hashes against API values
   * 
   * @param {Object} transaction - Transaction from Safe API
   * @param {string} chainId - Chain ID
   * @param {string} safeAddress - Safe contract address
   * @param {string} safeVersion - Safe version
   * @returns {Object} Verification result with calculated hashes
   */
  verifyTransactionHashes(transaction, chainId, safeAddress, safeVersion) {
    try {
      // Calculate hashes
      const domainHash = this.calculateDomainHash(safeVersion, chainId, safeAddress);
      const messageHash = this.calculateMessageHash(transaction, safeVersion);
      const calculatedSafeTxHash = this.calculateSafeTxHash(domainHash, messageHash);

      // Get API hash
      const apiSafeTxHash = transaction.safeTxHash;

      // Compare hashes
      const hashesMatch = calculatedSafeTxHash.toLowerCase() === apiSafeTxHash.toLowerCase();

      const result = {
        verified: hashesMatch,
        calculatedHashes: {
          domainHash,
          messageHash,
          safeTxHash: calculatedSafeTxHash
        },
        apiHashes: {
          safeTxHash: apiSafeTxHash
        },
        chainId,
        safeAddress,
        safeVersion
      };

      if (!hashesMatch) {
        result.error = 'CRITICAL: Safe transaction hash mismatch! Transaction may have been tampered with.';
        console.error('Hash verification failed:', {
          calculated: calculatedSafeTxHash,
          api: apiSafeTxHash,
          transaction
        });
      }

      return result;
    } catch (error) {
      console.error('Error verifying transaction hashes:', error);
      return {
        verified: false,
        error: `Hash verification failed: ${error.message}`,
        calculatedHashes: {},
        apiHashes: {
          safeTxHash: transaction.safeTxHash
        }
      };
    }
  }

  /**
   * Check nonce sequence for potential issues
   * 
   * @param {number} currentNonce - Current transaction nonce
   * @param {number} previousNonce - Previous transaction nonce
   * @param {number} threshold - Maximum acceptable gap (default: 5)
   * @returns {Object} Nonce check result
   */
  checkNonceSequence(currentNonce, previousNonce, threshold = 5) {
    const nonceGap = currentNonce - previousNonce;
    
    const result = {
      currentNonce,
      previousNonce,
      gap: nonceGap,
      threshold,
      isRisky: false,
      riskLevel: 'low',
      message: ''
    };

    if (nonceGap > threshold) {
      result.isRisky = true;
      result.riskLevel = nonceGap > threshold * 2 ? 'high' : 'medium';
      result.message = `Nonce gap of ${nonceGap} detected. This may indicate skipped transactions or potential replay attack.`;
    } else if (nonceGap === 0) {
      result.isRisky = true;
      result.riskLevel = 'high';
      result.message = 'Same nonce used multiple times. This could indicate a replay attack.';
    } else if (nonceGap < 0) {
      result.isRisky = true;
      result.riskLevel = 'critical';
      result.message = 'Nonce decreased. This is highly suspicious and could indicate transaction manipulation.';
    } else {
      result.message = 'Nonce sequence is normal.';
    }

    return result;
  }

  /**
   * Decode transaction calldata
   * 
   * @param {string} data - Transaction data field
   * @param {Object} dataDecoded - Decoded data from API (if available)
   * @returns {Object} Decoded calldata information
   */
  decodeCalldata(data, dataDecoded = null) {
    const result = {
      raw: data || '0x',
      decoded: null,
      humanReadable: '',
      method: null,
      parameters: []
    };

    // If no data, it's a simple transfer
    if (!data || data === '0x' || data === '0x0') {
      result.humanReadable = 'Simple ETH transfer (no calldata)';
      return result;
    }

    // If we have decoded data from API, use it
    if (dataDecoded) {
      result.decoded = dataDecoded;
      result.method = dataDecoded.method;
      result.parameters = dataDecoded.parameters || [];
      
      // Generate human-readable description
      result.humanReadable = this.generateHumanReadableCalldata(dataDecoded);
    } else {
      // Try to decode function selector
      if (data.length >= 10) {
        const selector = data.slice(0, 10);
        result.method = `Unknown function (${selector})`;
        result.humanReadable = `Contract interaction with selector ${selector}`;
        
        // Add raw parameters info
        const paramData = data.slice(10);
        if (paramData) {
          const paramCount = Math.floor(paramData.length / 64); // 32 bytes = 64 hex chars
          result.humanReadable += ` with ${paramCount} parameter(s)`;
        }
      }
    }

    return result;
  }

  /**
   * Generate human-readable description of decoded calldata
   * 
   * @param {Object} dataDecoded - Decoded data object
   * @returns {string} Human-readable description
   */
  generateHumanReadableCalldata(dataDecoded) {
    const method = dataDecoded.method;
    const params = dataDecoded.parameters || [];

    // Common Safe methods
    const methodDescriptions = {
      // Owner management
      'addOwnerWithThreshold': 'Add new owner and update threshold',
      'removeOwner': 'Remove owner from Safe',
      'swapOwner': 'Replace existing owner',
      'changeThreshold': 'Change signature threshold',
      
      // Module management
      'enableModule': 'Enable a new module',
      'disableModule': 'Disable an existing module',
      
      // Guard management
      'setGuard': 'Set transaction guard',
      
      // Token transfers
      'transfer': 'Transfer tokens',
      'transferFrom': 'Transfer tokens from address',
      'approve': 'Approve token spending',
      
      // Safe operations
      'execTransaction': 'Execute Safe transaction',
      'multiSend': 'Execute multiple transactions',
      
      // Fallback
      'setFallbackHandler': 'Set fallback handler contract'
    };

    let description = methodDescriptions[method] || `Call ${method}`;

    // Add parameter details for specific methods
    if (params.length > 0) {
      const paramDetails = [];
      
      params.forEach(param => {
        if (param.name === 'owner' || param.name === '_owner') {
          paramDetails.push(`owner: ${this.truncateAddress(param.value)}`);
        } else if (param.name === '_threshold') {
          paramDetails.push(`threshold: ${param.value}`);
        } else if (param.name === 'to' || param.name === '_to') {
          paramDetails.push(`to: ${this.truncateAddress(param.value)}`);
        } else if (param.name === 'value' || param.name === '_value' || param.name === 'amount') {
          try {
            const ethValue = ethers.formatEther(param.value);
            paramDetails.push(`amount: ${ethValue} ETH`);
          } catch {
            paramDetails.push(`${param.name}: ${param.value}`);
          }
        } else if (param.name === 'module') {
          paramDetails.push(`module: ${this.truncateAddress(param.value)}`);
        } else {
          paramDetails.push(`${param.name}: ${param.value}`);
        }
      });

      if (paramDetails.length > 0) {
        description += ` (${paramDetails.join(', ')})`;
      }
    }

    return description;
  }

  /**
   * Helper: Parse version string
   */
  parseVersion(version) {
    // Remove 'v' prefix if present
    return version.replace(/^v/, '');
  }

  /**
   * Helper: Compare semantic versions
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (parts1[i] < parts2[i]) return -1;
      if (parts1[i] > parts2[i]) return 1;
    }
    return 0;
  }

  /**
   * Helper: Truncate address for display
   */
  truncateAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}

module.exports = new HashVerificationService();
