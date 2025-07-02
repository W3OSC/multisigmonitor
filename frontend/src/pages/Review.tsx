
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { AddressInput } from "@/components/AddressInput";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldX,
  ExternalLink,
  Users,
  Key,
  Factory,
  Settings,
  Clock,
  Network,
  FileCheck
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const CANONICAL_PROXY_FACTORIES: { [key: string]: string } = {
  // Mainnet Safe Proxy Factories
  '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B': 'Safe: Proxy Factory 1.1.1',
  '0x50e55Af101C777bA7A3d560a2aAB3b64D6b2b6A5': 'Safe: Proxy Factory 1.3.0+',
  '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2': 'Safe: Proxy Factory 1.3.0',
  '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67': 'Safe: Proxy Factory 1.4.1',
  '0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC': 'Safe: Proxy Factory 1.4.1+',
  
  // L2 Safe Proxy Factories
  '0x12302fE9c02ff50939BaAaaf415fc226C078613C': 'Safe: Proxy Factory 1.3.0 (L2)',
  
  // Additional known factories
  '0x0000000000FFe8B47B3e2130213B802212439497': 'Safe: Proxy Factory (Legacy)',
  '0x8942595A2dC5181Df0465AF0D7be08c8f23C93af': 'Safe: Proxy Factory 1.1.1 (Legacy)'
};

const CANONICAL_MASTERCOPIES: { [key: string]: string } = {
  // Mainnet Safe contracts
  '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F': 'Safe: Master Copy 1.3.0+',
  '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552': 'Safe: Master Copy 1.3.0',
  '0x6851D6fDFAfD08c0295C392436245E5bc78B0185': 'Safe: Master Copy 1.2.0',
  '0xAE32496491b53841efb51829d6f886387708F99B': 'Safe: Master Copy 1.1.1',
  '0xb6029EA3B2c51D09a50B53CA8012FeEB05bDa35A': 'Safe: Master Copy 1.0.0',
  
  // L2 Safe contracts
  '0x3E5c63644E683549055b9Be8653de26E0B4CD36E': 'Safe: Master Copy 1.3.0 (L2)',
  '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762': 'Safe: Master Copy 1.4.1 (L2)',
  '0xfb1bffC9d739B8D520DaF37dF666da4C687191EA': 'Safe: Master Copy 1.3.0 (L2 Alt)',
  '0x69f4D1788e39c87893C980c06EdF4b7f686e2938': 'Safe: Master Copy 1.3.0 (zkSync)',
  
  // Additional official Safe contracts
  '0x41675C099F32341bf84BFc5382aF534df5C7461a': 'Safe: Master Copy 1.4.1',
  '0x017062a1dE2FE6b99BE3d9d37841FeD19F573804': 'Safe: Master Copy 1.3.0 (Gnosis)',
  '0x8942595A2dC5181Df0465AF0D7be08c8f23C93af': 'Safe: Master Copy 1.1.1 (Gnosis)',
  
  // Additional known Safe implementations
  '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B': 'Safe: Master Copy (Legacy)'
};

const CANONICAL_INITIALIZERS: { [key: string]: string } = {
  // Known Safe initializers
  '0xBD89A1CE4DDe368FFAb0eC35506eEcE0b1fFdc54': 'Safe: Initializer 1.4.1',
  '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67': 'Safe: Initializer 1.4.1 (Alt)',
  '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2': 'Safe: Initializer 1.3.0',
  '0x12302fE9c02ff50939BaAaaf415fc226C078613C': 'Safe: Initializer 1.3.0 (L2)',
  '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B': 'Safe: Initializer 1.1.1',
  '0x8942595A2dC5181Df0465AF0D7be08c8f23C93af': 'Safe: Initializer (Legacy)'
};

const CANONICAL_FALLBACK_HANDLERS: { [key: string]: string } = {
  // Known Safe fallback handlers
  '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99': 'Safe: Fallback Handler 1.4.1',
  '0x1AC114C2099aFAf5261731655Dc6c306bFcd4Dbd': 'Safe: Fallback Handler 1.3.0',
  '0x2f870a80647BbC554F3a0EBD093f11B4d2a7492A': 'Safe: Fallback Handler (Compatibility)',
  '0x0000000000000000000000000000000000000000': 'No Fallback Handler'
};

function getSafeApiUrl(network: string): string | null {
  const apiUrls: { [key: string]: string } = {
    'ethereum': 'https://safe-transaction-mainnet.safe.global',
    'sepolia': 'https://safe-transaction-sepolia.safe.global',
    'polygon': 'https://safe-transaction-polygon.safe.global',
    'arbitrum': 'https://safe-transaction-arbitrum.safe.global',
    'optimism': 'https://safe-transaction-optimism.safe.global',
    'base': 'https://safe-transaction-base.safe.global'
  };
  
  return apiUrls[network.toLowerCase()] || null;
}

function getBackendNetworkName(network: string): string {
  // Map frontend network names to backend expected names for Infura.io endpoints
  const networkMap: { [key: string]: string } = {
    'ethereum': 'mainnet',
    'sepolia': 'sepolia',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arbitrum-mainnet',
    'optimism': 'optimism-mainnet',
    'base': 'base-mainnet'
  };
  
  return networkMap[network.toLowerCase()] || network;
}

async function getInitializerFromTransaction(txHash: string): Promise<{
  initializer: string | null;
  error?: string;
}> {
  try {
    const response = await fetch('https://jgqotbhokyuasepuhzxy.supabase.co/functions/v1/get-initializer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        txhash: txHash
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        initializer: null,
        error: `Failed to fetch initializer: ${response.status} ${errorText}`
      };
    }

    const data = await response.json();
    return {
      initializer: data.initializer || null,
      error: data.error || undefined
    };
  } catch (error) {
    console.error('Error calling get-initializer function:', error);
    return {
      initializer: null,
      error: `Network error: ${error.message}`
    };
  }
}

async function checkSanctions(address: string): Promise<{
  sanctioned: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const response = await fetch('https://jgqotbhokyuasepuhzxy.supabase.co/functions/v1/check-sanctions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: address
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        sanctioned: false,
        error: `Failed to check sanctions: ${response.status} ${errorText}`
      };
    }

    const data = await response.json();
    return {
      sanctioned: data.sanctioned || false,
      data: data.data || [],
      error: undefined
    };
  } catch (error) {
    console.error('Error calling sanctions check function:', error);
    return {
      sanctioned: false,
      error: `Network error: ${error.message}`
    };
  }
}

