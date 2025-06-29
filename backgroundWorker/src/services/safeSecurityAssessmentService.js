/**
 * Safe Security Assessment Service
 * 
 * Performs comprehensive security analysis of Safe wallets including:
 * - Factory and mastercopy validation
 * - Creator address verification
 * - Creation transaction analysis
 * - Configuration security checks
 * - Module and policy validation
 */

const { ethers } = require('ethers');
const axios = require('axios');

// Canonical Safe Proxy Factories
const CANONICAL_PROXY_FACTORIES = {
  '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B': 'Safe: Proxy Factory 1.1.1',
  '0x0fdb2338a7a085dbC7C29f1b74294e5FB9B855e7': 'Safe: Proxy Factory 1.0.0',
  '0x12302fE9c02ff50939BaAaaf415fc226C078613C': 'Safe: Proxy Factory 1.1.0',
  '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2': 'Safe: Proxy Factory 1.3.0',
  '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67': 'Safe: Proxy Factory 1.4.1'
};

// Canonical Safe Mastercopies
const CANONICAL_MASTERCOPIES = {
  '0x8942595A2dC5181Df0465AF0D7be08c8f23C93af': 'Safe v0.1.0',
  '0xb6029EA3b2c51D09a50B53CA8012FeEB05bDa35A': 'Safe v1.0.0', 
  '0xaE32496491b53841efb51829d6f886387708f99B': 'Safe v1.1.0',
  '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F': 'Safe v1.1.1',
  '0x6851D6fDfAfD08c0295C392436245E5bc78B0185': 'Safe v1.2.0',
  '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552': 'Safe v1.3.0',
  '0x41675C099F32341bf84BFc5382aF534df5C7461a': 'Safe v1.4.1'
};

// Network configurations
const NETWORK_CONFIGS = {
  ethereum: {
    chainId: 1,
    explorerApi: 'https://api.etherscan.io/api',
    explorerUrl: 'https://etherscan.io',
    rpcUrl: process.env.ETHEREUM_RPC_URL
  },
  sepolia: {
    chainId: 11155111,
    explorerApi: 'https://api-sepolia.etherscan.io/api',
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: process.env.SEPOLIA_RPC_URL
  },
  polygon: {
    chainId: 137,
    explorerApi: 'https://api.polygonscan.com/api',
    explorerUrl: 'https://polygonscan.com',
    rpcUrl: process.env.POLYGON_RPC_URL
  },
  arbitrum: {
    chainId: 42161,
    explorerApi: 'https://api.arbiscan.io/api',
    explorerUrl: 'https://arbiscan.io',
    rpcUrl: process.env.ARBITRUM_RPC_URL
  },
  optimism: {
    chainId: 10,
    explorerApi: 'https://api-optimistic.etherscan.io/api',
    explorerUrl: 'https://optimistic.etherscan.io',
    rpcUrl: process.env.OPTIMISM_RPC_URL
  },
  base: {
    chainId: 8453,
    explorerApi: 'https://api.basescan.org/api',
    explorerUrl: 'https://basescan.org',
    rpcUrl: process.env.BASE_RPC_URL
  }
};

// Safe contract ABIs (minimal required functions)
const SAFE_ABI = [
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function getModules() view returns (address[])',
  'function nonce() view returns (uint256)',
  'function VERSION() view returns (string)',
  'function implementation() view returns (address)'
];

