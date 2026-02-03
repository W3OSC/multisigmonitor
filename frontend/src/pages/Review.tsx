import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { securityApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AddressInput } from "@/components/AddressInput";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  Factory,
  FileCheck,
  Home,
  Key,
  Loader2,
  Network,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";




async function performSecurityAssessment(
  safeAddress: string,
  network: string,
): Promise<SafeAssessment> {
  const response = await fetch("http://localhost:7111/api/safe/assess", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      safe_address: safeAddress,
      network: network,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    const error: any = new Error(errorData.message || `Assessment failed: ${response.status}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return await response.json();
}

interface SafeAssessment {
  safeAddress: string;
  network: string;
  timestamp: string;
  overallRisk: "low" | "medium" | "high" | "critical" | "unknown";
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
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [assessment, setAssessment] = useState<SafeAssessment | null>(null);
  const [safeExists, setSafeExists] = useState<boolean | null>(null);

  // Animate loading steps
  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 800);
      return () => clearInterval(interval);
    }
  }, [loading]);



  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const addressParam = searchParams.get("address");
    const networkParam = searchParams.get("network");
    const analysisIdParam = searchParams.get("analysisId");

    if (analysisIdParam) {
      loadExistingAnalysis(analysisIdParam, addressParam, networkParam);
    } else if (addressParam) {
      setAddress(addressParam);
      if (networkParam) {
        setNetwork(networkParam);
      }
      runSecurityAssessment(addressParam, networkParam || "ethereum");
    }
  }, [location.search]);

  const loadExistingAnalysis = async (
    analysisId: string,
    addr: string | null,
    net: string | null,
  ) => {
    setLoading(true);
    try {
      const analysis = await securityApi.getAnalysis(analysisId);

      if (addr) setAddress(addr);
      else setAddress(analysis.safeAddress || analysis.safe_address);

      if (net) setNetwork(net);
      else setNetwork(analysis.network);

      setAssessment(analysis.assessment);
    } catch (error) {
      console.error("Failed to load existing review:", error);
      toast({
        title: "Error",
        description: "Failed to load existing review",
        variant: "destructive",
      });

      if (addr && net) {
        runSecurityAssessment(addr, net);
      }
    } finally {
      setLoading(false);
    }
  };

  const runSecurityAssessment = async (
    addr: string,
    selectedNetwork: string,
  ) => {
    setLoading(true);
    setAssessment(null);
    setSafeExists(null);

    try {
      const assessment = await performSecurityAssessment(addr, selectedNetwork);
      setAssessment(assessment);
      setSafeExists(true);
      console.log("Security assessment completed");
    } catch (error: any) {
      console.error("Error performing security assessment:", error);
      
      if (error.status === 404) {
        setSafeExists(false);
        toast({
          title: "Safe Not Found",
          description: "No Safe wallet found at this address on the selected network",
          variant: "destructive",
        });
      } else if (error.status === 400) {
        setSafeExists(false);
        toast({
          title: "Invalid Request",
          description: error.message || "The network or address provided is not valid",
          variant: "destructive",
        });
      } else {
        setSafeExists(false);
        toast({
          title: "Assessment Failed",
          description:
            error.message || "Unable to perform security assessment. Please try again.",
          variant: "destructive",
        });
      }
      setAssessment(null);
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
      case "critical":
        return (
          <Badge variant="destructive" className="bg-red-600 text-white">
            <ShieldX className="w-3 h-3 mr-1" />
            Critical Risk
          </Badge>
        );
      case "high":
        return (
          <Badge variant="destructive" className="bg-orange-600 text-white">
            <ShieldAlert className="w-3 h-3 mr-1" />
            High Risk
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            <Shield className="w-3 h-3 mr-1" />
            Medium Risk
          </Badge>
        );
      case "low":
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

    const severity = check.severity;
    
    switch (severity) {
      case "pass":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "info":
        return <Shield className="w-4 h-4 text-blue-500" />;
      case "low":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case "medium":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "high":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "critical":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        if (check.isValid === true || check.isCanonical === true) {
          return <CheckCircle className="w-4 h-4 text-green-600" />;
        } else if (check.isValid === false || check.isCanonical === false) {
          return <AlertTriangle className="w-4 h-4 text-red-600" />;
        }
        return <Shield className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getSeverityLabel = (check: any): string => {
    if (!check) return "Unknown";
    
    const severity = check.severity;
    switch (severity) {
      case "pass":
        return "Clear";
      case "info":
        return "Info";
      case "low":
        return "Low";
      case "medium":
        return "Medium";
      case "high":
        return "High";
      case "critical":
        return "Critical";
      default:
        if (check.isValid === true || check.isCanonical === true) {
          return "Clear";
        } else if (check.isValid === false || check.isCanonical === false) {
          return "Issues";
        }
        return "Unknown";
    }
  };

  const getSeverityBadgeVariant = (check: any): "default" | "secondary" | "destructive" | "outline" => {
    if (!check) return "outline";
    
    const severity = check.severity;
    switch (severity) {
      case "pass":
        return "outline";
      case "info":
        return "secondary";
      case "low":
      case "medium":
        return "secondary";
      case "high":
      case "critical":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Map network names to Safe App network identifiers
  const getSafeAppNetwork = (network: string) => {
    const networkMap: { [key: string]: string } = {
      ethereum: "eth",
      sepolia: "sep",
      polygon: "matic",
      arbitrum: "arb1",
      optimism: "oeth",
      base: "base",
    };
    return networkMap[network.toLowerCase()] || network;
  };

  // Get correct explorer URL based on network
  const getExplorerUrl = (network: string) => {
    const explorerMap: { [key: string]: string } = {
      ethereum: "https://etherscan.io",
      sepolia: "https://sepolia.etherscan.io",
      polygon: "https://polygonscan.com",
      arbitrum: "https://arbiscan.io",
      optimism: "https://optimistic.etherscan.io",
      base: "https://basescan.org",
    };
    return explorerMap[network.toLowerCase()] || "https://etherscan.io";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container py-12">
        <div className="w-full">
          <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Home className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">Security Assessment</span>
          </div>

          <h1 className="text-3xl font-bold mb-6">
            Multisignature Wallet Security Assessment
          </h1>
          <p className="text-muted-foreground mb-8">
            Security analysis of multisignature wallets including factory
            validation, mastercopy verification, ownership structure review, and
            creation transaction analysis.
          </p>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
          >
            <div className="md:col-span-2">
              <AddressInput value={address} onChange={setAddress} />
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
                disabled={
                  loading ||
                  !address.match(/^0x[a-fA-F0-9]{40}$/) ||
                  safeExists === false
                }
                className="jsr-button w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Multisig Wallet...
                  </>
                ) : safeExists === false ? (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Safe Not Found
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Rescan Address
                  </>
                )}
              </Button>

              {assessment && (
                <>
                  {assessment.overallRisk === "low" && (
                    <Button
                      className="jsr-button-alt w-full sm:w-auto"
                      onClick={() =>
                        navigate(
                          `/monitor/new?address=${address}&network=${network}`,
                        )
                      }
                    >
                      <span className="hidden sm:inline">
                        Set Up Monitoring
                      </span>
                      <span className="sm:hidden">Monitor</span>
                    </Button>
                  )}

                  <Button
                    className="jsr-button-alt w-full sm:w-auto"
                    // variant="outline"
                    onClick={() =>
                      window.open(
                        `https://app.safe.global/home?safe=${getSafeAppNetwork(network)}:${address}`,
                        "_blank",
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View in Safe App
                  </Button>
                </>
              )}
            </div>
          </form>

          {loading && (
            <Card className="border-jsr-blue/50 bg-jsr-blue/5 dark:bg-jsr-blue/10 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-jsr-blue" />
                  Analyzing Multisig Wallet Security
                </CardTitle>
                <CardDescription>
                  Running comprehensive security analysis on the Safe wallet...
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-jsr-blue transition-all duration-500 ease-out"
                    style={{ width: `${(loadingStep + 1) * 25}%` }}
                  ></div>
                </div>
                
                <div className="space-y-2">
                  <div className={`flex items-center gap-3 transition-all ${loadingStep >= 0 ? 'opacity-100' : 'opacity-40'}`}>
                    {loadingStep > 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-jsr-blue flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">Address Validation</div>
                      <div className="text-xs text-muted-foreground">Verifying Safe wallet address and network</div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 transition-all ${loadingStep >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                    {loadingStep > 1 ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : loadingStep === 1 ? (
                      <Loader2 className="h-5 w-5 animate-spin text-jsr-blue flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">Factory Verification</div>
                      <div className="text-xs text-muted-foreground">Checking proxy factory authenticity</div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 transition-all ${loadingStep >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                    {loadingStep > 2 ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : loadingStep === 2 ? (
                      <Loader2 className="h-5 w-5 animate-spin text-jsr-blue flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">Mastercopy Analysis</div>
                      <div className="text-xs text-muted-foreground">Validating implementation contract</div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 transition-all ${loadingStep >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                    {loadingStep > 3 ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : loadingStep === 3 ? (
                      <Loader2 className="h-5 w-5 animate-spin text-jsr-blue flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">Ownership Review</div>
                      <div className="text-xs text-muted-foreground">Analyzing signers and threshold configuration</div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 text-xs text-muted-foreground text-center">
                  This usually takes 5-10 seconds
                </div>
              </CardContent>
            </Card>
          )}

          {assessment && (
            <div className="space-y-6">
              {/* Assessment Summary */}
              <Card
                className={`${
                  assessment.overallRisk === "critical"
                    ? "border-red-500/50 bg-red-500/10 dark:bg-red-500/20"
                    : assessment.overallRisk === "high"
                      ? "border-orange-500/50 bg-orange-500/10 dark:bg-orange-500/20"
                      : assessment.overallRisk === "medium"
                        ? "border-yellow-500/50 bg-yellow-500/10 dark:bg-yellow-500/20"
                        : assessment.overallRisk === "low"
                          ? "border-green-500/50 bg-green-500/10 dark:bg-green-500/20"
                          : "border-gray-500/50 bg-gray-500/10 dark:bg-gray-500/20"
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <Shield className="h-6 w-6" />
                      Security Assessment Results
                    </CardTitle>
                    {getRiskBadge(assessment.overallRisk)}
                  </div>
                  <CardDescription>
                    Assessment completed on{" "}
                    {new Date(assessment.timestamp).toLocaleDateString()} at{" "}
                    {new Date(assessment.timestamp).toLocaleTimeString()}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="text-center">
                      <div
                        className={`text-3xl font-bold mb-1 ${
                          assessment.securityScore >= 90
                            ? "text-green-600 dark:text-green-400"
                            : assessment.securityScore >= 70
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {assessment.securityScore}/100
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        Security Score
                      </div>
                    </div>
                    <div className="text-center">
                      <div
                        className={`text-3xl font-bold mb-1 ${
                          assessment.riskFactors.length === 0
                            ? "text-green-600 dark:text-green-400"
                            : assessment.riskFactors.length <= 2
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {assessment.riskFactors.length}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        Risk Factors
                      </div>
                    </div>
                    <div className="text-center">
                      <div
                        className={`text-3xl font-bold mb-1 capitalize ${
                          assessment.overallRisk === "low"
                            ? "text-green-600 dark:text-green-400"
                            : assessment.overallRisk === "medium"
                              ? "text-yellow-600 dark:text-yellow-400"
                              : assessment.overallRisk === "high"
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {assessment.overallRisk}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        Risk Level
                      </div>
                    </div>
                  </div>

                  {assessment.riskFactors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-amber-700">
                        Risk Factors Identified:
                      </h4>
                      <ul className="space-y-1">
                        {assessment.riskFactors.map((factor, index) => (
                          <li
                            key={index}
                            className="flex items-center gap-2 text-sm"
                          >
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
                        <div className="font-mono text-xs break-all">
                          {assessment.safeAddress}
                        </div>
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
                        <div>
                          {assessment.details.nonce !== null
                            ? assessment.details.nonce
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Threshold:
                        </span>
                        <div>
                          {assessment.details.threshold !== null
                            ? `${assessment.details.threshold} of ${assessment.details.owners.length}`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Modules:</span>
                        <div>{assessment.details.modules.length || "None"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Guard:</span>
                        <div>
                          {assessment.details.guard &&
                          assessment.details.guard !==
                            "0x0000000000000000000000000000000000000000"
                            ? assessment.details.guard || "—"
                            : "None"}
                        </div>
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
                            <div
                              key={index}
                              className="font-mono text-xs p-2 bg-muted rounded"
                            >
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
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.addressValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.addressValidation)}
                        </Badge>
                      </div> */}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.factoryValidation)}
                          <span className="text-sm">Proxy Factory</span>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.factoryValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.factoryValidation)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.mastercopyValidation)}
                          <span className="text-sm">Mastercopy</span>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.mastercopyValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.mastercopyValidation)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.ownershipValidation)}
                          <span className="text-sm">Ownership Structure</span>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.ownershipValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.ownershipValidation)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(
                            assessment.checks.initializerValidation,
                          )}
                          <span className="text-sm">Initializer</span>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.initializerValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.initializerValidation)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(
                            assessment.checks.fallbackHandlerValidation,
                          )}
                          <span className="text-sm">Fallback Handler</span>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.fallbackHandlerValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.fallbackHandlerValidation)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.sanctionsValidation)}
                          <span className="text-sm">Sanctions Check</span>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.sanctionsValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.sanctionsValidation)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(assessment.checks.moduleValidation)}
                          <span className="text-sm">Module Configuration</span>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.moduleValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.moduleValidation)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCheckIcon(
                            assessment.checks.multisigInfoValidation,
                          )}
                          <span className="text-sm">Data Cross-Validation</span>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(assessment.checks.multisigInfoValidation)} className="text-xs">
                          {getSeverityLabel(assessment.checks.multisigInfoValidation)}
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
                        <span className="text-muted-foreground font-medium">
                          Creator Address:
                        </span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.creator ? (
                            <a
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.creator}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {assessment.details.creator || "—"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        {assessment.checks.sanctionsValidation?.severity === "pass" && (
                          <div className="text-xs text-green-600 mt-1">
                            {assessment.checks.sanctionsValidation
                              .canonicalName ||
                              "All addresses clear - No Sanctions"}
                          </div>
                        )}
                        {assessment.checks.sanctionsValidation?.severity === "critical" &&
                          assessment.details.sanctionsData?.length > 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              {assessment.details.sanctionsData[0]?.name ||
                                "Sanctioned Address Detected"}
                            </div>
                          )}
                        {assessment.checks.sanctionsValidation?.warnings &&
                          assessment.checks.sanctionsValidation.warnings
                            .length > 0 && (
                            <div className="text-xs text-amber-600 mt-1">
                              {
                                assessment.checks.sanctionsValidation
                                  .warnings[0]
                              }
                            </div>
                          )}
                      </div>

                      <div>
                        <span className="text-muted-foreground font-medium">
                          Proxy Factory:
                        </span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.factory ? (
                            <a
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.factory}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {assessment.details.factory || "—"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        {assessment.checks.factoryValidation?.canonicalName && (
                          <div className="text-xs text-green-600 mt-1">
                            {assessment.checks.factoryValidation.canonicalName}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-muted-foreground font-medium">
                          Initializer:
                        </span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.initializer ? (
                            <a
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.initializer}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {assessment.details.initializer || "—"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        {assessment.checks.initializerValidation
                          ?.canonicalName && (
                          <div className="text-xs text-green-600 mt-1">
                            {
                              assessment.checks.initializerValidation
                                .canonicalName
                            }
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-muted-foreground font-medium">
                          Mastercopy:
                        </span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.mastercopy ? (
                            <a
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.mastercopy}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {assessment.details.mastercopy || "—"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        {assessment.checks.mastercopyValidation
                          ?.canonicalName && (
                          <div className="text-xs text-green-600 mt-1">
                            {
                              assessment.checks.mastercopyValidation
                                .canonicalName
                            }
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-muted-foreground font-medium">
                          Fallback Handler:
                        </span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.fallbackHandler &&
                          assessment.details.fallbackHandler !==
                            "0x0000000000000000000000000000000000000000" ? (
                            <a
                              href={`${getExplorerUrl(assessment.network)}/address/${assessment.details.fallbackHandler}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {assessment.details.fallbackHandler || "—"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "None"
                          )}
                        </div>
                        {assessment.checks.fallbackHandlerValidation
                          ?.canonicalName && (
                          <div className="text-xs text-green-600 mt-1">
                            {
                              assessment.checks.fallbackHandlerValidation
                                .canonicalName
                            }
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-muted-foreground font-medium">
                          Creation Transaction:
                        </span>
                        <div className="font-mono text-xs mt-1">
                          {assessment.details.creationTx ? (
                            <a
                              href={`${getExplorerUrl(assessment.network)}/tx/${assessment.details.creationTx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {assessment.details.creationTx || "—"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
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