async function checkMultipleSanctions(addresses: string[]): Promise<{
  results: { [address: string]: { sanctioned: boolean; data?: any[]; error?: string } };
  overallSanctioned: boolean;
  sanctionedAddresses: string[];
  errors: string[];
}> {
  const results: { [address: string]: { sanctioned: boolean; data?: any[]; error?: string } } = {};
  const sanctionedAddresses: string[] = [];
  const errors: string[] = [];

  // Check each address individually
  for (const address of addresses) {
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      continue; // Skip invalid or zero addresses
    }

    try {
      const result = await checkSanctions(address);
      results[address] = result;

      if (result.error) {
        errors.push(`${address}: ${result.error}`);
      } else if (result.sanctioned) {
        sanctionedAddresses.push(address);
      }

      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      const errorMsg = `${address}: ${error.message}`;
      results[address] = { sanctioned: false, error: errorMsg };
      errors.push(errorMsg);
    }
  }

  return {
    results,
    overallSanctioned: sanctionedAddresses.length > 0,
    sanctionedAddresses,
    errors
  };
}

async function getMultisigInfo(txHash: string, network: string): Promise<{
  masterCopy?: string;
  initializer?: string;
  fallbackHandler?: string;
  creator?: string;
  proxy?: string;
  proxyFactory?: string;
  initiator?: string;
  owners?: string[];
  threshold?: string;
  guard?: string | null;
  fallbackHandlerRuntime?: string | null;
  modules?: string[];
  version?: string;
  error?: string;
}> {
  try {
    network = getBackendNetworkName(network);
    const response = await fetch('https://jgqotbhokyuasepuhzxy.supabase.co/functions/v1/multisig-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        txhash: txHash,
        network: network
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `Failed to fetch multisig info: ${response.status} ${errorText}`
      };
    }

    const data = await response.json();
    return {
      masterCopy: data.masterCopy,
      initializer: data.initializer,
      fallbackHandler: data.fallbackHandler,
      creator: data.creator,
      proxy: data.proxy,
      proxyFactory: data.proxyFactory,
      initiator: data.initiator,
      owners: data.owners,
      threshold: data.threshold,
      guard: data.guard,
      fallbackHandlerRuntime: data.fallbackHandlerRuntime,
      modules: data.modules,
      version: data.version,
      error: undefined
    };
  } catch (error) {
    console.error('Error calling multisig-info function:', error);
    return {
      error: `Network error: ${error.message}`
    };
  }
}

