
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressInput } from "@/components/AddressInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2 } from "lucide-react";

// Use the same constants as NewMonitor.tsx
const SUPPORTED_NETWORKS = [
  { id: "ethereum", name: "Ethereum" },
  { id: "polygon", name: "Polygon" },
  { id: "arbitrum", name: "Arbitrum" },
  { id: "optimism", name: "Optimism" },
  { id: "base", name: "Base" },
  { id: "gnosis", name: "Gnosis Chain" },
];

const NOTIFICATION_METHODS = [
  { id: "email", name: "Email" },
  { id: "telegram", name: "Telegram" },
  { id: "discord", name: "Discord" },
  { id: "slack", name: "Slack" },
  { id: "webhook", name: "Webhook" },
];

const MonitorConfig = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [address, setAddress] = useState("");
  const [alias, setAlias] = useState("");
  const [network, setNetwork] = useState("");
  const [notificationMethod, setNotificationMethod] = useState("");
  const [notificationTarget, setNotificationTarget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate("/monitor");
      return;
    }
    
    // In a real app, you would fetch the monitor details from your API
    setTimeout(() => {
      // Mock data for demonstration
      if (id === "m1") {
        setAddress("0x1234567890123456789012345678901234567890");
        setAlias("Main Treasury");
        setNetwork("ethereum");
        setNotificationMethod("email");
        setNotificationTarget("admin@example.com");
      } else if (id === "m2") {
        setAddress("0x0987654321098765432109876543210987654321");
        setAlias("");
        setNetwork("polygon");
        setNotificationMethod("discord");
        setNotificationTarget("webhooks/...");
      } else {
        toast({
          title: "Monitor Not Found",
          description: "The requested monitor could not be found",
          variant: "destructive",
        });
        navigate("/monitor");
      }
      
      setIsLoading(false);
    }, 1000);
  }, [id, navigate, toast]);

  const getTargetPlaceholder = () => {
    switch (notificationMethod) {
      case "email":
        return "your@email.com";
      case "telegram":
        return "@username or chat ID";
      case "discord":
        return "Webhook URL";
      case "slack":
        return "Webhook URL";
      case "webhook":
        return "https://your-webhook-url.com";
      default:
        return "Notification destination";
    }
  };

  const isFormValid = () => {
    return (
      address.match(/^0x[a-fA-F0-9]{40}$/) &&
      network &&
      notificationMethod &&
      notificationTarget
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast({
        title: "Invalid Form",
        description: "Please fill out all required fields",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // In a real app, this would update the monitor in your database
    setTimeout(() => {
      toast({
        title: "Monitor Updated",
        description: "Your monitor settings have been updated successfully",
      });
      
      setIsSubmitting(false);
      navigate("/monitor");
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <HeaderWithLoginDialog />
        
        <main className="flex-1 container py-12 flex flex-col items-center justify-center">
          <div className="animate-spin">
            <Loader2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-muted-foreground">Loading monitor settings...</p>
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
              <CardTitle>Edit Monitor Settings</CardTitle>
              <CardDescription>
                Update configuration for this Safe monitoring
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <AddressInput
                  value={address}
                  onChange={setAddress}
                  label="Safe Address"
                  placeholder="0x..."
                />
                
                <div className="space-y-2">
                  <Label htmlFor="alias">Alias (Optional)</Label>
                  <Input
                    id="alias"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="My Treasury Safe"
                  />
                  <p className="text-sm text-muted-foreground">
                    A friendly name to identify this Safe
                  </p>
                </div>
                
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
                  <Label htmlFor="notification-method">Notification Method</Label>
                  <Select
                    value={notificationMethod}
                    onValueChange={(value) => {
                      setNotificationMethod(value);
                      setNotificationTarget("");
                    }}
                  >
                    <SelectTrigger id="notification-method">
                      <SelectValue placeholder="How should we notify you?" />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFICATION_METHODS.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {notificationMethod && (
                  <div className="space-y-2">
                    <Label htmlFor="notification-target">
                      {notificationMethod === "email" ? "Email Address" :
                       notificationMethod === "telegram" ? "Telegram Username" :
                       notificationMethod === "discord" ? "Discord Webhook" :
                       notificationMethod === "slack" ? "Slack Webhook" :
                       "Webhook URL"}
                    </Label>
                    <Input
                      id="notification-target"
                      value={notificationTarget}
                      onChange={(e) => setNotificationTarget(e.target.value)}
                      placeholder={getTargetPlaceholder()}
                    />
                  </div>
                )}
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
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
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

export default MonitorConfig;
