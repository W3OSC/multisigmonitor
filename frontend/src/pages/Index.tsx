
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { HeaderWithLoginDialog } from "@/components/Header";
import { AddressInput } from "@/components/AddressInput";
import { AlertCircle, Shield, Eye, Network } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Index = () => {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("ethereum");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      navigate("/monitor");
    }
  }, [user, navigate]);

  const validateInputs = () => {
    if (!address) {
      toast({
        title: "Address Required",
        description: "Please enter a Safe address",
        variant: "destructive",
      });
      return false;
    }
    
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const handleReview = () => {
    if (!validateInputs()) return;
    navigate(`/review?address=${address}&network=${network}`);
  };

  const handleMonitor = () => {
    if (!validateInputs()) return;
    navigate(`/monitor/new?address=${address}&network=${network}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderWithLoginDialog />
      
      <main className="flex-1 container max-w-6xl">
        <div className="py-12 md:py-20">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8 animate-float">
              <div className="absolute inset-0 rounded-full bg-jsr-lime/20 blur-xl"></div>
              <Shield className="relative h-16 w-16 text-jsr-lime" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="jsr-text-gradient">multisig</span>monitor
            </h1>
            
            <p className="max-w-[42rem] text-lg text-muted-foreground mb-8">
              Monitor and review your multisignature wallets. Get notified about suspicious transactions and keep your assets secure.
            </p>
            
            <div className="w-full max-w-lg space-y-6 mb-12">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Safe Address & Network
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <AddressInput
                        value={address}
                        onChange={setAddress}
                        placeholder="Enter multisignature address (0x...)"
                      />
                    </div>
                    <div className="w-32">
                      <Select value={network} onValueChange={setNetwork}>
                        <SelectTrigger className="w-full">
                          <div className="flex items-center gap-2">
                            <Network className="h-4 w-4" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ethereum">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              Ethereum
                            </div>
                          </SelectItem>
                          <SelectItem value="sepolia">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                              Sepolia Testnet
                            </div>
                          </SelectItem>
                          <SelectItem value="polygon">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                              Polygon
                            </div>
                          </SelectItem>
                          <SelectItem value="arbitrum">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                              Arbitrum
                            </div>
                          </SelectItem>
                          <SelectItem value="optimism">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                              Optimism
                            </div>
                          </SelectItem>
                          <SelectItem value="base">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                              Base
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={handleReview}
                  disabled={!address}
                  className="jsr-button group flex items-center gap-2"
                >
                  <AlertCircle className="h-5 w-5 group-hover:animate-pulse" />
                  Security Review
                </Button>
                
                <Button 
                  onClick={handleMonitor}
                  disabled={!address}
                  className="jsr-button-alt group flex items-center gap-2"
                >
                  <Eye className="h-5 w-5 group-hover:animate-pulse" />
                  Set Up Monitor
                </Button>
              </div>
              
              {network && (
                <p className="text-xs text-muted-foreground text-center">
                  Selected network: <span className="font-medium capitalize">{network}</span>
                  {network === 'sepolia' && ' (Testnet)'}
                </p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="jsr-card p-6">
              <div className="mb-4 bg-jsr-purple/30 rounded-full w-12 h-12 flex items-center justify-center">
                <Shield className="h-6 w-6 text-jsr-purple" />
              </div>
              <h3 className="text-xl font-bold mb-2">Verify Transactions</h3>
              <p className="text-muted-foreground">
                Review pending transactions for suspicious activity before they are executed
              </p>
            </div>
            
            <div className="jsr-card p-6">
              <div className="mb-4 bg-jsr-orange/30 rounded-full w-12 h-12 flex items-center justify-center">
                <Eye className="h-6 w-6 text-jsr-orange" />
              </div>
              <h3 className="text-xl font-bold mb-2">24/7 Monitoring</h3>
              <p className="text-muted-foreground">
                Continuous monitoring of your multisignature wallets for any suspicious activity
              </p>
            </div>
            
            <div className="jsr-card p-6">
              <div className="mb-4 bg-jsr-lime/30 rounded-full w-12 h-12 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-jsr-lime" />
              </div>
              <h3 className="text-xl font-bold mb-2">Instant Alerts</h3>
              <p className="text-muted-foreground">
                Get notified immediately through your preferred channels when something looks suspicious
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 md:h-16">
          <p className="text-sm text-muted-foreground">
          </p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/fredrik0x/multisigmonitor/" className="text-sm text-muted-foreground hover:text-foreground">
              Contribute
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
