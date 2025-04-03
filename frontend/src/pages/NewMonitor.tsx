import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressInput } from "@/components/AddressInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// This would be fetched from your API in a real app
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

const NewMonitor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [address, setAddress] = useState("");
  const [alias, setAlias] = useState("");
  const [network, setNetwork] = useState("ethereum");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationMethod, setNotificationMethod] = useState("");
  const [notificationTarget, setNotificationTarget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, setIsLoginDialogOpen } = useAuth();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const addressParam = searchParams.get("address");
    if (addressParam) {
      setAddress(addressParam);
    }
  }, [location.search]);

  const handleLogin = () => {
    setIsLoginDialogOpen(true);
  };

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
    // Address and network are always required
    const baseValid = address.match(/^0x[a-fA-F0-9]{40}$/) && network;
    
    // If notifications are enabled, then method and target are required
    if (notificationsEnabled) {
      return baseValid && notificationMethod && notificationTarget;
    }
    
    // If notifications are disabled, just check base requirements
    return baseValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast({
        title: "Invalid Form",
        description: "Please fill out all required fields",
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
      // Create settings object with all configuration
      const settings = {
        alias: alias || null,
        network,
        active: true,
        notificationMethod: notificationsEnabled ? notificationMethod : null,
        notificationTarget: notificationsEnabled ? notificationTarget : null
      };

      // Insert into Supabase
      const { data, error } = await supabase
        .from('monitors')
        .insert({
          user_id: user.id,
          safe_address: address,
          notify: notificationsEnabled,
          settings
        })
        .select();

      if (error) throw error;

      toast({
        title: "Monitor Created",
        description: "Your Safe is now being monitored for suspicious activity",
      });
      
      navigate("/monitor");
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
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                You need to sign in to set up monitoring for your Safe
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Monitoring requires an account to store your preferences and send notifications.
                Your data is kept secure and private.
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
                Configure monitoring for a Safe multisignature vault
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
                
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notifications" className="text-base">
                        Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive alerts when suspicious activity is detected
                      </p>
                    </div>
                    <Switch
                      id="notifications"
                      checked={notificationsEnabled}
                      onCheckedChange={setNotificationsEnabled}
                    />
                  </div>
                  
                  {notificationsEnabled && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="notification-method">Notification Method</Label>
                        <Select
                          value={notificationMethod}
                          onValueChange={setNotificationMethod}
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
                    </div>
                  )}
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
                    "Create Monitor"
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
