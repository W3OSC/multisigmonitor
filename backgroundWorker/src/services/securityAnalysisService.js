/**
 * Security Analysis Service for Safe Transactions
 * 
 * This service analyzes Safe transactions for suspicious activities including:
 * - Gas token attacks
 * - Malicious delegate calls
 * - Other security concerns
 */

// Constants
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Trusted addresses for delegate calls
const TRUSTED_DELEGATE_CALL_ADDRESSES = {
  // MultiSendCallOnly addresses
  "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D": "MultiSendCallOnly v1.3.0 (canonical)",
  "0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B": "MultiSendCallOnly v1.3.0 (eip155)",
  "0xf220D3b4DFb23C4ade8C88E526C1353AbAcbC38F": "MultiSendCallOnly v1.3.0 (zksync)",
  "0x9641d764fc13c8B624c04430C7356C1C7C8102e2": "MultiSendCallOnly v1.4.1 (canonical)",
  "0x0408EF011960d02349d50286D20531229BCef773": "MultiSendCallOnly v1.4.1 (zksync)",
  
  // SafeMigration addresses
  "0x526643F69b81B008F46d95CD5ced5eC0edFFDaC6": "SafeMigration v1.4.1 (canonical)",
  "0x817756C6c555A94BCEE39eB5a102AbC1678b09A7": "SafeMigration v1.4.1 (zksync)",
  
  // SignMessageLib addresses
  "0xA65387F16B013cf2Af4605Ad8aA5ec25a2cbA3a2": "SignMessageLib v1.3.0 (canonical)",
  "0x98FFBBF51bb33A056B08ddf711f289936AafF717": "SignMessageLib v1.3.0 (eip155)",
  "0x357147caf9C0cCa67DfA0CF5369318d8193c8407": "SignMessageLib v1.3.0 (zksync)",
  "0xd53cd0aB83D845Ac265BE939c57F53AD838012c9": "SignMessageLib v1.4.1 (canonical)",
  "0xAca1ec0a1A575CDCCF1DC3d5d296202Eb6061888": "SignMessageLib v1.4.1 (zksync)"
};

class SecurityAnalysisService {
  /**
   * Analyze a transaction for security concerns
   * 
   * @param {Object} transaction - The Safe transaction object
   * @param {string} safeAddress - The Safe address
   * @param {Object} options - Additional options for analysis
   * @returns {Object} Analysis result with warnings and risk level
   */
  analyzeTransaction(transaction, safeAddress, options = {}) {
    const analysis = {
      isSuspicious: false,
      riskLevel: 'low', // low, medium, high, critical
      warnings: [],
      details: [],
      hashVerification: null,
      nonceCheck: null,
      calldata: null
    };

    try {
      // Perform hash verification if chain info provided
      if (options.chainId && options.safeVersion) {
        const hashVerificationService = require('./hashVerificationService');
        analysis.hashVerification = hashVerificationService.verifyTransactionHashes(
          transaction,
          options.chainId,
          safeAddress,
          options.safeVersion
        );

        // Add critical warning if hash mismatch
        if (!analysis.hashVerification.verified) {
          analysis.warnings.push('Hash Verification Failed');
          analysis.details.push({
            type: 'hash_mismatch',
            severity: 'critical',
            message: analysis.hashVerification.error || 'Transaction hash verification failed',
            priority: 'P0'
          });
        }
      }

      // Perform nonce sequence check if previous nonce provided
      if (options.previousNonce !== undefined && transaction.nonce !== undefined) {
        const hashVerificationService = require('./hashVerificationService');
        analysis.nonceCheck = hashVerificationService.checkNonceSequence(
          transaction.nonce,
          options.previousNonce
        );

        if (analysis.nonceCheck.isRisky) {
          analysis.warnings.push('Nonce Sequence Issue');
          analysis.details.push({
            type: 'nonce_gap',
            severity: analysis.nonceCheck.riskLevel,
            message: analysis.nonceCheck.message,
            gap: analysis.nonceCheck.gap
          });
        }
      }

      // Decode calldata
      if (transaction.data || transaction.dataDecoded) {
        const hashVerificationService = require('./hashVerificationService');
        analysis.calldata = hashVerificationService.decodeCalldata(
          transaction.data,
          transaction.dataDecoded
        );
      }

      // Perform various security checks
      this.checkGasTokenAttack(transaction, analysis);
      this.checkDelegateCall(transaction, analysis);
      this.checkLargeValueTransfer(transaction, analysis);
      this.checkOwnerManagement(transaction, analysis);
      this.checkUnusualGasSettings(transaction, analysis);
      this.checkExternalContracts(transaction, analysis);

      // Set overall risk level based on warnings
      this.calculateRiskLevel(analysis);

    } catch (error) {
      console.error('Error during security analysis:', error);
      analysis.warnings.push('Security analysis failed - manual review recommended');
      analysis.riskLevel = 'medium';
    }

    return analysis;
  }

