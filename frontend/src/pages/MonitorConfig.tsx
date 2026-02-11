import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
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
import { ChevronLeft, ChevronRight, Home, Loader2 } from "lucide-react";
import { monitorsApi } from "@/lib/api";

// Use the same constants as NewMonitor.tsx
const SUPPORTED_NETWORKS = [
  { id: "ethereum", name: "Ethereum" },
  { id: "sepolia", name: "Sepolia" },
  { id: "polygon", name: "Polygon" },
  { id: "arbitrum", name: "Arbitrum" },
  { id: "optimism", name: "Optimism" },
  { id: "base", name: "Base" },
  { id: "gnosis", name: "Gnosis Chain" },
];

const NOTIFICATION_METHODS = [
  { id: "telegram", name: "Telegram" },
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
  telegramChatId?: string;
  webhookUrl?: string;
}

const MonitorConfig = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [address, setAddress] = useState("");
  const [alias, setAlias] = useState("");
  const [network, setNetwork] = useState("");
  const [isValidSafe, setIsValidSafe] = useState<boolean | null>(null);
  const [isCheckingSafe, setIsCheckingSafe] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [alertType, setAlertType] = useState<string>("all");
  const [managementOnly, setManagementOnly] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewMonitor, setIsNewMonitor] = useState(false);
  const [monitorActive, setMonitorActive] = useState(true);

  // Check if this is a new monitor being set up or editing an existing one
  useEffect(() => {
    // Check if we're coming from the new monitor flow
    // This could be determined by a query parameter or referrer check
    const fromNewMonitor = searchParams.get('newSetup') === 'true';
    setIsNewMonitor(fromNewMonitor);
  }, [searchParams]);

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
          case 'ethereum': return 'https://api.safe.global/tx-service/eth';
          case 'sepolia': return 'https://api.safe.global/tx-service/sep';
          case 'polygon': return 'https://api.safe.global/tx-service/pol';
          case 'arbitrum': return 'https://api.safe.global/tx-service/arb1';
          case 'optimism': return 'https://api.safe.global/tx-service/oeth';
          case 'base': return 'https://api.safe.global/tx-service/base';
          case 'gnosis': return 'https://api.safe.global/tx-service/gno';
          case 'goerli': return null;
          default: return 'https://api.safe.global/tx-service/eth';
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
        setIsValidSafe(null);
      }
    } finally {
      setIsCheckingSafe(false);
    }
  };

  // Validate the multisignature wallet when address or network changes, with debounce
  useEffect(() => {
    // Only validate when editing existing monitors (not for new monitor setup)
    if (isNewMonitor) return;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setIsValidSafe(null);
      return;
    }
    
    const timer = setTimeout(() => {
      checkIsSafe(address, network);
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timer);
  }, [address, network, isNewMonitor]);

  // Function to fetch monitor data
  async function fetchMonitor() {
    if (!user || !id) {
      setIsLoading(false);
      return;
    }
    
    try {
      // Fetch the monitor data from Rust API
      const data = await monitorsApi.get(id);
      
      if (!data) {
        throw new Error("Monitor not found");
      }
      
      // Parse settings JSON string
      const settings = typeof data.settings === 'string' 
        ? JSON.parse(data.settings) 
        : data.settings;
      
      // Set the basic monitor data
      setAddress(data.safeAddress);
      setAlias(settings?.alias || "");
      setNetwork(data.network || "ethereum");
      setMonitorActive(settings?.active !== false);
      // Enable notifications if there are notification channels configured
      const hasNotificationChannels = settings?.notificationChannels && settings.notificationChannels.length > 0;
      setNotificationsEnabled(settings?.notify || hasNotificationChannels || false);
      setAlertType(settings?.alertType || "suspicious");
      setManagementOnly(settings?.managementOnly || false);
      
      // Create fresh notification configurations
      const updatedNotifications = NOTIFICATION_METHODS.map(method => ({
        method: method.id,
        enabled: false,
        email: '',
        telegramChatId: '',
        webhookUrl: '',
        serverName: '',
        channelName: ''
      }));
      
      // Handle camelCase format (notificationChannels)
      if (settings?.notificationChannels && Array.isArray(settings.notificationChannels)) {
        settings.notificationChannels.forEach((channel: any) => {
          if (channel.type === "telegram") {
            const notifConfig = updatedNotifications.find(n => n.method === "telegram");
            if (notifConfig) {
              notifConfig.enabled = true;
              notifConfig.telegramChatId = channel.chat_id || '';
            }
          } else if (channel.type === "webhook") {
            const webhookType = channel.webhook_type;
            let method = "webhook";
            if (webhookType === "discord") method = "discord";
            else if (webhookType === "slack") method = "slack";
            
            const notifConfig = updatedNotifications.find(n => n.method === method);
            if (notifConfig) {
              notifConfig.enabled = true;
              notifConfig.webhookUrl = channel.url || '';
            }
          }
        });
      }
      // Handle snake_case format (notification_channels) for backwards compatibility
      else if (settings?.notification_channels && Array.isArray(settings.notification_channels)) {
        settings.notification_channels.forEach((channel: any) => {
          if (channel.type === "telegram") {
            const notifConfig = updatedNotifications.find(n => n.method === "telegram");
            if (notifConfig) {
              notifConfig.enabled = true;
              notifConfig.telegramChatId = channel.chat_id || '';
            }
          } else if (channel.type === "webhook") {
            const webhookType = channel.webhook_type;
            let method = "webhook";
            if (webhookType === "discord") method = "discord";
            else if (webhookType === "slack") method = "slack";
            
            const notifConfig = updatedNotifications.find(n => n.method === method);
            if (notifConfig) {
              notifConfig.enabled = true;
              notifConfig.webhookUrl = channel.url || '';
            }
          }
        });
      }
      // Handle old frontend format (notifications) for backward compatibility
      else if (settings?.notifications && Array.isArray(settings.notifications)) {
        settings.notifications.forEach(notification => {
          const notifConfig = updatedNotifications.find(n => n.method === notification.method);
          if (notifConfig) {
            notifConfig.enabled = true;
            
            // Set specific fields based on notification type
            switch (notification.method) {
              case "telegram":
                notifConfig.telegramChatId = notification.chatId;
                break;
              case "webhook":
                notifConfig.webhookUrl = notification.webhookUrl;
                break;
            }
          }
        });
      } else if (settings?.notificationMethod) {
        // Handle legacy single notification format for backward compatibility
        const method = settings.notificationMethod;
        const target = settings.notificationTarget;
        
        const notifConfig = updatedNotifications.find(n => n.method === method);
        if (notifConfig) {
          notifConfig.enabled = true;
          
          switch (method) {
            case "telegram":
              notifConfig.telegramChatId = target || "";
              break;
            case "webhook":
              notifConfig.webhookUrl = target;
              break;
          }
        }
      }
      
      // Set notifications and finish loading
      setNotifications(updatedNotifications);
      setIsLoading(false);
    } catch (error) {
      toast({
        title: "Monitor Not Found",
        description: "The requested monitor could not be found",
        variant: "destructive",
      });
      navigate("/monitor");
    }
  }

  // Function to open Discord OAuth popup
  useEffect(() => {
    // Fetch monitor data if ID is available
    if (!id) {
      navigate("/monitor");
      return;
    }
    
    fetchMonitor();
  }, [id, navigate, toast, user]);
  
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
    // Address must be a valid ETH address and confirmed as a supported multisignature wallet (when editing existing monitors)
    const addressValid = address && address.match(/^0x[a-fA-F0-9]{40}$/);
    const safeValid = isNewMonitor || isValidSafe === true; // Skip Safe validation for new monitors
    const baseValid = addressValid && network && safeValid;
    
    // If notifications are enabled, check that at least one method is enabled and its required fields are filled
    if (notificationsEnabled) {
      const enabledNotifications = notifications.filter(n => n.enabled);
      if (enabledNotifications.length === 0) {
        return false;
      }
      
      // Check each enabled notification method has required fields
      const allValid = enabledNotifications.every(notification => {
        switch (notification.method) {
          case "telegram":
            return notification.telegramChatId && notification.telegramChatId.length > 0;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      // Provide more specific error message based on what's invalid
      let errorMessage = "Please fill out all required fields";
      
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        errorMessage = "Please provide a valid Ethereum address";
      } else if (!isNewMonitor && isValidSafe === false) {
        errorMessage = "The address must be a supported multisignature wallet on the selected network";
      } else if (notificationsEnabled) {
        errorMessage = "Please fill out all required fields for enabled notification methods";
      }
      
      toast({
        title: "Invalid Form",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }
    
    if (!id || !user) {
      toast({
        title: "Error",
        description: "Missing required information to update monitor",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Process enabled notifications for backend (snake_case format)
      const notificationChannels = notifications
        .filter(n => n.enabled)
        .map(notification => {
          switch (notification.method) {
            case "telegram":
              return {
                type: "telegram",
                chat_id: notification.telegramChatId
              };
            case "webhook":
              return {
                type: "webhook",
                url: notification.webhookUrl,
                webhook_type: "generic"
              };
            default:
              return null;
          }
        })
        .filter(n => n !== null);
      
      // Convert alertType to backend format
      const notifyAll = alertType === "all";
      const notifyManagement = alertType === "all" || alertType === "management";
      
      // Create settings object matching backend MonitorSettings structure
      const settings = {
        active: monitorActive,
        notifyAll,
        notifyManagement,
        notificationChannels: notificationChannels.length > 0 ? notificationChannels : null
      };
        
        // Update the monitor via Rust API
        await monitorsApi.update(id, {
          settings
        });
      
      toast({
        title: "Monitor Updated",
        description: "Your monitor settings have been updated successfully",
      });
      
      navigate("/monitor");
    } catch (error: any) {
      toast({
        title: "Error Updating Monitor",
        description: error.message || "There was a problem updating your monitor",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderNotificationFields = (notification: NotificationConfig) => {
    switch (notification.method) {
      case "telegram":
        return (
          <div className="pl-6 pt-2 space-y-2">
            <div className="space-y-2">
              <Label htmlFor="telegram-chat-id">Chat ID</Label>
              <Input
                id="telegram-chat-id"
                value={notification.telegramChatId || ""}
                onChange={(e) => updateNotificationField(notification.method, "telegramChatId", e.target.value)}
                placeholder="123456789"
              />
              <p className="text-xs text-muted-foreground">
                Get your Chat ID from @userinfobot on Telegram
              </p>
            </div>
          </div>
        );

      case "webhook":
        return (
          <div className="pl-6 pt-2 space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={notification.webhookUrl || ""}
              onChange={(e) => updateNotificationField(notification.method, "webhookUrl", e.target.value)}
              placeholder="https://your-webhook-url.com"
            />
            <p className="text-xs text-muted-foreground">
              Supports Discord, Slack, or any custom webhook endpoint
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
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
      <main className="flex-1 container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Home className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
            <ChevronRight className="h-4 w-4" />
            <Button variant="ghost" size="sm" onClick={() => navigate("/monitor")}>
              Monitored Wallets
            </Button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{isNewMonitor ? "Configure" : "Edit"}</span>
          </div>

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
              <CardTitle>
                {isNewMonitor ? "Configure Monitor Notifications" : "Edit Monitor Settings"}
              </CardTitle>
              <CardDescription>
                {isNewMonitor 
                  ? "Set up notification preferences for your multisignature monitor" 
                  : "Update configuration for this multisignature monitoring"}
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                {/* Only show basic monitor info when editing an existing monitor */}
                {!isNewMonitor && (
                  <>
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
                    
                    <div className="space-y-2">
                      <Label htmlFor="alias">Alias (Optional)</Label>
                      <Input
                        id="alias"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        placeholder="Our Treasury Multisignature Wallet"
                      />
                    </div>
                  </>
                )}
                
                <div className={`space-y-4 ${!isNewMonitor ? "pt-4 border-t" : ""}`}>
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
                      Saving...
                    </>
                  ) : (
                    isNewMonitor ? "Complete Setup" : "Save Changes"
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