class SafeSecurityAssessmentService {
  /**
   * Perform comprehensive security assessment of a Safe wallet
   * 
   * @param {string} safeAddress - The Safe wallet address
   * @param {string} network - Network name
   * @returns {Object} Comprehensive security assessment
   */
  async assessSafeSecurity(safeAddress, network) {
    const assessment = {
      safeAddress,
      network,
      timestamp: new Date().toISOString(),
      overallRisk: 'unknown',
      riskFactors: [],
      securityScore: 0,
      checks: {
        addressValidation: null,
        factoryValidation: null,
        mastercopyValidation: null,
        creationTransaction: null,
        safeConfiguration: null,
        ownershipValidation: null,
        moduleValidation: null,
        proxyValidation: null
      },
      details: {
        creator: null,
        factory: null,
        mastercopy: null,
        version: null,
        owners: [],
        threshold: null,
        modules: [],
        nonce: null,
        creationTx: null
      }
    };

    try {
      // 1. Validate Safe address format
      assessment.checks.addressValidation = await this.validateAddress(safeAddress);

      if (!assessment.checks.addressValidation.isValid) {
        assessment.overallRisk = 'critical';
        assessment.riskFactors.push('Invalid Safe address format');
        return assessment;
      }

      // 2. Get network configuration
      const networkConfig = NETWORK_CONFIGS[network.toLowerCase()];
      if (!networkConfig) {
        assessment.riskFactors.push(`Unsupported network: ${network}`);
        assessment.overallRisk = 'high';
        return assessment;
      }

      // 3. Analyze creation transaction and factory
      assessment.checks.creationTransaction = await this.analyzeCreationTransaction(
        safeAddress, 
        networkConfig
      );

      // 4. Validate proxy factory
      if (assessment.checks.creationTransaction.isValid) {
        assessment.checks.factoryValidation = this.validateProxyFactory(
          assessment.checks.creationTransaction.factory
        );
        assessment.details.factory = assessment.checks.creationTransaction.factory;
        assessment.details.creator = assessment.checks.creationTransaction.creator;
        assessment.details.creationTx = assessment.checks.creationTransaction.txHash;
      }

      // 5. Get Safe configuration via Safe API
      assessment.checks.safeConfiguration = await this.getSafeConfiguration(
        safeAddress, 
        network
      );

      if (assessment.checks.safeConfiguration.isValid) {
        assessment.details = { ...assessment.details, ...assessment.checks.safeConfiguration.data };
      }

      // 6. Validate mastercopy
      if (assessment.details.mastercopy) {
        assessment.checks.mastercopyValidation = this.validateMastercopy(
          assessment.details.mastercopy
        );
      }

      // 7. Validate ownership structure
      assessment.checks.ownershipValidation = this.validateOwnershipStructure(
        assessment.details.owners,
        assessment.details.threshold
      );

      // 8. Validate modules and policies
      assessment.checks.moduleValidation = this.validateModules(
        assessment.details.modules,
        assessment.details.nonce
      );

      // 9. Perform proxy validation if possible
      if (networkConfig.rpcUrl) {
        assessment.checks.proxyValidation = await this.validateProxyImplementation(
          safeAddress,
          networkConfig
        );
      }

      // 10. Calculate overall risk and security score
      this.calculateOverallRisk(assessment);

    } catch (error) {
      console.error('Error during Safe security assessment:', error);
      assessment.riskFactors.push(`Assessment failed: ${error.message}`);
      assessment.overallRisk = 'critical';
    }

    return assessment;
  }

  /**
   * Validate Safe address format and checksum
   */
  async validateAddress(address) {
    try {
      const isValid = ethers.isAddress(address);
      const isChecksummed = address === ethers.getAddress(address);
      
      return {
        isValid,
        isChecksummed,
        address: isValid ? ethers.getAddress(address) : address,
        warnings: isValid && !isChecksummed ? ['Address is not checksummed'] : []
      };
    } catch (error) {
      return {
        isValid: false,
        isChecksummed: false,
        address,
        warnings: [`Invalid address: ${error.message}`]
      };
    }
  }