async function performSecurityAssessment(safeAddress: string, network: string): Promise<SafeAssessment> {
  const assessment: SafeAssessment = {
    safeAddress,
    network,
    timestamp: new Date().toISOString(),
    overallRisk: 'medium',
    riskFactors: [],
    securityScore: 70,
    checks: {
      addressValidation: { isValid: false, isChecksummed: false },
      factoryValidation: { isCanonical: false, warnings: [] },
      mastercopyValidation: { isCanonical: false, warnings: [] },
      creationTransaction: { isValid: false, warnings: [] },
      safeConfiguration: { isValid: false, warnings: [] },
      ownershipValidation: { isValid: false, warnings: [] },
      moduleValidation: { isValid: false, warnings: [] },
      proxyValidation: { isValid: false, warnings: [] },
      initializerValidation: { isValid: false, warnings: [] },
      fallbackHandlerValidation: { isValid: false, warnings: [] },
      sanctionsValidation: { isValid: false, warnings: [] },
      multisigInfoValidation: { isValid: false, warnings: [] }
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
      creationTx: null,
      initializer: null,
      fallbackHandler: null,
      guard: null,
      sanctionsData: [],
      multisigInfoData: null
    }
  };

  try {
    // Address validation
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    assessment.checks.addressValidation.isValid = addressRegex.test(safeAddress);
    
    if (!assessment.checks.addressValidation.isValid) {
      assessment.riskFactors.push('Invalid address format');
      assessment.overallRisk = 'high';
      assessment.securityScore = 20;
      return assessment;
    }

    // Get Safe information from Safe API
    const safeApiUrl = getSafeApiUrl(network);
    if (!safeApiUrl) {
      assessment.riskFactors.push('Unsupported network');
      assessment.overallRisk = 'critical';
      assessment.securityScore = 0; // Cannot verify anything on unsupported network
      return assessment;
    }

    const safeInfoResponse = await fetch(`${safeApiUrl}/api/v1/safes/${safeAddress}/`);
    
    if (!safeInfoResponse.ok) {
      if (safeInfoResponse.status === 404) {
        assessment.riskFactors.push('Safe not found on this network');
      } else {
        assessment.riskFactors.push('Unable to fetch Safe information');
      }
      assessment.overallRisk = 'critical';
      assessment.securityScore = 0; // Cannot verify anything - zero security confidence
      return assessment;
    }

    const safeInfo = await safeInfoResponse.json();
    
    // Update details
    assessment.details.mastercopy = safeInfo.masterCopy;
    assessment.details.owners = safeInfo.owners || [];
    assessment.details.threshold = safeInfo.threshold;
    assessment.details.modules = safeInfo.modules || [];
    assessment.details.nonce = safeInfo.nonce;
    assessment.details.version = safeInfo.version;
    assessment.details.fallbackHandler = safeInfo.fallbackHandler;
    assessment.details.guard = safeInfo.guard;

    // Try to get creation transaction information
    try {
      const creationResponse = await fetch(`${safeApiUrl}/api/v1/safes/${safeAddress}/creation/`);
      if (creationResponse.ok) {
        const creationInfo = await creationResponse.json();
        assessment.details.creator = creationInfo.creator;
        assessment.details.factory = creationInfo.factoryAddress;
        assessment.details.creationTx = creationInfo.transactionHash;
        
        // Mark creation transaction as verified if we found it
        assessment.checks.creationTransaction.isValid = true;

        // Extract initializer from creation transaction
        if (creationInfo.transactionHash) {
          try {
            const initializerData = await getInitializerFromTransaction(creationInfo.transactionHash);
            
            if (initializerData.error) {
              console.warn('Could not extract initializer:', initializerData.error);
              assessment.checks.initializerValidation.warnings?.push(`Unable to extract initializer: ${initializerData.error}`);
            } else {
              // Set the initializer
              assessment.details.initializer = initializerData.initializer;
            }
          } catch (error) {
            console.warn('Error extracting initializer from transaction:', error);
            assessment.checks.initializerValidation.warnings?.push('Failed to extract initializer from creation transaction');
          }
        }
      } else {
        assessment.checks.creationTransaction.warnings?.push('Creation transaction not found in Safe API');
      }
    } catch (error) {
      console.warn('Could not fetch creation transaction info:', error);
      assessment.checks.creationTransaction.warnings?.push('Unable to fetch creation transaction');
    }

    // Factory validation
    if (assessment.details.factory && CANONICAL_PROXY_FACTORIES[assessment.details.factory]) {
      assessment.checks.factoryValidation.isCanonical = true;
      assessment.checks.factoryValidation.canonicalName = CANONICAL_PROXY_FACTORIES[assessment.details.factory];
    } else if (assessment.details.factory) {
      assessment.riskFactors.push('Non-canonical proxy factory detected');
      assessment.checks.factoryValidation.warnings?.push('Unknown proxy factory implementation');
    }

    // Mastercopy validation
    if (assessment.details.mastercopy && CANONICAL_MASTERCOPIES[assessment.details.mastercopy]) {
      assessment.checks.mastercopyValidation.isCanonical = true;
      assessment.checks.mastercopyValidation.canonicalName = CANONICAL_MASTERCOPIES[assessment.details.mastercopy];
    } else {
      assessment.riskFactors.push('Non-canonical mastercopy detected');
      assessment.checks.mastercopyValidation.warnings?.push('Unknown mastercopy implementation');
    }

    // Fallback Handler validation
    if (assessment.details.fallbackHandler) {
      if (CANONICAL_FALLBACK_HANDLERS[assessment.details.fallbackHandler]) {
        assessment.checks.fallbackHandlerValidation.isValid = true;
        assessment.checks.fallbackHandlerValidation.canonicalName = CANONICAL_FALLBACK_HANDLERS[assessment.details.fallbackHandler];
      } else {
        assessment.riskFactors.push('HIGH RISK: Non-canonical fallback handler detected');
        assessment.checks.fallbackHandlerValidation.warnings?.push('Unknown fallback handler - potential security risk');
        if (assessment.overallRisk !== 'critical') {
          assessment.overallRisk = 'high';
        }
      }
    } else {
      // No fallback handler is actually safer in most cases
      assessment.checks.fallbackHandlerValidation.isValid = true;
      assessment.checks.fallbackHandlerValidation.canonicalName = 'No Fallback Handler';
    }

    // Initializer validation
    if (assessment.details.initializer) {
      // Convert to lowercase for case-insensitive comparison
      const initializerLower = assessment.details.initializer.toLowerCase();
      const matchedCanonical = Object.keys(CANONICAL_INITIALIZERS).find(key => 
        key.toLowerCase() === initializerLower
      );
      
      if (matchedCanonical) {
        assessment.checks.initializerValidation.isValid = true;
        assessment.checks.initializerValidation.canonicalName = CANONICAL_INITIALIZERS[matchedCanonical];
      } else {
        assessment.riskFactors.push('CRITICAL RISK: Non-canonical initializer detected');
        assessment.checks.initializerValidation.warnings?.push('Unknown initializer - CRITICAL security risk');
        assessment.overallRisk = 'critical';
      }
    } else {
      // If we couldn't extract the initializer, it's still a warning but not critical
      assessment.checks.initializerValidation.isValid = false;
      if (!assessment.checks.initializerValidation.warnings?.some(w => w.includes('Unable to extract'))) {
        assessment.checks.initializerValidation.warnings?.push('Initializer could not be extracted from creation transaction');
      }
    }

    // Ownership validation
    console.log('Validating ownership structure:', { owners: assessment.details.owners, threshold: assessment.details.threshold });
    
    const owners = assessment.details.owners || [];
    const threshold = assessment.details.threshold;
    let ownershipIsValid = true;
    
    // Critical checks
    if (owners.length === 0) {
      assessment.riskFactors.push('CRITICAL: Safe has no owners!');
      assessment.overallRisk = 'critical';
      ownershipIsValid = false;
    }

    if (!threshold || threshold === 0) {
      assessment.riskFactors.push('CRITICAL: Safe has zero threshold!');
      assessment.overallRisk = 'critical';
      ownershipIsValid = false;
    }

    if (threshold && threshold > owners.length) {
      assessment.riskFactors.push('CRITICAL: Threshold exceeds number of owners!');
      assessment.overallRisk = 'critical';
      ownershipIsValid = false;
    }

    // Check for duplicate owners
    const uniqueOwners = new Set(owners.map(owner => owner.toLowerCase()));
    if (uniqueOwners.size !== owners.length) {
      assessment.riskFactors.push('CRITICAL: Duplicate owners detected!');
      assessment.overallRisk = 'critical';
      ownershipIsValid = false;
    }

    // Check for zero address owners
    const hasZeroAddress = owners.some(owner => 
      owner.toLowerCase() === '0x0000000000000000000000000000000000000000'
    );
    if (hasZeroAddress) {
      assessment.riskFactors.push('CRITICAL: Zero address is an owner!');
      assessment.overallRisk = 'critical';
      ownershipIsValid = false;
    }

    // High risk checks
    if (owners.length === 1 && threshold === 1) {
      assessment.riskFactors.push('HIGH RISK: Single-owner Safe with 1-of-1 threshold');
      if (assessment.overallRisk !== 'critical') {
        assessment.overallRisk = 'high';
      }
      ownershipIsValid = false;
    }

    // Medium risk checks
    if (threshold === 1 && owners.length > 1) {
      assessment.riskFactors.push('MEDIUM RISK: Low threshold detected - single signature required');
      if (assessment.overallRisk !== 'critical' && assessment.overallRisk !== 'high') {
        assessment.overallRisk = 'medium';
      }
      ownershipIsValid = false;
    }

    assessment.checks.ownershipValidation.isValid = ownershipIsValid;

    // Enhanced Sanctions validation - Check Safe address, creator, and all owners
    try {
      const addressesToCheck: string[] = [];
      
      // Add Safe address itself
      addressesToCheck.push(assessment.safeAddress);
      
      // Add creator address if available
      if (assessment.details.creator) {
        addressesToCheck.push(assessment.details.creator);
      }
      
      // Add all owner addresses
      if (assessment.details.owners && assessment.details.owners.length > 0) {
        addressesToCheck.push(...assessment.details.owners);
      }
      
      // Remove duplicates and filter out invalid addresses
      const uniqueAddresses = [...new Set(addressesToCheck)].filter(addr => 
        addr && addr !== '0x0000000000000000000000000000000000000000'
      );
      
      if (uniqueAddresses.length > 0) {
        console.log('Checking sanctions for addresses:', uniqueAddresses);
        const sanctionsResult = await checkMultipleSanctions(uniqueAddresses);
        
        // Store all results for detailed display
        assessment.details.sanctionsData = [];
        
        // Process results
        let hasSanctionedAddresses = false;
        const sanctionedDetails: string[] = [];
        
        if (sanctionsResult.errors.length > 0) {
          console.warn('Sanctions check errors:', sanctionsResult.errors);
          assessment.checks.sanctionsValidation.warnings?.push(`Some sanctions checks failed: ${sanctionsResult.errors.join('; ')}`);
        }
        
        if (sanctionsResult.overallSanctioned) {
          hasSanctionedAddresses = true;
          
          // Check each type of address for sanctions
          sanctionsResult.sanctionedAddresses.forEach(sanctionedAddr => {
            const result = sanctionsResult.results[sanctionedAddr];
            
            if (sanctionedAddr.toLowerCase() === assessment.safeAddress.toLowerCase()) {
              assessment.riskFactors.push('CRITICAL RISK: Safe wallet address is on sanctions list!');
              sanctionedDetails.push(`Safe wallet (${sanctionedAddr}): ${result.data?.[0]?.name || 'Sanctioned'}`);
            } else if (assessment.details.creator && sanctionedAddr.toLowerCase() === assessment.details.creator.toLowerCase()) {
              assessment.riskFactors.push('CRITICAL RISK: Safe creator is on sanctions list!');
              sanctionedDetails.push(`Creator (${sanctionedAddr}): ${result.data?.[0]?.name || 'Sanctioned'}`);
            } else if (assessment.details.owners.some(owner => owner.toLowerCase() === sanctionedAddr.toLowerCase())) {
              assessment.riskFactors.push('CRITICAL RISK: Safe owner is on sanctions list!');
              sanctionedDetails.push(`Owner (${sanctionedAddr}): ${result.data?.[0]?.name || 'Sanctioned'}`);
            }
            
            // Add to sanctions data for display
            if (result.data) {
              assessment.details.sanctionsData.push(...result.data);
            }
          });
          
          assessment.checks.sanctionsValidation.isValid = false;
          assessment.checks.sanctionsValidation.warnings?.push(`Sanctioned addresses found: ${sanctionedDetails.join('; ')}`);
          assessment.overallRisk = 'critical';
        } else {
          // All addresses are clear
          assessment.checks.sanctionsValidation.isValid = true;
          const checkedCount = uniqueAddresses.length;
          const ownerCount = assessment.details.owners.length;
          const hasCreator = !!assessment.details.creator;
          
          let clearMessage = `All addresses clear from sanctions (Safe`;
          if (hasCreator) clearMessage += `, creator`;
          if (ownerCount > 0) clearMessage += `, ${ownerCount} owner${ownerCount > 1 ? 's' : ''}`;
          clearMessage += `)`;
          
          assessment.checks.sanctionsValidation.canonicalName = clearMessage;
        }
        
        // Add summary to warnings if there were any issues but not complete failures
        if (sanctionsResult.errors.length > 0 && !hasSanctionedAddresses) {
          assessment.checks.sanctionsValidation.isValid = false;
        }
        
      } else {
        // No addresses available to check
        assessment.checks.sanctionsValidation.isValid = false;
        assessment.checks.sanctionsValidation.warnings?.push('No addresses available for sanctions check');
      }
      
    } catch (error) {
      console.warn('Error during enhanced sanctions check:', error);
      assessment.checks.sanctionsValidation.warnings?.push('Failed to verify sanctions status');
      assessment.checks.sanctionsValidation.isValid = false;
    }

    // Multisig Info Cross-Validation - CRITICAL SECURITY CHECK
    if (assessment.details.creationTx) {
      try {
        const multisigInfoResult = await getMultisigInfo(assessment.details.creationTx, getBackendNetworkName(network));
        
        if (multisigInfoResult.error) {
          console.warn('Could not fetch multisig info:', multisigInfoResult.error);
          assessment.checks.multisigInfoValidation.warnings?.push(`Unable to fetch multisig info: ${multisigInfoResult.error}`);
          assessment.checks.multisigInfoValidation.isValid = false;
        } else {
          assessment.details.multisigInfoData = multisigInfoResult;
          
          // Compare Safe API data with multisig-info endpoint data
          let hasDiscrepancies = false;
          const discrepancies: string[] = [];
          
          // Compare mastercopy
          if (multisigInfoResult.masterCopy && assessment.details.mastercopy) {
            if (multisigInfoResult.masterCopy.toLowerCase() !== assessment.details.mastercopy.toLowerCase()) {
              hasDiscrepancies = true;
              discrepancies.push(`Mastercopy mismatch: Safe API reports ${assessment.details.mastercopy}, blockchain reports ${multisigInfoResult.masterCopy}`);
            }
          }
          
          // Compare creator
          if (multisigInfoResult.creator && assessment.details.creator) {
            if (multisigInfoResult.creator.toLowerCase() !== assessment.details.creator.toLowerCase()) {
              hasDiscrepancies = true;
              discrepancies.push(`Creator mismatch: Safe API reports ${assessment.details.creator}, blockchain reports ${multisigInfoResult.creator}`);
            }
          }
          
          // Compare proxy factory
          if (multisigInfoResult.proxyFactory && assessment.details.factory) {
            if (multisigInfoResult.proxyFactory.toLowerCase() !== assessment.details.factory.toLowerCase()) {
              hasDiscrepancies = true;
              discrepancies.push(`Proxy factory mismatch: Safe API reports ${assessment.details.factory}, blockchain reports ${multisigInfoResult.proxyFactory}`);
            }
          }
          
          // Compare initializer
          if (multisigInfoResult.initializer && assessment.details.initializer) {
            if (multisigInfoResult.initializer.toLowerCase() !== assessment.details.initializer.toLowerCase()) {
              hasDiscrepancies = true;
              discrepancies.push(`Initializer mismatch: Safe API reports ${assessment.details.initializer}, blockchain reports ${multisigInfoResult.initializer}`);
            }
          }
          
          // Compare fallback handler
          if (multisigInfoResult.fallbackHandler && assessment.details.fallbackHandler) {
            if (multisigInfoResult.fallbackHandler.toLowerCase() !== assessment.details.fallbackHandler.toLowerCase()) {
              hasDiscrepancies = true;
              discrepancies.push(`Fallback handler mismatch: Safe API reports ${assessment.details.fallbackHandler}, blockchain reports ${multisigInfoResult.fallbackHandler}`);
            }
          }
          
          // Compare proxy address (Safe address should match the proxy)
          if (multisigInfoResult.proxy && assessment.safeAddress) {
            if (multisigInfoResult.proxy.toLowerCase() !== assessment.safeAddress.toLowerCase()) {
              hasDiscrepancies = true;
              discrepancies.push(`Proxy address mismatch: Expected ${assessment.safeAddress}, blockchain reports ${multisigInfoResult.proxy}`);
            }
          }
          
          // Compare owners
          if (multisigInfoResult.owners && assessment.details.owners) {
            const blockchainOwners = multisigInfoResult.owners.map(owner => owner.toLowerCase()).sort();
            const apiOwners = assessment.details.owners.map(owner => owner.toLowerCase()).sort();
            
            if (blockchainOwners.length !== apiOwners.length || 
                !blockchainOwners.every((owner, index) => owner === apiOwners[index])) {
              hasDiscrepancies = true;
              discrepancies.push(`Owners mismatch: Safe API reports [${assessment.details.owners.join(', ')}], blockchain reports [${multisigInfoResult.owners.join(', ')}]`);
            }
          }
          
          // Compare threshold
          if (multisigInfoResult.threshold && assessment.details.threshold) {
            const blockchainThreshold = parseInt(multisigInfoResult.threshold);
            if (blockchainThreshold !== assessment.details.threshold) {
              hasDiscrepancies = true;
              discrepancies.push(`Threshold mismatch: Safe API reports ${assessment.details.threshold}, blockchain reports ${blockchainThreshold}`);
            }
          }
          
          // Compare guard
          if (multisigInfoResult.guard !== undefined && assessment.details.guard !== undefined) {
            const blockchainGuard = multisigInfoResult.guard || '0x0000000000000000000000000000000000000000';
            const apiGuard = assessment.details.guard || '0x0000000000000000000000000000000000000000';
            
            if (blockchainGuard.toLowerCase() !== apiGuard.toLowerCase()) {
              hasDiscrepancies = true;
              discrepancies.push(`Guard mismatch: Safe API reports ${apiGuard}, blockchain reports ${blockchainGuard}`);
            }
          }
          
          // Compare modules
          if (multisigInfoResult.modules && assessment.details.modules) {
            const blockchainModules = multisigInfoResult.modules.map(module => module.toLowerCase()).sort();
            const apiModules = assessment.details.modules.map(module => module.toLowerCase()).sort();
            
            if (blockchainModules.length !== apiModules.length || 
                !blockchainModules.every((module, index) => module === apiModules[index])) {
              hasDiscrepancies = true;
              discrepancies.push(`Modules mismatch: Safe API reports [${assessment.details.modules.join(', ')}], blockchain reports [${multisigInfoResult.modules.join(', ')}]`);
            }
          }
          
          // Compare version
          if (multisigInfoResult.version && assessment.details.version) {
            if (multisigInfoResult.version !== assessment.details.version) {
              hasDiscrepancies = true;
              discrepancies.push(`Version mismatch: Safe API reports ${assessment.details.version}, blockchain reports ${multisigInfoResult.version}`);
            }
          }
          
          if (hasDiscrepancies) {
            assessment.riskFactors.push('CRITICAL SECURITY ALERT: Data discrepancies detected between Safe API and blockchain!');
            // Add each specific discrepancy as a separate risk factor for visibility
            discrepancies.forEach(discrepancy => {
              assessment.riskFactors.push(`⚠️ ${discrepancy}`);
            });
            assessment.checks.multisigInfoValidation.isValid = false;
            assessment.checks.multisigInfoValidation.warnings = discrepancies;
            assessment.overallRisk = 'critical';
            console.error('CRITICAL: Multisig info discrepancies detected:', discrepancies);
          } else {
            assessment.checks.multisigInfoValidation.isValid = true;
            assessment.checks.multisigInfoValidation.canonicalName = 'Data Verified';
          }
        }
      } catch (error) {
        console.warn('Error fetching multisig info:', error);
        assessment.checks.multisigInfoValidation.warnings?.push('Failed to verify multisig info from blockchain');
        assessment.checks.multisigInfoValidation.isValid = false;
      }
    } else {
      // No creation transaction available to check
      assessment.checks.multisigInfoValidation.isValid = false;
      assessment.checks.multisigInfoValidation.warnings?.push('No creation transaction available for cross-validation');
    }

    // Calculate final risk and score based on actual check results
    const checksPerformed = [
      assessment.checks.addressValidation.isValid,
      assessment.checks.factoryValidation.isCanonical,
      assessment.checks.mastercopyValidation.isCanonical,
      assessment.checks.creationTransaction.isValid,
      assessment.checks.safeConfiguration.isValid,
      assessment.checks.ownershipValidation.isValid,
      assessment.checks.moduleValidation.isValid,
      assessment.checks.initializerValidation.isValid,
      assessment.checks.fallbackHandlerValidation.isValid,
      assessment.checks.sanctionsValidation.isValid
    ];
    
    const passedChecks = checksPerformed.filter(check => check === true).length;
    const totalChecks = checksPerformed.length;
    
    // Calculate score based on passed checks and risk factors
    let baseScore = Math.round((passedChecks / totalChecks) * 100);
    
    // Deduct points for risk factors
    const riskPenalty = assessment.riskFactors.length * 10;
    assessment.securityScore = Math.max(0, baseScore - riskPenalty);
    
    // Determine overall risk level
    if (assessment.riskFactors.length === 0 && passedChecks === totalChecks) {
      assessment.overallRisk = 'low';
      assessment.securityScore = 100; // Perfect score for perfect results
    } else if (assessment.riskFactors.length === 0 && passedChecks >= totalChecks * 0.8) {
      assessment.overallRisk = 'low';
      assessment.securityScore = Math.max(85, assessment.securityScore);
    } else if (assessment.riskFactors.length <= 2 && passedChecks >= totalChecks * 0.6) {
      assessment.overallRisk = 'medium';
    } else {
      assessment.overallRisk = 'high';
    }

    // Mark configuration and other checks as valid if we got this far
    assessment.checks.safeConfiguration.isValid = true;
    assessment.checks.moduleValidation.isValid = assessment.details.modules.length === 0; // No modules is safer

    // Recalculate score after setting all checks
    const finalChecksPerformed = [
      assessment.checks.addressValidation.isValid,
      assessment.checks.factoryValidation.isCanonical,
      assessment.checks.mastercopyValidation.isCanonical,
      assessment.checks.creationTransaction.isValid,
      assessment.checks.safeConfiguration.isValid,
      assessment.checks.ownershipValidation.isValid,
      assessment.checks.moduleValidation.isValid,
      assessment.checks.initializerValidation.isValid,
      assessment.checks.fallbackHandlerValidation.isValid,
      assessment.checks.sanctionsValidation.isValid,
      assessment.checks.multisigInfoValidation.isValid
    ];
    
    const finalPassedChecks = finalChecksPerformed.filter(check => check === true).length;
    const finalTotalChecks = finalChecksPerformed.length;
    
    // Recalculate final score
    let finalBaseScore = Math.round((finalPassedChecks / finalTotalChecks) * 100);
    const finalRiskPenalty = assessment.riskFactors.length * 10;
    assessment.securityScore = Math.max(0, finalBaseScore - finalRiskPenalty);
    
    // Determine final risk level
    if (assessment.riskFactors.length === 0 && finalPassedChecks === finalTotalChecks) {
      assessment.overallRisk = 'low';
      assessment.securityScore = 100; // Perfect score for perfect results
    } else if (assessment.riskFactors.length === 0 && finalPassedChecks >= finalTotalChecks * 0.8) {
      assessment.overallRisk = 'low';
      assessment.securityScore = Math.max(85, assessment.securityScore);
    } else if (assessment.riskFactors.length <= 2 && finalPassedChecks >= finalTotalChecks * 0.6) {
      assessment.overallRisk = 'medium';
    } else {
      assessment.overallRisk = 'high';
    }

  } catch (error) {
    console.error('Assessment error:', error);
    assessment.riskFactors.push('Assessment failed due to network error');
    assessment.overallRisk = 'unknown';
    assessment.securityScore = 50;
  }

  return assessment;
}

