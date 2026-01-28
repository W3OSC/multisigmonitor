import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { AlertCircle, Shield, Eye, Github } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      const storedRedirectUrl = sessionStorage.getItem('redirectAfterLogin');
      const justLoggedIn = sessionStorage.getItem('justLoggedIn');
      
      if (storedRedirectUrl) {
        sessionStorage.removeItem('redirectAfterLogin');
        const url = new URL(storedRedirectUrl);
        navigate(url.pathname + url.search);
      } else if (justLoggedIn) {
        sessionStorage.removeItem('justLoggedIn');
        navigate("/dashboard");
      }
    }
  }, [user, navigate]);

  const handleGetStarted = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container max-w-6xl">
        <div className="py-12 md:py-20">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-jsr-lime/20 blur-xl"></div>
              <Shield className="relative h-16 w-16 text-jsr-lime" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="jsr-text-gradient">multisig</span>monitor
            </h1>
            
            <p className="max-w-[42rem] text-lg text-muted-foreground mb-8">
              Monitor and review your multisignature wallets. Get notified about suspicious transactions and keep your assets secure.
            </p>
            
            <div className="flex gap-4 justify-center mb-12">
              <Button 
                onClick={handleGetStarted}
                className="jsr-button group flex items-center gap-2"
              >
                <Shield className="h-5 w-5 group-hover:animate-pulse" />
                Get Started
              </Button>
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
          <a 
            href="https://github.com/W3OSC/multisigmonitor" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
          >
            <Github className="h-4 w-4" />
            Contribute
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
