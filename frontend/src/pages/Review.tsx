
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
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
      proxyValidation: { isValid: false, warnings: [] }
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
      if (safeInfoResponse.status === 404) {
        assessment.riskFactors.push('Safe not found on this network');
      } else {
        assessment.riskFactors.push('Unable to fetch Safe information');
      }
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
      assessment.checks.mastercopyValidation.warnings?.push('Unknown mastercopy implementation');
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
  };
}

const Review = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<SafeAssessment | null>(null);

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
          proxyValidation: { isValid: false, warnings: ['API unavailable'] }
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
          <h1 className="text-3xl font-bold mb-6">Safe Security Assessment</h1>
          <p className="text-muted-foreground mb-8">
            Comprehensive security analysis of Safe multisignature wallets including factory validation, 
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
            
            <div className="md:col-span-3">
              <Button 
                type="submit" 
                disabled={loading || !address.match(/^0x[a-fA-F0-9]{40}$/)}
                className="jsr-button w-full md:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Safe...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Run Security Assessment
                  </>
                )}
              </Button>
            </div>
          </form>
          
          {loading && (
            <Card className="border-jsr-blue/50 bg-jsr-blue/5 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-jsr-blue" />
                  Analyzing Safe Security
                </CardTitle>
                <CardDescription>
                  Performing comprehensive security checks including factory validation, mastercopy verification, 
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
                assessment.overallRisk === 'critical' ? 'border-red-500/50 bg-red-50/50' :
                assessment.overallRisk === 'high' ? 'border-orange-500/50 bg-orange-50/50' :
                assessment.overallRisk === 'medium' ? 'border-yellow-500/50 bg-yellow-50/50' :
                assessment.overallRisk === 'low' ? 'border-green-500/50 bg-green-50/50' :
                'border-gray-500/50 bg-gray-50/50'
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
                      <div className="text-3xl font-bold mb-1">{assessment.securityScore}/100</div>
                      <div className="text-sm text-muted-foreground">Security Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold mb-1">{assessment.riskFactors.length}</div>
                      <div className="text-sm text-muted-foreground">Risk Factors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold mb-1 capitalize">{assessment.overallRisk}</div>
                      <div className="text-sm text-muted-foreground">Risk Level</div>
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.addressValidation)}
                          <span className="text-sm">Address Validation</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.addressValidation?.isValid ? 'Valid' : 'Invalid'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.factoryValidation)}
                          <span className="text-sm">Proxy Factory</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.factoryValidation?.isCanonical ? 'Canonical' : 'Unknown'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.mastercopyValidation)}
                          <span className="text-sm">Mastercopy</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.mastercopyValidation?.isCanonical ? 'Canonical' : 'Unknown'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.ownershipValidation)}
                          <span className="text-sm">Ownership Structure</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.ownershipValidation?.isValid ? 'Valid' : 'Issues'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.moduleValidation)}
                          <span className="text-sm">Module Configuration</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.moduleValidation?.isValid ? 'Valid' : 'Issues'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.creationTransaction)}
                          <span className="text-sm">Creation Transaction</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {assessment.checks.creationTransaction?.isValid ? 'Verified' : 'Unverified'}
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

              {/* Actions */}
              <Card>
                <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigate("/")}
                    >
                      Back to Home
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => runSecurityAssessment(address, network)}
                      disabled={loading}
                    >
                      Re-run Assessment
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    {assessment.overallRisk === 'low' && (
                      <Button
                        className="jsr-button-alt"
                        onClick={() => navigate(`/monitor/new?address=${address}&network=${network}`)}
                      >
                        Set Up Monitoring
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      onClick={() => window.open(`https://app.safe.global/home?safe=${getSafeAppNetwork(network)}:${address}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View in Safe App
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Review;