interface SafeAssessment {
  safeAddress: string;
  network: string;
  timestamp: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  riskFactors: string[];
  securityScore: number;
  checks: {
    addressValidation: any;
    factoryValidation: any;
    mastercopyValidation: any;
    creationTransaction: any;
    safeConfiguration: any;
    ownershipValidation: any;
    moduleValidation: any;
    proxyValidation: any;
    initializerValidation: any;
    fallbackHandlerValidation: any;
    sanctionsValidation: any;
    multisigInfoValidation: any;
  };
  details: {
    creator: string | null;
    factory: string | null;
    mastercopy: string | null;
    version: string | null;
    owners: string[];
    threshold: number | null;
    modules: string[];
    nonce: number | null;
    creationTx: string | null;
    initializer: string | null;
    fallbackHandler: string | null;
    guard: string | null;
    sanctionsData: any[];
    multisigInfoData: any;
  };
}

const Review = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<SafeAssessment | null>(null);
  const [safeExists, setSafeExists] = useState<boolean | null>(null);
  const [isValidatingSafe, setIsValidatingSafe] = useState(false);

  // Validate Safe exists when address or network changes
  useEffect(() => {
    if (address && address.match(/^0x[a-fA-F0-9]{40}$/) && network) {
      validateSafeExists(address, network);
    } else {
      setSafeExists(null);
    }
  }, [address, network]);

  const validateSafeExists = async (safeAddress: string, selectedNetwork: string) => {
    setIsValidatingSafe(true);
    setSafeExists(null);

    try {
      const safeApiUrl = getSafeApiUrl(selectedNetwork);
      if (!safeApiUrl) {
        setSafeExists(false);
        toast({
          title: "Unsupported Network",
          description: "This network is not supported for Safe validation",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${safeApiUrl}/api/v1/safes/${safeAddress}/`);
      
      if (response.ok) {
        setSafeExists(true);
      } else if (response.status === 404) {
        setSafeExists(false);
        toast({
          title: "Safe Not Found",
          description: "No Safe wallet found at this address on the selected network",
          variant: "destructive",
        });
      } else {
        setSafeExists(false);
        toast({
          title: "Validation Error",
          description: "Unable to validate Safe existence. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error validating Safe:', error);
      setSafeExists(false);
      toast({
        title: "Network Error",
        description: "Unable to connect to Safe API for validation",
        variant: "destructive",
      });
    } finally {
      setIsValidatingSafe(false);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const addressParam = searchParams.get("address");
    const networkParam = searchParams.get("network");
    if (addressParam) {
      setAddress(addressParam);
      if (networkParam) {
        setNetwork(networkParam);
      }
      runSecurityAssessment(addressParam, networkParam || "ethereum");
    }
  }, [location.search]);

  const runSecurityAssessment = async (addr: string, selectedNetwork: string) => {
    setLoading(true);
    setAssessment(null);
    
    try {
      // Directly call Safe API from frontend for now
      const assessment = await performSecurityAssessment(addr, selectedNetwork);
      setAssessment(assessment);
    } catch (error) {
      console.error('Error performing security assessment:', error);
      // Set mock data for demo when API is not available
      setAssessment({
        safeAddress: addr,
        network: selectedNetwork,
        timestamp: new Date().toISOString(),
        overallRisk: 'medium',
        riskFactors: ['Unable to verify all security checks - API unavailable'],
        securityScore: 65,
        checks: {
          addressValidation: { isValid: true, isChecksummed: true },
          factoryValidation: { isCanonical: false, warnings: ['API unavailable'] },
          mastercopyValidation: { isCanonical: false, warnings: ['API unavailable'] },
          creationTransaction: { isValid: false, warnings: ['API unavailable'] },
          safeConfiguration: { isValid: false, warnings: ['API unavailable'] },
          ownershipValidation: { isValid: false, warnings: ['API unavailable'] },
          moduleValidation: { isValid: false, warnings: ['API unavailable'] },
          proxyValidation: { isValid: false, warnings: ['API unavailable'] },
          initializerValidation: { isValid: false, warnings: ['API unavailable'] },
          fallbackHandlerValidation: { isValid: false, warnings: ['API unavailable'] },
          sanctionsValidation: { isValid: false, warnings: ['API unavailable'] },
          multisigInfoValidation: { isValid: false, warnings: ['API unavailable'] }
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
          creationTx: null,
          initializer: null,
          fallbackHandler: null,
          guard: null,
          sanctionsData: [],
          multisigInfoData: null
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSecurityAssessment(address, network);
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'critical':
        return (
          <Badge variant="destructive" className="bg-red-600 text-white">
            <ShieldX className="w-3 h-3 mr-1" />
            Critical Risk
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="destructive" className="bg-orange-600 text-white">
            <ShieldAlert className="w-3 h-3 mr-1" />
            High Risk
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            <Shield className="w-3 h-3 mr-1" />
            Medium Risk
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="border-green-400 text-green-600">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Low Risk
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Shield className="w-3 h-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  const getCheckIcon = (check: any) => {
    if (!check) return <Shield className="w-4 h-4 text-gray-400" />;
    
    if (check.isValid === true || check.isCanonical === true) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else if (check.isValid === false || check.isCanonical === false) {
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
    
    return <Shield className="w-4 h-4 text-yellow-600" />;
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return "—";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Map network names to Safe App network identifiers
  const getSafeAppNetwork = (network: string) => {
    const networkMap: { [key: string]: string } = {
      'ethereum': 'eth',
      'sepolia': 'sep',
      'polygon': 'matic',
      'arbitrum': 'arb1',
      'optimism': 'oeth',
      'base': 'base'
    };
    return networkMap[network.toLowerCase()] || network;
  };

  // Get correct explorer URL based on network
  const getExplorerUrl = (network: string) => {
    const explorerMap: { [key: string]: string } = {
      'ethereum': 'https://etherscan.io',
      'sepolia': 'https://sepolia.etherscan.io',
      'polygon': 'https://polygonscan.com',
      'arbitrum': 'https://arbiscan.io',
      'optimism': 'https://optimistic.etherscan.io',
      'base': 'https://basescan.org'
    };
    return explorerMap[network.toLowerCase()] || 'https://etherscan.io';
  };

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderWithLoginDialog />
      
      <main className="flex-1 container py-12">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Multisignature Security Assessment</h1>
          <p className="text-muted-foreground mb-8">
            Security analysis of multisignature wallets including factory validation, 
            mastercopy verification, ownership structure review, and creation transaction analysis.
          </p>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="md:col-span-2">
              <AddressInput
                value={address}
                onChange={setAddress}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Network</label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="sepolia">Sepolia</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                  <SelectItem value="optimism">Optimism</SelectItem>
                  <SelectItem value="base">Base</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-3 flex flex-col sm:flex-row gap-3">
              <Button 
                type="submit" 
                disabled={loading || !address.match(/^0x[a-fA-F0-9]{40}$/) || isValidatingSafe || safeExists === false}
                className="jsr-button w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Multisig Wallet...
                  </>
                ) : isValidatingSafe ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating Safe...
                  </>
                ) : safeExists === false ? (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Safe Not Found
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Run Security Assessment
                  </>
                )}
              </Button>
              
              {assessment && (
                <>
                  {assessment.overallRisk === 'low' && (
                    <Button
                      className="jsr-button-alt w-full sm:w-auto"
                      onClick={() => navigate(`/monitor/new?address=${address}&network=${network}`)}
                    >
                      <span className="hidden sm:inline">Set Up Monitoring</span>
                      <span className="sm:hidden">Monitor</span>
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => window.open(`https://app.safe.global/home?safe=${getSafeAppNetwork(network)}:${address}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View in Safe App
                  </Button>
                </>
              )}
            </div>
          </form>
          
          {loading && (
            <Card className="border-jsr-blue/50 bg-jsr-blue/5 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-jsr-blue" />
                  Analyzing Multisig Wallet Security
                </CardTitle>
                <CardDescription>
                  Performing security checks including factory validation, mastercopy verification, 
                  ownership analysis, and creation transaction review...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full animate-pulse bg-jsr-blue transition-all duration-1000" style={{ width: "75%" }}></div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      <span>Address validation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4" />
                      <span>Factory verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Mastercopy check</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Ownership analysis</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {assessment && (
            <div className="space-y-6">
              {/* Assessment Summary */}
              <Card className={`${
                assessment.overallRisk === 'critical' ? 'border-red-500/50 bg-red-500/10 dark:bg-red-500/20' :
                assessment.overallRisk === 'high' ? 'border-orange-500/50 bg-orange-500/10 dark:bg-orange-500/20' :
                assessment.overallRisk === 'medium' ? 'border-yellow-500/50 bg-yellow-500/10 dark:bg-yellow-500/20' :
                assessment.overallRisk === 'low' ? 'border-green-500/50 bg-green-500/10 dark:bg-green-500/20' :
                'border-gray-500/50 bg-gray-500/10 dark:bg-gray-500/20'
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <Shield className="h-6 w-6" />
                      Security Assessment Results
                    </CardTitle>
                    {getRiskBadge(assessment.overallRisk)}
                  </div>
                  <CardDescription>
                    Assessment completed on {new Date(assessment.timestamp).toLocaleDateString()} at{' '}
                    {new Date(assessment.timestamp).toLocaleTimeString()}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="text-center">
                      <div className={`text-3xl font-bold mb-1 ${
                        assessment.securityScore >= 90 ? 'text-green-600 dark:text-green-400' :
                        assessment.securityScore >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>{assessment.securityScore}/100</div>
                      <div className="text-sm font-medium text-foreground">Security Score</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-3xl font-bold mb-1 ${
                        assessment.riskFactors.length === 0 ? 'text-green-600 dark:text-green-400' :
                        assessment.riskFactors.length <= 2 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>{assessment.riskFactors.length}</div>
                      <div className="text-sm font-medium text-foreground">Risk Factors</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-3xl font-bold mb-1 capitalize ${
                        assessment.overallRisk === 'low' ? 'text-green-600 dark:text-green-400' :
                        assessment.overallRisk === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                        assessment.overallRisk === 'high' ? 'text-red-600 dark:text-red-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>{assessment.overallRisk}</div>
                      <div className="text-sm font-medium text-foreground">Risk Level</div>
                    </div>
                  </div>
                  
                  {assessment.riskFactors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-amber-700">Risk Factors Identified:</h4>
                      <ul className="space-y-1">
                        {assessment.riskFactors.map((factor, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Safe Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Safe Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Address:</span>
                        <div className="font-mono text-xs break-all">{assessment.safeAddress}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Network:</span>
                        <div className="capitalize">{assessment.network}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Version:</span>
                        <div>{assessment.details.version || "—"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nonce:</span>
                        <div>{assessment.details.nonce !== null ? assessment.details.nonce : "—"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Threshold:</span>
                        <div>{assessment.details.threshold !== null ? 
                          `${assessment.details.threshold} of ${assessment.details.owners.length}` : "—"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Modules:</span>
                        <div>{assessment.details.modules.length || "None"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Guard:</span>
                        <div>{assessment.details.guard && assessment.details.guard !== '0x0000000000000000000000000000000000000000' ? 
                          truncateAddress(assessment.details.guard) : "None"}</div>
                      </div>
                    </div>
                    
                    {assessment.details.owners.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Owners ({assessment.details.owners.length})
                        </h4>
                        <div className="space-y-1">
                          {assessment.details.owners.map((owner, index) => (
                            <div key={index} className="font-mono text-xs p-2 bg-muted rounded">
                              {owner}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Security Checks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Security Checks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-3">
                      {/* <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.addressValidation)}
                          <span className="text-sm">Address Validation</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.addressValidation?.isValid ? 'Clear' : 'Invalid'}
                        </Badge>
                      </div> */}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.factoryValidation)}
                          <span className="text-sm">Proxy Factory</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.factoryValidation?.isCanonical ? 'Clear' : 'Issues'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.mastercopyValidation)}
                          <span className="text-sm">Mastercopy</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.mastercopyValidation?.isCanonical ? 'Clear' : 'Issues'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.ownershipValidation)}
                          <span className="text-sm">Ownership Structure</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.ownershipValidation?.isValid ? 'Clear' : 'Issues'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.initializerValidation)}
                          <span className="text-sm">Initializer</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.initializerValidation?.isValid ? 'Clear' : 'Issues'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.fallbackHandlerValidation)}
                          <span className="text-sm">Fallback Handler</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.fallbackHandlerValidation?.isValid ? 'Clear' : 'Issues'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.sanctionsValidation)}
                          <span className="text-sm">Sanctions Check</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.sanctionsValidation?.isValid ? 'Clear' : 'Issues'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.moduleValidation)}
                          <span className="text-sm">Module Configuration</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.moduleValidation?.isValid ? 'Clear' : 'Unknown'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.multisigInfoValidation)}
                          <span className="text-sm">Data Cross-Validation</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.multisigInfoValidation?.isValid ? 'Verified' : 'Issues'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Technical Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Technical Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-3">
                      <div>
                        <span className="text-muted-foreground font-medium">Creator Address:</span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.creator ? (
                            <a 
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.creator}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {truncateAddress(assessment.details.creator)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "—"}
                        </div>
                        {assessment.checks.sanctionsValidation?.isValid && (
                          <div className="text-xs text-green-600 mt-1">
                            {assessment.checks.sanctionsValidation.canonicalName || 'All addresses clear - No Sanctions'}
                          </div>
                        )}
                        {assessment.checks.sanctionsValidation?.isValid === false && assessment.details.sanctionsData?.length > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            {assessment.details.sanctionsData[0]?.name || 'Sanctioned Address Detected'}
                          </div>
                        )}
                        {assessment.checks.sanctionsValidation?.warnings && assessment.checks.sanctionsValidation.warnings.length > 0 && (
                          <div className="text-xs text-amber-600 mt-1">
                            {assessment.checks.sanctionsValidation.warnings[0]}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <span className="text-muted-foreground font-medium">Proxy Factory:</span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.factory ? (
                            <a 
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.factory}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {truncateAddress(assessment.details.factory)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "—"}
                        </div>
                        {assessment.checks.factoryValidation?.canonicalName && (
                          <div className="text-xs text-green-600 mt-1">
                            {assessment.checks.factoryValidation.canonicalName}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <span className="text-muted-foreground font-medium">Initializer:</span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.initializer ? (
                            <a 
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.initializer}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {truncateAddress(assessment.details.initializer)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "—"}
                        </div>
                        {assessment.checks.initializerValidation?.canonicalName && (
                          <div className="text-xs text-green-600 mt-1">
                            {assessment.checks.initializerValidation.canonicalName}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-muted-foreground font-medium">Mastercopy:</span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.mastercopy ? (
                            <a 
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.mastercopy}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {truncateAddress(assessment.details.mastercopy)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "—"}
                        </div>
                        {assessment.checks.mastercopyValidation?.canonicalName && (
                          <div className="text-xs text-green-600 mt-1">
                            {assessment.checks.mastercopyValidation.canonicalName}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <span className="text-muted-foreground font-medium">Fallback Handler:</span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.fallbackHandler && assessment.details.fallbackHandler !== '0x0000000000000000000000000000000000000000' ? (
                            <a 
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.fallbackHandler}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {truncateAddress(assessment.details.fallbackHandler)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "None"}
                        </div>
                        {assessment.checks.fallbackHandlerValidation?.canonicalName && (
                          <div className="text-xs text-green-600 mt-1">
                            {assessment.checks.fallbackHandlerValidation.canonicalName}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <span className="text-muted-foreground font-medium">Creation Transaction:</span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.creationTx ? (
                            <a 
                              href={`${getExplorerUrl(assessment.network)}/tx/${assessment.details.creationTx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {truncateAddress(assessment.details.creationTx)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Review;
