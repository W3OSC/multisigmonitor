
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
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
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 jsr-bg-gradient z-0 opacity-90"></div>
      <div className="absolute inset-0 jsr-wave-pattern z-0 opacity-20"></div>
      <div className="absolute top-20 -left-20 w-64 h-64 rounded-full bg-jsr-lime/20 blur-3xl"></div>
      <div className="absolute bottom-20 -right-20 w-80 h-80 rounded-full bg-jsr-purple/30 blur-3xl"></div>
      
      <Header />
      
      <main className="flex-1 container max-w-6xl relative z-10">
        <div className="py-12 md:py-20">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8 animate-float">
              <div className="absolute inset-0 rounded-full bg-jsr-lime/30 blur-xl"></div>
              <Shield className="relative h-16 w-16 text-jsr-lime" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="jsr-text-gradient">Safe</span>Watch
            </h1>
            
            <p className="max-w-[42rem] text-lg text-white dark:text-white/80 mb-8">
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
                  className="jsr-button group flex items-center gap-2 relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-jsr-lime opacity-20 group-hover:opacity-30 transition-opacity"></span>
                  <AlertCircle className="h-5 w-5 group-hover:animate-pulse" />
                  Review
                </Button>
                
                <Button 
                  onClick={handleMonitor}
                  className="jsr-button-alt group flex items-center gap-2 relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-jsr-orange to-jsr-pink opacity-20 group-hover:opacity-30 transition-opacity"></span>
                  <Eye className="h-5 w-5 group-hover:animate-pulse" />
                  Monitor
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="jsr-card p-6 backdrop-blur-md bg-white/5 dark:bg-black/20 border border-white/10">
              <div className="mb-4 bg-jsr-purple/30 rounded-full w-12 h-12 flex items-center justify-center">
                <Shield className="h-6 w-6 text-jsr-purple" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white dark:text-white">Verify Transactions</h3>
              <p className="text-white/70 dark:text-white/60">
                Review pending transactions for suspicious activity before they are executed
              </p>
            </div>
            
            <div className="jsr-card p-6 backdrop-blur-md bg-white/5 dark:bg-black/20 border border-white/10">
              <div className="mb-4 bg-jsr-orange/30 rounded-full w-12 h-12 flex items-center justify-center">
                <Eye className="h-6 w-6 text-jsr-orange" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white dark:text-white">24/7 Monitoring</h3>
              <p className="text-white/70 dark:text-white/60">
                Continuous monitoring of your multisignature wallets for any suspicious activity
              </p>
            </div>
            
            <div className="jsr-card p-6 backdrop-blur-md bg-white/5 dark:bg-black/20 border border-white/10">
              <div className="mb-4 bg-jsr-lime/30 rounded-full w-12 h-12 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-jsr-lime" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white dark:text-white">Instant Alerts</h3>
              <p className="text-white/70 dark:text-white/60">
                Get notified immediately through your preferred channels when something looks suspicious
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="border-t border-white/10 py-6 md:py-0 relative z-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 md:h-16">
          <p className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} SafeWatch. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-sm text-white/60 hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="text-sm text-white/60 hover:text-white transition-colors">
              Terms
            </a>
            <a href="#" className="text-sm text-white/60 hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