  /**
   * Check for gas token attacks and gas parameter validation
   * 
   * @param {Object} transaction - The Safe transaction object
   * @param {Object} analysis - The analysis object to update
   */
  checkGasTokenAttack(transaction, analysis) {
    const gasPrice = transaction.gasPrice || "0";
    const gasToken = transaction.gasToken || ZERO_ADDRESS;
    const refundReceiver = transaction.refundReceiver || ZERO_ADDRESS;
    const safeTxGas = transaction.safeTxGas || "0";
    const baseGas = transaction.baseGas || "0";

    // CRITICAL: Check if safeTxGas, baseGas, gasPrice, gasToken, refundReceiver should be 0
    // For most legitimate transactions, these should be 0
    const hasNonZeroGasParams = (
      gasPrice !== "0" || 
      gasToken !== ZERO_ADDRESS || 
      refundReceiver !== ZERO_ADDRESS ||
      safeTxGas !== "0" ||
      baseGas !== "0"
    );

    if (hasNonZeroGasParams) {
      analysis.warnings.push('Non-Zero Gas Parameters');
      analysis.details.push({
        type: 'non_zero_gas_params',
        severity: 'high',
        message: 'Transaction has non-zero gas parameters. This could indicate gas manipulation or refund attacks.',
        safeTxGas,
        baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
        priority: 'P1'
      });
    }

    // High risk: Custom gas token + custom refund receiver
    if (gasToken !== ZERO_ADDRESS && refundReceiver !== ZERO_ADDRESS) {
      analysis.warnings.push('Gas Token Attack Risk');
      analysis.details.push({
        type: 'gas_token_attack',
        severity: 'high',
        message: 'Transaction uses both a custom gas token and custom refund receiver. This combination can hide fund rerouting through gas refunds.',
        gasToken,
        refundReceiver,
        gasPrice
      });

      // Even higher risk if gas price is non-zero
      if (gasPrice !== "0") {
        analysis.details.push({
          type: 'gas_token_attack_enhanced',
          severity: 'critical',
          message: 'Non-zero gas price increases potential for hidden value transfers through gas refunds.',
          gasPrice
        });
      }
    }
    // Medium risk: Only custom gas token
    else if (gasToken !== ZERO_ADDRESS) {
      analysis.warnings.push('Custom Gas Token');
      analysis.details.push({
        type: 'custom_gas_token',
        severity: 'medium',
        message: 'Transaction uses a custom gas token. Verify this is intended.',
        gasToken
      });
    }
    // Medium risk: Only custom refund receiver
    else if (refundReceiver !== ZERO_ADDRESS) {
      analysis.warnings.push('Custom Refund Receiver');
      analysis.details.push({
        type: 'custom_refund_receiver',
        severity: 'medium',
        message: 'Transaction uses a custom refund receiver. Verify this is intended.',
        refundReceiver
      });
    }
  }