  /**
   * Analyze Safe creation transaction
   */
  async analyzeCreationTransaction(safeAddress, networkConfig) {
    try {
      // Get contract creation transaction via explorer API
      const response = await axios.get(networkConfig.explorerApi, {
        params: {
          module: 'contract',
          action: 'getcontractcreation',
          contractaddresses: safeAddress,
          apikey: process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken'
        }
      });

      if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
        const creation = response.data.result[0];
        
        // Get transaction details
        const txResponse = await axios.get(networkConfig.explorerApi, {
          params: {
            module: 'proxy',
            action: 'eth_getTransactionByHash',
            txhash: creation.txHash,
            apikey: process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken'
          }
        });

        // Get transaction receipt for logs
        const receiptResponse = await axios.get(networkConfig.explorerApi, {
          params: {
            module: 'proxy',
            action: 'eth_getTransactionReceipt',
            txhash: creation.txHash,
            apikey: process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken'
          }
        });

        const hasProxyCreationEvent = receiptResponse.data.result?.logs?.some(log => 
          log.topics && log.topics[0] === '0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9ec9070a6199ad418e235'
        );

        return {
          isValid: true,
          txHash: creation.txHash,
          creator: creation.contractCreator,
          factory: creation.contractAddress === safeAddress ? creation.contractCreator : creation.contractAddress,
          status: txResponse.data.result ? 'success' : 'unknown',
          hasProxyCreationEvent,
          blockNumber: txResponse.data.result?.blockNumber,
          warnings: []
        };
      }

      return {
        isValid: false,
        warnings: ['Could not find creation transaction']
      };

    } catch (error) {
      console.error('Error analyzing creation transaction:', error);
      return {
        isValid: false,
        warnings: [`Failed to analyze creation transaction: ${error.message}`]
      };
    }
  }

  /**
   * Validate if factory is a canonical Safe proxy factory
   */
  validateProxyFactory(factoryAddress) {
    if (!factoryAddress) {
      return {
        isValid: false,
        isCanonical: false,
        warnings: ['No factory address provided']
      };
    }

    const canonicalName = CANONICAL_PROXY_FACTORIES[factoryAddress];
    const isCanonical = !!canonicalName;

    return {
      isValid: true,
      isCanonical,
      factoryAddress,
      canonicalName: canonicalName || 'Unknown factory',
      warnings: isCanonical ? [] : ['Factory is not a canonical Safe proxy factory - HIGH RISK!']
    };
  }

  /**
   * Validate if mastercopy is a canonical Safe implementation
   */
  validateMastercopy(mastercopyAddress) {
    if (!mastercopyAddress) {
      return {
        isValid: false,
        isCanonical: false,
        warnings: ['No mastercopy address provided']
      };
    }

    const canonicalName = CANONICAL_MASTERCOPIES[mastercopyAddress];
    const isCanonical = !!canonicalName;

    return {
      isValid: true,
      isCanonical,
      mastercopyAddress,
      canonicalName: canonicalName || 'Unknown mastercopy',
      warnings: isCanonical ? [] : ['Mastercopy is not a canonical Safe implementation - CRITICAL RISK!']
    };
  }

  /**
   * Get Safe configuration from Safe API
   */
  async getSafeConfiguration(safeAddress, network) {
    try {
      // Map network names to Safe API URLs
      const API_URLS = {
        ethereum: 'https://safe-transaction-mainnet.safe.global',
        sepolia: 'https://safe-transaction-sepolia.safe.global',
        polygon: 'https://safe-transaction-polygon.safe.global',
        arbitrum: 'https://safe-transaction-arbitrum.safe.global',
        optimism: 'https://safe-transaction-optimism.safe.global',
        base: 'https://safe-transaction-base.safe.global'
      };

      const apiUrl = API_URLS[network.toLowerCase()];
      if (!apiUrl) {
        return {
          isValid: false,
          warnings: [`Safe API not available for network: ${network}`]
        };
      }

      const response = await axios.get(`${apiUrl}/api/v1/safes/${safeAddress}/`);
      const safeInfo = response.data;

      return {
        isValid: true,
        data: {
          version: safeInfo.version,
          mastercopy: safeInfo.masterCopy,
          owners: safeInfo.owners || [],
          threshold: safeInfo.threshold,
          modules: safeInfo.modules || [],
          nonce: safeInfo.nonce,
          fallbackHandler: safeInfo.fallbackHandler,
          guard: safeInfo.guard
        },
        warnings: []
      };

    } catch (error) {
      console.error('Error getting Safe configuration:', error);
      return {
        isValid: false,
        warnings: [`Failed to get Safe configuration: ${error.message}`]
      };
    }
  }

  /**
   * Validate ownership structure
   */
  validateOwnershipStructure(owners, threshold) {
    const warnings = [];
    let riskLevel = 'low';

    if (!owners || !Array.isArray(owners)) {
      return {
        isValid: false,
        warnings: ['No owners information available']
      };
    }

    if (owners.length === 0) {
      warnings.push('CRITICAL: Safe has no owners!');
      riskLevel = 'critical';
    }

    if (!threshold || threshold === 0) {
      warnings.push('CRITICAL: Safe has zero threshold!');
      riskLevel = 'critical';
    }

    if (threshold > owners.length) {
      warnings.push('CRITICAL: Threshold exceeds number of owners!');
      riskLevel = 'critical';
    }

    if (owners.length === 1 && threshold === 1) {
      warnings.push('HIGH RISK: Single-owner Safe with 1-of-1 threshold');
      riskLevel = 'high';
    }

    // Check for duplicate owners
    const uniqueOwners = new Set(owners.map(owner => owner.toLowerCase()));
    if (uniqueOwners.size !== owners.length) {
      warnings.push('CRITICAL: Duplicate owners detected!');
      riskLevel = 'critical';
    }

    // Check for zero address owners
    const hasZeroAddress = owners.some(owner => 
      owner.toLowerCase() === '0x0000000000000000000000000000000000000000'
    );
    if (hasZeroAddress) {
      warnings.push('CRITICAL: Zero address is an owner!');
      riskLevel = 'critical';
    }

    return {
      isValid: warnings.length === 0 || riskLevel !== 'critical',
      riskLevel,
      ownerCount: owners.length,
      threshold,
      uniqueOwners: uniqueOwners.size,
      warnings
    };
  }

  /**
   * Validate modules and policies
   */
  validateModules(modules, nonce) {
    const warnings = [];
    let riskLevel = 'low';

    // For new Safes, should have no modules enabled
    if (modules && modules.length > 0) {
      if (nonce === 0) {
        warnings.push('MEDIUM RISK: New Safe has modules enabled');
        riskLevel = 'medium';
      } else {
        warnings.push('INFO: Safe has modules enabled - verify they are trusted');
      }
    }

    // Check nonce for new Safes
    if (nonce === 0) {
      // This is expected for new Safes
    } else if (nonce > 0) {
      // Safe has been used
    }

    return {
      isValid: true,
      riskLevel,
      moduleCount: modules ? modules.length : 0,
      modules: modules || [],
      nonce,
      warnings
    };
  }

  /**
   * Validate proxy implementation via RPC
   */
  async validateProxyImplementation(safeAddress, networkConfig) {
    try {
      if (!networkConfig.rpcUrl) {
        return {
          isValid: false,
          warnings: ['RPC URL not configured for proxy validation']
        };
      }

      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const safeContract = new ethers.Contract(safeAddress, SAFE_ABI, provider);

      // Try to get implementation address (for proxy contracts)
      let implementationAddress = null;
      try {
        // Standard proxy implementation slot
        const implementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
        const implementation = await provider.getStorage(safeAddress, implementationSlot);
        implementationAddress = ethers.getAddress('0x' + implementation.slice(-40));
      } catch (error) {
        // Fallback to calling implementation() function if available
        try {
          implementationAddress = await safeContract.implementation();
        } catch (e) {
          // Not a proxy or different proxy pattern
        }
      }

      // Get basic Safe info
      const [owners, threshold, modules, nonce] = await Promise.all([
        safeContract.getOwners().catch(() => []),
        safeContract.getThreshold().catch(() => 0),
        safeContract.getModules().catch(() => []),
        safeContract.nonce().catch(() => 0)
      ]);

      return {
        isValid: true,
        implementationAddress,
        onChainData: {
          owners: owners.map(addr => ethers.getAddress(addr)),
          threshold: Number(threshold),
          modules: modules.map(addr => ethers.getAddress(addr)),
          nonce: Number(nonce)
        },
        warnings: []
      };

    } catch (error) {
      console.error('Error validating proxy implementation:', error);
      return {
        isValid: false,
        warnings: [`Failed to validate proxy: ${error.message}`]
      };
    }
  }

  /**
   * Calculate overall risk level and security score
   */
  calculateOverallRisk(assessment) {
    let riskFactors = [];
    let securityScore = 100; // Start with perfect score

    // Factory validation
    if (!assessment.checks.factoryValidation?.isCanonical) {
      riskFactors.push('Non-canonical proxy factory');
      securityScore -= 40;
    }

    // Mastercopy validation
    if (!assessment.checks.mastercopyValidation?.isCanonical) {
      riskFactors.push('Non-canonical mastercopy implementation');
      securityScore -= 50;
    }

    // Ownership validation
    const ownershipCheck = assessment.checks.ownershipValidation;
    if (ownershipCheck?.riskLevel === 'critical') {
      riskFactors.push('Critical ownership configuration issues');
      securityScore -= 60;
    } else if (ownershipCheck?.riskLevel === 'high') {
      riskFactors.push('High-risk ownership configuration');
      securityScore -= 30;
    }

    // Module validation
    const moduleCheck = assessment.checks.moduleValidation;
    if (moduleCheck?.riskLevel === 'medium') {
      riskFactors.push('Modules enabled on new Safe');
      securityScore -= 15;
    }

    // Creation transaction validation
    if (!assessment.checks.creationTransaction?.isValid) {
      riskFactors.push('Could not verify creation transaction');
      securityScore -= 20;
    } else if (!assessment.checks.creationTransaction?.hasProxyCreationEvent) {
      riskFactors.push('Missing ProxyCreation event');
      securityScore -= 25;
    }

    // Address validation
    if (!assessment.checks.addressValidation?.isChecksummed) {
      riskFactors.push('Address not properly checksummed');
      securityScore -= 5;
    }

    // Determine overall risk
    let overallRisk = 'low';
    if (securityScore < 30) {
      overallRisk = 'critical';
    } else if (securityScore < 60) {
      overallRisk = 'high';
    } else if (securityScore < 80) {
      overallRisk = 'medium';
    }

    assessment.riskFactors = riskFactors;
    assessment.securityScore = Math.max(0, securityScore);
    assessment.overallRisk = overallRisk;
  }

  /**
   * Generate human-readable security report
   */
  generateSecurityReport(assessment) {
    const report = {
      summary: `Safe security assessment completed with ${assessment.overallRisk} risk level (${assessment.securityScore}/100)`,
      findings: [],
      recommendations: []
    };

    // Add findings based on assessment results
    if (assessment.checks.factoryValidation?.isCanonical) {
      report.findings.push(`✅ Factory: ${assessment.checks.factoryValidation.canonicalName}`);
    } else {
      report.findings.push(`❌ Factory: Unknown/non-canonical (${assessment.details.factory})`);
      report.recommendations.push('Verify the proxy factory is legitimate and trusted');
    }

    if (assessment.checks.mastercopyValidation?.isCanonical) {
      report.findings.push(`✅ Mastercopy: ${assessment.checks.mastercopyValidation.canonicalName}`);
    } else {
      report.findings.push(`❌ Mastercopy: Unknown/non-canonical (${assessment.details.mastercopy})`);
      report.recommendations.push('CRITICAL: Verify the mastercopy implementation is legitimate');
    }

    const ownershipCheck = assessment.checks.ownershipValidation;
    if (ownershipCheck?.isValid) {
      report.findings.push(`✅ Ownership: ${ownershipCheck.ownerCount} owners, ${ownershipCheck.threshold}-of-${ownershipCheck.ownerCount} threshold`);
    } else {
      report.findings.push(`❌ Ownership: Configuration issues detected`);
      report.recommendations.push('Review and fix ownership configuration');
    }

    return report;
  }
}

module.exports = new SafeSecurityAssessmentService();