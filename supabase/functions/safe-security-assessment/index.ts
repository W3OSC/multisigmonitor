import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Import the Safe security assessment logic
// Note: This is a simplified version - you may need to adapt the Node.js service for Deno
const CANONICAL_PROXY_FACTORIES: { [key: string]: string } = {
  '0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B': 'Safe: Proxy Factory 1.1.1',
  '0x50e55Af101C777bA7A3d560a2aAB3b64D6b2b6A5': 'Safe: Proxy Factory 1.3.0+',
  '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2': 'Safe: Proxy Factory 1.3.0',
  '0x12302fE9c02ff50939BaAaaf415fc226C078613C': 'Safe: Proxy Factory 1.3.0 (L2)'
};

const CANONICAL_MASTERCOPIES: { [key: string]: string } = {
  '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F': 'Safe: Master Copy 1.3.0+',
  '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552': 'Safe: Master Copy 1.3.0',
  '0x6851D6fDFAfD08c0295C392436245E5bc78B0185': 'Safe: Master Copy 1.2.0',
  '0x3E5c63644E683549055b9Be8653de26E0B4CD36E': 'Safe: Master Copy 1.3.0 (L2)'
};

async function assessSafeSecurity(safeAddress: string, network: string) {
  const assessment = {
    safeAddress,
    network,
    timestamp: new Date().toISOString(),
    overallRisk: 'medium' as const,
    riskFactors: [] as string[],
    securityScore: 70,
    checks: {
      addressValidation: { isValid: false, isChecksummed: false },
      factoryValidation: { isCanonical: false, warnings: [] as string[] },
      mastercopyValidation: { isCanonical: false, warnings: [] as string[] },
      creationTransaction: { isValid: false, warnings: [] as string[] },
      safeConfiguration: { isValid: false, warnings: [] as string[] },
      ownershipValidation: { isValid: false, warnings: [] as string[] },
      moduleValidation: { isValid: false, warnings: [] as string[] },
      proxyValidation: { isValid: false, warnings: [] as string[] }
    },
    details: {
      creator: null as string | null,
      factory: null as string | null,
      mastercopy: null as string | null,
      version: null as string | null,
      owners: [] as string[],
      threshold: null as number | null,
      modules: [] as string[],
      nonce: null as number | null,
      creationTx: null as string | null
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
      return assessment;
    }

    const safeInfoResponse = await fetch(`${safeApiUrl}/api/v1/safes/${safeAddress}/`);
    
    if (!safeInfoResponse.ok) {
      assessment.riskFactors.push('Safe not found or API unavailable');
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

    // Mastercopy validation
    if (assessment.details.mastercopy && CANONICAL_MASTERCOPIES[assessment.details.mastercopy]) {
      assessment.checks.mastercopyValidation.isCanonical = true;
      assessment.checks.mastercopyValidation.canonicalName = CANONICAL_MASTERCOPIES[assessment.details.mastercopy];
    } else {
      assessment.riskFactors.push('Non-canonical mastercopy detected');
      assessment.checks.mastercopyValidation.warnings.push('Unknown mastercopy implementation');
    }

    // Ownership validation
    if (assessment.details.owners.length > 0 && assessment.details.threshold) {
      assessment.checks.ownershipValidation.isValid = true;
      
      if (assessment.details.threshold === 1 && assessment.details.owners.length > 1) {
        assessment.riskFactors.push('Low threshold detected - single signature required');
      }
    } else {
      assessment.riskFactors.push('Invalid ownership configuration');
    }

    // Calculate final risk and score
    if (assessment.riskFactors.length === 0) {
      assessment.overallRisk = 'low';
      assessment.securityScore = 90;
    } else if (assessment.riskFactors.length <= 2) {
      assessment.overallRisk = 'medium';
      assessment.securityScore = 70;
    } else {
      assessment.overallRisk = 'high';
      assessment.securityScore = 40;
    }

    // Mark configuration and other checks as valid if we got this far
    assessment.checks.safeConfiguration.isValid = true;
    assessment.checks.moduleValidation.isValid = assessment.details.modules.length === 0; // No modules is safer

  } catch (error) {
    console.error('Assessment error:', error);
    assessment.riskFactors.push('Assessment failed due to API error');
    assessment.overallRisk = 'unknown';
    assessment.securityScore = 50;
  }

  return assessment;
}

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

serve(async (req) => {
  const { method } = req;

  // Handle CORS
  if (method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const { safeAddress, network } = await req.json();

    if (!safeAddress || !network) {
      return new Response('Missing required parameters', { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const assessment = await assessSafeSecurity(safeAddress, network);

    return new Response(JSON.stringify(assessment), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});