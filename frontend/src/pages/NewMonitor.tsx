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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";
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

// Alert type options
const ALERT_TYPES = [
  { id: "all", name: "All transactions" },
  { id: "management", name: "Management and Suspicious transactions only" },
  { id: "suspicious", name: "Suspicious transactions only" }
];

// Type for notification config
interface NotificationConfig {
  method: string;
  enabled: boolean;
  // For email
  email?: string;
  // For telegram
  telegramBotApiKey?: string;
  telegramChatId?: string;
  // For discord, slack, webhook
  webhookUrl?: string;
}

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [alertType, setAlertType] = useState<string>("all");
  const [managementOnly, setManagementOnly] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user, setIsLoginDialogOpen } = useAuth();

  // Function to open Discord OAuth popup
  const connectDiscord = () => {
    // Open popup window for Discord OAuth
    const width = 600;
    const height = 800;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    // Use the Supabase URL directly
    const supabaseUrl = "https://jgqotbhokyuasepuhzxy.supabase.co";
    
    window.open(
      `${supabaseUrl}/functions/v1/discord-oauth-start`,
      'discord-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Listen for message from popup when complete
    window.addEventListener('message', (event) => {
      if (event.data === 'discord-webhook-success') {
        // Get webhook data from localStorage and update the form
        const webhookData = JSON.parse(localStorage.getItem('discord-webhook') || '{}');
        if (webhookData && webhookData.url) {
          // Find Discord notification and update its URL
          setNotifications(prevNotifications => 
            prevNotifications.map(notification => 
              notification.method === 'discord' 
                ? { ...notification, webhookUrl: webhookData.url, enabled: true } 
                : notification
            )
          );
          
          // Make sure notifications are enabled
          if (!notificationsEnabled) {
            setNotificationsEnabled(true);
          }
          
          // Clean up
          localStorage.removeItem('discord-webhook');
        }
        toast({
          title: "Discord Connected",
          description: "Discord webhook has been successfully connected",
        });
      }
    }, { once: true }); // Only listen once
  };

  // Initialize notification methods
  useEffect(() => {
    setNotifications(
      NOTIFICATION_METHODS.map(method => ({
        method: method.id,
        enabled: false,
        email: '',
        telegramBotApiKey: '',
        telegramChatId: '',
        webhookUrl: ''
      }))
    );
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const addressParam = searchParams.get("address");
    if (addressParam) {
      setAddress(addressParam);
    }
  }, [location.search]);
  
  // Check for discord=success in URL params and show toast on initial load
  useEffect(() => {
    if (searchParams.get('discord') === 'success') {
      toast({
        title: "Discord Connected",
        description: "Discord webhook has been successfully connected",
      });
      
      // Clear the parameter from URL to prevent showing the toast on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('discord');
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, toast, navigate]);

  const handleLogin = () => {
    setIsLoginDialogOpen(true);
  };

  const toggleNotificationMethod = (methodId: string, enabled: boolean) => {
    setNotifications(prevState => 
      prevState.map(notification => 
        notification.method === methodId 
          ? { ...notification, enabled } 
          : notification
      )
    );
  };

  const updateNotificationField = (methodId: string, field: string, value: string) => {
    setNotifications(prevState => 
      prevState.map(notification => 
        notification.method === methodId 
          ? { ...notification, [field]: value } 
          : notification
      )
    );
  };

  const isFormValid = () => {
    // Address must be a valid ETH address and confirmed as a Safe
    const baseValid = address.match(/^0x[a-fA-F0-9]{40}$/) && network && isValidSafe === true;
    
    // If notifications are enabled, check that at least one method is enabled and its required fields are filled
    if (notificationsEnabled) {
      const enabledNotifications = notifications.filter(n => n.enabled);
      if (enabledNotifications.length === 0) {
        return false;
      }
      
      // Check each enabled notification method has required fields
      const allValid = enabledNotifications.every(notification => {
        switch (notification.method) {
          case "email":
            return user?.email || (notification.email && notification.email.includes('@'));
          case "telegram":
            return notification.telegramBotApiKey && notification.telegramChatId;
          case "discord":
          case "slack":
          case "webhook":
            return notification.webhookUrl && notification.webhookUrl.startsWith('http');
          default:
            return false;
        }
      });
      
      return baseValid && allValid;
    }
    
    // If notifications are disabled, just check base requirements
    return baseValid;
  };

  // Check if an address is a valid Safe on the specified network
  const checkIsSafe = async (address: string, network: string) => {
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setIsValidSafe(null);
      return;
    }
    
    setIsCheckingSafe(true);
    setIsValidSafe(null);
    
    try {
      // Network-specific API URLs for Safe Transaction Service
      const txServiceUrl = (() => {
        switch(network.toLowerCase()) {
          case 'ethereum': return 'https://safe-transaction-mainnet.safe.global';
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
        console.error('Error checking Safe:', error);
        setIsValidSafe(null);
      }
    } finally {
      setIsCheckingSafe(false);
    }
  };
  
  // Validate the Safe when address or network changes, with debounce
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
        description: "Please fill out all required fields for enabled notification methods",
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
      // Process enabled notifications for storage
      const processedNotifications = notifications
        .filter(n => n.enabled)
        .map(notification => {
          const result: Record<string, any> = { method: notification.method };
          
          switch (notification.method) {
            case "email":
              result.email = user?.email || notification.email;
              break;
            case "telegram":
              result.botApiKey = notification.telegramBotApiKey;
              result.chatId = notification.telegramChatId;
              break;
            case "discord":
            case "slack":
            case "webhook":
              result.webhookUrl = notification.webhookUrl;
              break;
          }
          
          return result;
        });
          
      // Create settings object with all configuration
      const settings = {
        alias: alias || null,
        active: true,
        alertType,
        notify: notificationsEnabled,
        managementOnly,
        notifications: processedNotifications
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

  const renderNotificationFields = (notification: NotificationConfig) => {
    switch (notification.method) {
      case "email":
        return (
          <div className="pl-6 pt-2 space-y-2">
            {user?.email ? (
              <div className="flex items-center gap-2">
                <Input
                  value={user.email}
                  readOnly
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">Your account email</p>
              </div>
            ) : (
              <Input
                value={notification.email || ""}
                onChange={(e) => updateNotificationField(notification.method, "email", e.target.value)}
                placeholder="your@email.com"
              />
            )}
          </div>
        );

      case "telegram":
        return (
          <div className="pl-6 pt-2 space-y-2">
            <div className="space-y-2">
              <Label htmlFor="telegram-bot-api">Bot API Key</Label>
              <Input
                id="telegram-bot-api"
                value={notification.telegramBotApiKey || ""}
                onChange={(e) => updateNotificationField(notification.method, "telegramBotApiKey", e.target.value)}
                placeholder="123456789:ABCDefGhIJklmNoPQRstUvwxYZ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-chat-id">Chat ID</Label>
              <Input
                id="telegram-chat-id"
                value={notification.telegramChatId || ""}
                onChange={(e) => updateNotificationField(notification.method, "telegramChatId", e.target.value)}
                placeholder="123456789"
              />
            </div>
          </div>
        );

      case "discord":
        return (
          <div className="pl-6 pt-2 space-y-2">
            {notification.webhookUrl ? (
              <div className="flex items-center gap-2">
                <Input
                  value={notification.webhookUrl}
                  readOnly
                  className="bg-muted"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={connectDiscord}
                >
                  Reconnect
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                onClick={connectDiscord}
                className="w-full"
              >
                Connect Discord Channel
              </Button>
            )}
          </div>
        );

      case "slack":
        return (
          <div className="pl-6 pt-2 space-y-2">
            <Input
              value={notification.webhookUrl || ""}
              onChange={(e) => updateNotificationField(notification.method, "webhookUrl", e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
        );

      case "webhook":
        return (
          <div className="pl-6 pt-2 space-y-2">
            <Input
              value={notification.webhookUrl || ""}
              onChange={(e) => updateNotificationField(notification.method, "webhookUrl", e.target.value)}
              placeholder="https://your-webhook-url.com"
            />
          </div>
        );

      default:
        return null;
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
                <div className="space-y-2">
                  <AddressInput
                    value={address}
                    onChange={setAddress}
                    label="Safe Address"
                    placeholder="0x..."
                  />
                  
                  {address && address.match(/^0x[a-fA-F0-9]{40}$/) && (
                    <div className="mt-2">
                      {isCheckingSafe ? (
                        <div className="flex items-center text-muted-foreground text-sm">
                          <Loader2 className="animate-spin h-3 w-3 mr-1" />
                          Checking if this is a valid Safe...
                        </div>
                      ) : isValidSafe === true ? (
                        <Alert className="py-2 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                          <AlertDescription className="text-green-600 dark:text-green-400 text-sm flex items-center">
                            ✓ Valid Safe address confirmed on {SUPPORTED_NETWORKS.find(n => n.id === network)?.name}
                          </AlertDescription>
                        </Alert>
                      ) : isValidSafe === false ? (
                        <Alert className="py-2 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
                          <AlertDescription className="text-red-600 dark:text-red-400 text-sm flex items-center">
                            ✗ This address is not a Safe on {SUPPORTED_NETWORKS.find(n => n.id === network)?.name}
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
                    placeholder="My Treasury Safe"
                  />
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
                        Receive alerts when activity is detected
                      </p>
                    </div>
                    <Switch
                      id="notifications"
                      checked={notificationsEnabled}
                      onCheckedChange={setNotificationsEnabled}
                    />
                  </div>
                  
                  {notificationsEnabled && (
                    <div className="space-y-4 pt-3 border-t mt-3">
                      <Label className="text-base">Alert Type</Label>
                      <RadioGroup 
                        value={alertType} 
                        onValueChange={setAlertType}
                        className="space-y-2"
                      >
                        {ALERT_TYPES.map((type) => (
                          <div key={type.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={type.id} id={`alert-type-${type.id}`} />
                            <Label htmlFor={`alert-type-${type.id}`}>{type.name}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}
                  
                  {notificationsEnabled && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-base">Notification Methods</Label>
                        <p className="text-sm text-muted-foreground">
                          Select one or more notification methods to receive alerts
                        </p>
                        
                        <div className="space-y-4 pt-2">
                          {notifications.map((notification) => (
                            <div key={notification.method} className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`notification-${notification.method}`}
                                  checked={notification.enabled}
                                  onCheckedChange={(checked) => 
                                    toggleNotificationMethod(notification.method, checked as boolean)
                                  }
                                />
                                <Label 
                                  htmlFor={`notification-${notification.method}`}
                                  className="font-medium"
                                >
                                  {NOTIFICATION_METHODS.find(m => m.id === notification.method)?.name}
                                </Label>
                              </div>
                              
                              {notification.enabled && renderNotificationFields(notification)}
                            </div>
                          ))}
                        </div>
                      </div>
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
