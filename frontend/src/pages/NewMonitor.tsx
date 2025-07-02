import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { HeaderWithLoginDialog } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressInput } from "@/components/AddressInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// This would be fetched from your API in a real app
const SUPPORTED_NETWORKS = [
  { id: "ethereum", name: "Ethereum" },
  { id: "sepolia", name: "Sepolia" },
  { id: "polygon", name: "Polygon" },
  { id: "arbitrum", name: "Arbitrum" },
  { id: "optimism", name: "Optimism" },
  { id: "base", name: "Base" },
  { id: "gnosis", name: "Gnosis Chain" },
];

const NewMonitor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [address, setAddress] = useState("");
  const [isValidSafe, setIsValidSafe] = useState<boolean | null>(null);
  const [isCheckingSafe, setIsCheckingSafe] = useState(false);
  const [alias, setAlias] = useState("");
  const [network, setNetwork] = useState("ethereum");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user, setIsLoginDialogOpen } = useAuth();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const addressParam = searchParams.get("address");
    const networkParam = searchParams.get("network");
    
    if (addressParam) {
      setAddress(addressParam);
    }
    
    if (networkParam && SUPPORTED_NETWORKS.some(n => n.id === networkParam.toLowerCase())) {
      setNetwork(networkParam.toLowerCase());
    }
  }, [location.search]);

  const handleLogin = () => {
    // Construct the current URL with parameters to redirect back after login
    const currentUrl = new URL(window.location.href);
    
    // Update URL params with current form values if they exist
    if (address) {
      currentUrl.searchParams.set('address', address);
    }
    if (network) {
      currentUrl.searchParams.set('network', network);
    }
    
    // Store the redirect URL for after login
    sessionStorage.setItem('redirectAfterLogin', currentUrl.toString());
    
    setIsLoginDialogOpen(true);
  };

  const isFormValid = () => {
    // Only validate the basic monitor info in the first step
    // Address must be a valid ETH address and confirmed as a supported multisignature wallet
    return address.match(/^0x[a-fA-F0-9]{40}$/) && network && isValidSafe === true;
  };

  // Check if an address is a supported multisignature wallet on the specified network
  const checkIsSafe = async (address: string, network: string) => {
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setIsValidSafe(null);
      return;
    }
    
    setIsCheckingSafe(true);
    setIsValidSafe(null);
    
    try {
      // Network-specific API URLs for Multisignature Transaction Service
      const txServiceUrl = (() => {
        switch(network.toLowerCase()) {
          case 'ethereum': return 'https://safe-transaction-mainnet.safe.global';
          case 'sepolia': return 'https://safe-transaction-sepolia.safe.global';
          case 'polygon': return 'https://safe-transaction-polygon.safe.global';
          case 'arbitrum': return 'https://safe-transaction-arbitrum.safe.global';
          case 'optimism': return 'https://safe-transaction-optimism.safe.global';
          case 'base': return 'https://safe-transaction-base.safe.global';
          case 'gnosis': return 'https://safe-transaction-gnosis-chain.safe.global';
          case 'goerli': return 'https://safe-transaction-goerli.safe.global';
          case 'sepolia': return 'https://safe-transaction-sepolia.safe.global';
          default: return 'https://safe-transaction-mainnet.safe.global';
        }
      })();
      
      // Call the Safe Info API to check if this is a valid Safe
      const response = await axios.get(`${txServiceUrl}/api/v1/safes/${address}`);
      
      // If we get a successful response, it's a valid Safe
      setIsValidSafe(true);
    } catch (error) {
      // If we get a 404, the address isn't a Safe
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setIsValidSafe(false);
      } else {
        // For other errors, we can't determine validity
        console.error('Error checking multisignature wallet:', error);
        setIsValidSafe(null);
      }
    } finally {
      setIsCheckingSafe(false);
    }
  };

  // Validate the multisignature wallet when address or network changes, with debounce
  useEffect(() => {
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setIsValidSafe(null);
      return;
    }
    
    const timer = setTimeout(() => {
      checkIsSafe(address, network);
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timer);
  }, [address, network]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast({
        title: "Invalid Form",
        description: "Please provide a valid multisignature wallet address on the selected network",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create a monitor",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create minimal settings object for the first step
      const settings = {
        alias: alias || null,
        active: true,
        // Default notification settings (will be configured in step 2)
        notify: false,
        alertType: "all",
        managementOnly: false,
        notifications: []
      };

      // Insert into Supabase
      const { data, error } = await supabase
        .from('monitors')
        .insert({
          user_id: user.id,
          safe_address: address,
          network: network.toLowerCase(),
          settings
        })
        .select();

      if (error) throw error;

      toast({
        title: "Monitor Created",
        description: "Now let's set up notifications for this monitor",
      });
      
      // Redirect to the notification configuration page for this monitor
      // Pass newSetup=true to indicate this is a new monitor setup
      if (data && data[0]) {
        navigate(`/monitor/config/${data[0].id}?newSetup=true`);
      } else {
        // Fallback if we couldn't get the ID
        navigate("/monitor");
      }
    } catch (error: any) {
      console.error('Error creating monitor:', error);
      toast({
        title: "Error Creating Monitor",
        description: error.message || "There was a problem creating your monitor",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <HeaderWithLoginDialog />
        
        <main className="flex-1 container py-12 flex flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sign In Required</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* <CardDescription>
                You need to sign in to set up monitoring for your multisignature wallet
              </CardDescription> */}
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Monitoring requires an account to store your preferences and send notifications.
              </p>
              
              <div className="flex justify-center">
                <Button
                  onClick={handleLogin}
                  className="w-full"
                >
                  Sign In to Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderWithLoginDialog />
      
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/monitor")}
            className="mb-6"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle>Set Up New Monitor</CardTitle>
              <CardDescription>
                Configure monitoring for a multisignature wallet
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="network">Network</Label>
                  <Select
                    value={network}
                    onValueChange={setNetwork}
                  >
                    <SelectTrigger id="network">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_NETWORKS.map((net) => (
                        <SelectItem key={net.id} value={net.id}>
                          {net.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <AddressInput
                    value={address}
                    onChange={setAddress}
                    label="Multisignature Address"
                    placeholder="0x..."
                  />
                  
                  {address && address.match(/^0x[a-fA-F0-9]{40}$/) && (
                    <div className="mt-2">
                      {isCheckingSafe ? (
                        <div className="flex items-center text-muted-foreground text-sm">
                          <Loader2 className="animate-spin h-3 w-3 mr-1" />
                          Checking if this is a supported multisignature wallet...
                        </div>
                      ) : isValidSafe === true ? (
                        <Alert className="py-2 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                          <AlertDescription className="text-green-600 dark:text-green-400 text-sm flex items-center">
                            ✓ Supported multisignature wallet address confirmed on {SUPPORTED_NETWORKS.find(n => n.id === network)?.name}
                          </AlertDescription>
                        </Alert>
                      ) : isValidSafe === false ? (
                        <Alert className="py-2 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
                          <AlertDescription className="text-red-600 dark:text-red-400 text-sm flex items-center">
                            ✗ This address is not a supported multisignature wallet on {SUPPORTED_NETWORKS.find(n => n.id === network)?.name}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="alias">Alias (Optional)</Label>
                  <Input
                    id="alias"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="My Treasury Multisignature Wallet"
                  />
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/monitor")}
                >
                  Cancel
                </Button>
                
                <Button 
                  type="submit"
                  disabled={isSubmitting || !isFormValid()}
                  className="jsr-button"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Monitor & Configure Notifications"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default NewMonitor;