  /**
   * Check for malicious delegate calls
   * 
   * @param {Object} transaction - The Safe transaction object
   * @param {Object} analysis - The analysis object to update
   */
  checkDelegateCall(transaction, analysis) {
    const operation = transaction.operation || 0;
    const toAddress = transaction.to;

    // Check if this is a delegate call (operation = 1)
    if (operation === 1) {
      const trustedAddress = TRUSTED_DELEGATE_CALL_ADDRESSES[toAddress];
      
      if (!trustedAddress) {
        analysis.warnings.push('Untrusted Delegate Call');
        analysis.details.push({
          type: 'untrusted_delegate_call',
          severity: 'critical',
          message: `CRITICAL: Transaction includes an untrusted delegate call to address ${toAddress}. This may lead to unexpected behavior or complete Safe compromise.`,
          toAddress,
          operation,
          priority: 'P0'
        });
      } else {
        // Even trusted delegate calls should be noted
        analysis.details.push({
          type: 'trusted_delegate_call',
          severity: 'low',
          message: `Transaction includes a delegate call to trusted address: ${trustedAddress}`,
          toAddress,
          trustedName: trustedAddress
        });
      }
    }

    // Store call type information for frontend display
    analysis.callType = {
      isCall: operation === 0,
      isDelegateCall: operation === 1,
      isTrustedDelegate: operation === 1 && !!TRUSTED_DELEGATE_CALL_ADDRESSES[toAddress],
      contractAddress: toAddress,
      contractName: TRUSTED_DELEGATE_CALL_ADDRESSES[toAddress] || null
    };
  }

  /**
   * Check for large value transfers
   * 
   * @param {Object} transaction - The Safe transaction object
   * @param {Object} analysis - The analysis object to update
   */
  checkLargeValueTransfer(transaction, analysis) {
    const value = transaction.value || "0";
    const valueInEth = parseFloat(value) / 1e18;

    // Flag transfers over 10 ETH as noteworthy
    if (valueInEth > 10) {
      const severity = valueInEth > 100 ? 'high' : 'medium';
      analysis.warnings.push('Large Value Transfer');
      analysis.details.push({
        type: 'large_value_transfer',
        severity,
        message: `Transaction transfers ${valueInEth.toFixed(4)} ETH, which is above the threshold for review.`,
        valueEth: valueInEth,
        valueWei: value
      });
    }
  }

