
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HeaderWithLoginDialog } from "@/components/Header";
import { AddressInput } from "@/components/AddressInput";
import { AlertCircle, Shield, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [address, setAddress] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleReview = () => {
    if (!address) {
      toast({
        title: "Address Required",
        description: "Please enter a Safe address to review",
        variant: "destructive",
      });
      return;
    }
    
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      });
      return;
    }
    
    navigate(`/review?address=${address}`);
  };

  const handleMonitor = () => {
    if (!address) {
      toast({
        title: "Address Required",
        description: "Please enter a Safe address to monitor",
        variant: "destructive",
      });
      return;
    }
    
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      });
      return;
    }
    
    navigate(`/monitor/new?address=${address}`);
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
              <span className="jsr-text-gradient">safe</span>monitor
            </h1>
            
            <p className="max-w-[42rem] text-lg text-muted-foreground mb-8">
              Monitor and review your Safe.global multisignature vaults. Get notified about suspicious transactions and keep your assets secure.
            </p>
            
            <div className="w-full max-w-md space-y-6 mb-12">
              <AddressInput
                value={address}
                onChange={setAddress}
                placeholder="Enter Safe address (0x...)"
              />
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={handleReview}
                  className="jsr-button group flex items-center gap-2"
                >
                  <AlertCircle className="h-5 w-5 group-hover:animate-pulse" />
                  Review
                </Button>
                
                <Button 
                  onClick={handleMonitor}
                  className="jsr-button-alt group flex items-center gap-2"
                >
                  <Eye className="h-5 w-5 group-hover:animate-pulse" />
                  Monitor
                </Button>
              </div>
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
            <a href="https://github.com/fredriksvantes/safemonitor/" className="text-sm text-muted-foreground hover:text-foreground">
              Contribute
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