  /**
   * Check for critical Safe management operations
   * 
   * @param {Object} transaction - The Safe transaction object
   * @param {Object} analysis - The analysis object to update
   */
  checkOwnerManagement(transaction, analysis) {
    if (!transaction.dataDecoded) return;

    const method = transaction.dataDecoded.method;
    const parameters = transaction.dataDecoded.parameters || [];

    // Critical Safe management operations (P0/Critical priority)
    switch (method) {
      // Owner Management - CRITICAL
      case 'addOwner':
      case 'AddedOwner':
        analysis.warnings.push('Owner Added');
        analysis.details.push({
          type: 'owner_added',
          severity: 'critical',
          message: 'CRITICAL: New owner added to Safe. Verify this action is authorized.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      case 'removeOwner':
      case 'RemovedOwner':
        analysis.warnings.push('Owner Removed');
        analysis.details.push({
          type: 'owner_removed',
          severity: 'critical',
          message: 'CRITICAL: Owner removed from Safe. This affects Safe control.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      case 'swapOwner':
        analysis.warnings.push('Owner Replaced');
        analysis.details.push({
          type: 'owner_swapped',
          severity: 'critical',
          message: 'CRITICAL: Safe owner replaced. Verify the new owner address.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      case 'addOwnerWithThreshold':
        analysis.warnings.push('Owner Added with Threshold Change');
        analysis.details.push({
          type: 'owner_added_with_threshold',
          severity: 'critical',
          message: 'CRITICAL: New owner added and threshold changed. Double verification required.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      // Threshold Management - CRITICAL
      case 'changeThreshold':
      case 'ChangedThreshold':
        const newThreshold = parameters.find(p => p.name === '_threshold' || p.name === 'threshold')?.value;
        analysis.warnings.push('Threshold Changed');
        analysis.details.push({
          type: 'threshold_changed',
          severity: 'critical',
          message: `CRITICAL: Signature threshold changed to ${newThreshold}. This affects Safe security.`,
          method,
          newThreshold,
          parameters,
          priority: 'P0'
        });
        break;

      // Module Management - CRITICAL
      case 'enableModule':
      case 'EnabledModule':
        analysis.warnings.push('Module Enabled');
        analysis.details.push({
          type: 'module_enabled',
          severity: 'critical',
          message: 'CRITICAL: New module enabled. Modules can execute transactions without signatures.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      case 'disableModule':
      case 'DisabledModule':
        analysis.warnings.push('Module Disabled');
        analysis.details.push({
          type: 'module_disabled',
          severity: 'critical',
          message: 'CRITICAL: Module disabled. Verify this doesn\'t break existing automations.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      // Guard Management - CRITICAL
      case 'setGuard':
      case 'ChangedGuard':
        analysis.warnings.push('Guard Changed');
        analysis.details.push({
          type: 'guard_changed',
          severity: 'critical',
          message: 'CRITICAL: Transaction guard changed. Guards can block all transactions.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      // Fallback Handler - CRITICAL
      case 'setFallbackHandler':
      case 'ChangedFallbackHandler':
        analysis.warnings.push('Fallback Handler Changed');
        analysis.details.push({
          type: 'fallback_handler_changed',
          severity: 'critical',
          message: 'CRITICAL: Fallback handler changed. This affects how Safe handles unknown calls.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      // Master Copy / Implementation - CRITICAL
      case 'changeMasterCopy':
      case 'ChangedMasterCopy':
        analysis.warnings.push('Implementation Changed');
        analysis.details.push({
          type: 'implementation_changed',
          severity: 'critical',
          message: 'CRITICAL: Safe implementation upgraded/changed. Verify the new implementation.',
          method,
          parameters,
          priority: 'P0'
        });
        break;

      // Additional operations to track when "All transactions" is enabled
      case 'signMessage':
      case 'SignMsg':
        analysis.details.push({
          type: 'message_signed',
          severity: 'low',
          message: 'Message signing confirmation recorded.',
          method,
          parameters,
          trackWhenAllEnabled: true
        });
        break;

      case 'approveHash':
      case 'ApproveHash':
        analysis.details.push({
          type: 'hash_approved',
          severity: 'low',
          message: 'Transaction hash approved by owner.',
          method,
          parameters,
          trackWhenAllEnabled: true
        });
        break;

      case 'execTransaction':
      case 'ExecutionSuccess':
        analysis.details.push({
          type: 'execution_success',
          severity: 'low',
          message: 'Transaction executed successfully.',
          method,
          parameters,
          trackWhenAllEnabled: true
        });
        break;

      case 'ExecutionFailure':
        analysis.warnings.push('Execution Failed');
        analysis.details.push({
          type: 'execution_failure',
          severity: 'medium',
          message: 'Transaction execution failed. Review the failure reason.',
          method,
          parameters,
          trackWhenAllEnabled: true
        });
        break;

      // Safe setup - CRITICAL
      case 'setup':
        analysis.warnings.push('Safe Setup Changed');
        analysis.details.push({
          type: 'safe_setup',
          severity: 'critical',
          message: 'CRITICAL: Safe setup modified. This is a fundamental configuration change.',
          method,
          parameters,
          priority: 'P0'
        });
        break;
    }
  }

  /**
   * Check for unusual gas settings
   * 
   * @param {Object} transaction - The Safe transaction object
   * @param {Object} analysis - The analysis object to update
   */
  checkUnusualGasSettings(transaction, analysis) {
    const safeTxGas = parseInt(transaction.safeTxGas || "0");
    const baseGas = parseInt(transaction.baseGas || "0");
    const gasPrice = parseInt(transaction.gasPrice || "0");

    // Check for unusually high gas settings
    if (safeTxGas > 1000000) { // 1M gas
      analysis.details.push({
        type: 'high_safe_tx_gas',
        severity: 'medium',
        message: `Transaction has unusually high safeTxGas: ${safeTxGas}`,
        safeTxGas
      });
    }

    if (baseGas > 1000000) { // 1M gas
      analysis.details.push({
        type: 'high_base_gas',
        severity: 'medium',
        message: `Transaction has unusually high baseGas: ${baseGas}`,
        baseGas
      });
    }

    // Check for zero gas price with gas token (potential gas manipulation)
    if (gasPrice === 0 && transaction.gasToken && transaction.gasToken !== ZERO_ADDRESS) {
      analysis.warnings.push('Zero Gas Price with Token');
      analysis.details.push({
        type: 'zero_gas_with_token',
        severity: 'medium',
        message: 'Transaction uses zero gas price with a gas token. This could indicate gas manipulation.',
        gasPrice,
        gasToken: transaction.gasToken
      });
    }
  }

  /**
   * Check for interactions with external contracts
   * 
   * @param {Object} transaction - The Safe transaction object
   * @param {Object} analysis - The analysis object to update
   */
  checkExternalContracts(transaction, analysis) {
    const toAddress = transaction.to;
    
    // Check if this is a contract interaction (has data and not a simple transfer)
    if (transaction.data && transaction.data !== "0x" && transaction.dataDecoded) {
      analysis.details.push({
        type: 'contract_interaction',
        severity: 'low',
        message: `Transaction interacts with contract at ${toAddress}`,
        toAddress,
        method: transaction.dataDecoded.method
      });

      // Flag interactions with unverified or unusual contracts
      // This would require additional data sources in a real implementation
      if (!transaction.trusted) {
        analysis.warnings.push('Unverified Contract Interaction');
        analysis.details.push({
          type: 'unverified_contract',
          severity: 'medium',
          message: 'Transaction interacts with an unverified or untrusted contract.',
          toAddress
        });
      }
    }
  }

  /**
   * Calculate overall risk level based on warnings and details
   * 
   * @param {Object} analysis - The analysis object to update
   */
  calculateRiskLevel(analysis) {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    let hasP0Priority = false;

    // Count severities and check for P0 priority
    analysis.details.forEach(detail => {
      if (severityCounts.hasOwnProperty(detail.severity)) {
        severityCounts[detail.severity]++;
      }
      
      // Check if this is a P0/Critical priority event
      if (detail.priority === 'P0') {
        hasP0Priority = true;
      }
    });

    // Determine overall risk level
    if (severityCounts.critical > 0 || hasP0Priority) {
      analysis.riskLevel = 'critical';
      analysis.isSuspicious = true;
      analysis.priority = 'P0';
    } else if (severityCounts.high > 0) {
      analysis.riskLevel = 'high';
      analysis.isSuspicious = true;
    } else if (severityCounts.medium > 1 || (severityCounts.medium > 0 && severityCounts.low > 2)) {
      analysis.riskLevel = 'medium';
      analysis.isSuspicious = true;
    } else if (severityCounts.medium > 0) {
      analysis.riskLevel = 'medium';
    } else {
      analysis.riskLevel = 'low';
    }
  }

  /**
   * Generate a human-readable summary of the analysis
   * 
   * @param {Object} analysis - The analysis result
   * @returns {string} Summary text
   */
  generateSummary(analysis) {
    if (analysis.warnings.length === 0) {
      return 'No security concerns detected.';
    }

    let summary = `Security analysis found ${analysis.warnings.length} potential concern(s): `;
    summary += analysis.warnings.join(', ');
    summary += `. Risk level: ${analysis.riskLevel.toUpperCase()}.`;

    return summary;
  }
}

module.exports = new SecurityAnalysisService();
