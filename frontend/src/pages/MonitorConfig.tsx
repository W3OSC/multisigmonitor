import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  // For discord
  serverName?: string;
  channelName?: string;
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [alertType, setAlertType] = useState<string>("all");
  const [managementOnly, setManagementOnly] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewMonitor, setIsNewMonitor] = useState(false);

  // Check if this is a new monitor being set up or editing an existing one
  useEffect(() => {
    // Check if we're coming from the new monitor flow
    // This could be determined by a query parameter or referrer check
    const fromNewMonitor = searchParams.get('newSetup') === 'true';
    setIsNewMonitor(fromNewMonitor);
  }, [searchParams]);

  // Function to fetch monitor data
  async function fetchMonitor() {
    if (!user || !id) {
      setIsLoading(false);
      return;
    }
    
    try {
      // Fetch the monitor data from Supabase
      const { data, error } = await supabase
        .from('monitors')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error("Monitor not found");
      }
      
      // Set the basic monitor data
      setAddress(data.safe_address);
      setAlias(data.settings?.alias || "");
      setNetwork(data.settings?.network || "ethereum");
      setNotificationsEnabled(data.settings?.notify || false);
      setAlertType(data.settings?.alertType || "suspicious");
      setManagementOnly(data.settings?.managementOnly || false);
      
      // Create fresh notification configurations
      const updatedNotifications = NOTIFICATION_METHODS.map(method => ({
        method: method.id,
        enabled: false,
        email: '',
        telegramBotApiKey: '',
        telegramChatId: '',
        webhookUrl: '',
        serverName: '',
        channelName: ''
      }));
      
      // Handle different notification formats
      if (data.settings?.notifications && Array.isArray(data.settings.notifications)) {
        // Handle new multi-notification format
        data.settings.notifications.forEach(notification => {
          const notifConfig = updatedNotifications.find(n => n.method === notification.method);
          if (notifConfig) {
            notifConfig.enabled = true;
            
            // Set specific fields based on notification type
            switch (notification.method) {
              case "email":
                notifConfig.email = notification.email;
                break;
              case "telegram":
                notifConfig.telegramBotApiKey = notification.botApiKey;
                notifConfig.telegramChatId = notification.chatId;
                break;
              case "discord":
                notifConfig.webhookUrl = notification.webhookUrl;
                notifConfig.serverName = notification.serverName;
                notifConfig.channelName = notification.channelName;
                break;
              case "slack":
              case "webhook":
                notifConfig.webhookUrl = notification.webhookUrl;
                break;
            }
          }
        });
      } else if (data.settings?.notificationMethod) {
        // Handle legacy single notification format for backward compatibility
        const method = data.settings.notificationMethod;
        const target = data.settings.notificationTarget;
        
        const notifConfig = updatedNotifications.find(n => n.method === method);
        if (notifConfig) {
          notifConfig.enabled = true;
          
          switch (method) {
            case "email":
              notifConfig.email = target;
              break;
            case "telegram":
              // Can't reliably split legacy telegram target, use empty values
              notifConfig.telegramBotApiKey = "";
              notifConfig.telegramChatId = "";
              break;
            case "discord":
            case "slack":
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
      console.error('Error fetching monitor:', error);
      toast({
        title: "Monitor Not Found",
        description: "The requested monitor could not be found",
        variant: "destructive",
      });
      navigate("/monitor");
    }
  }

  // Function to open Discord OAuth popup
  const connectDiscord = () => {
    if (!id) return;
    
    // Open popup window for Discord OAuth
    const width = 600;
    const height = 800;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    // Use the Supabase URL directly
    const supabaseUrl = "https://jgqotbhokyuasepuhzxy.supabase.co";
    
    window.open(
      `${supabaseUrl}/functions/v1/discord-oauth-start?monitorId=${id}`,
      'discord-oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Listen for message from popup when complete
    window.addEventListener('message', (event) => {
      if (event.data === 'discord-webhook-success') {
        // Reload the current monitor data
        if (id && user) {
          fetchMonitor();
        }
        toast({
          title: "Discord Connected",
          description: "Discord webhook has been successfully connected",
        });
      }
    }, { once: true }); // Only listen once
  };

  const disconnectDiscord = async () => {
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
      // Find the Discord notification
      const discordNotification = notifications.find(n => n.method === "discord");
      const webhookUrl = discordNotification?.webhookUrl;
      
      if (webhookUrl) {
        // First, delete the webhook from Discord's servers
        try {
          const response = await fetch(webhookUrl, {
            method: 'DELETE',
          });
          
          if (!response.ok) {
            console.warn('Unable to delete webhook from Discord servers', response.status);
            // Continue with the process even if Discord API call fails
            // as we still want to remove it from our database
          }
        } catch (discordError) {
          console.warn('Error deleting Discord webhook:', discordError);
          // Continue with the process even if the API call fails
        }
      }
      
      // Update notifications in state - clear webhook URL and related fields
      const updatedNotifications = notifications.map(notification =>
        notification.method === "discord"
          ? { ...notification, webhookUrl: "", serverName: "", channelName: "" }
          : notification
      );
      
      setNotifications(updatedNotifications);
      
      // Process enabled notifications for storage
      const processedNotifications = updatedNotifications
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
              result.webhookUrl = notification.webhookUrl;
              result.serverName = notification.serverName;
              result.channelName = notification.channelName;
              break;
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
        network,
        active: true,
        alertType,
        notify: notificationsEnabled,
        managementOnly,
        notifications: processedNotifications
      };
      
      // Update the monitor in Supabase
      const { error } = await supabase
        .from('monitors')
        .update({
          safe_address: address,
          settings: settings
        })
        .eq('id', id);
    
      if (error) throw error;
      
      toast({
        title: "Discord Disconnected",
        description: "Discord webhook has been completely removed",
      });
    } catch (error: any) {
      console.error('Error disconnecting Discord webhook:', error);
      toast({
        title: "Error Disconnecting Discord",
        description: error.message || "There was a problem disconnecting Discord webhook",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Initialize notification methods once
    setNotifications(
      NOTIFICATION_METHODS.map(method => ({
        method: method.id,
        enabled: false,
        serverName: '',
        channelName: ''
      }))
    );
    
    // Fetch monitor data if ID is available
    if (!id) {
      navigate("/monitor");
      return;
    }
    
    fetchMonitor();
  }, [id, navigate, toast, user]);
  
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
    // Address and network are always required
    const baseValid = address.match(/^0x[a-fA-F0-9]{40}$/) && network;
    
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
              result.webhookUrl = notification.webhookUrl;
              result.serverName = notification.serverName;
              result.channelName = notification.channelName;
              break;
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
        network,
        active: true,
        alertType,
        notify: notificationsEnabled,
        managementOnly,
        notifications: processedNotifications
      };
        
        // Update the monitor in Supabase
        const { error } = await supabase
          .from('monitors')
          .update({
            safe_address: address,
            settings: settings
          })
          .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Monitor Updated",
        description: "Your monitor settings have been updated successfully",
      });
      
      navigate("/monitor");
    } catch (error: any) {
      console.error('Error updating monitor:', error);
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm">
                    {/* {notification.serverName || 'Unknown Server'} */}
                    {notification.channelName || 'Unknown Channel'}
                  </div>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={disconnectDiscord}
                  >
                    Disconnect
                  </Button>
                </div>
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
                    <AddressInput
                      value={address}
                      onChange={setAddress}
                      label="Multisignature Address"
                      placeholder="0x..."
                    />
                    
                    <div className="space-y-2">
                      <Label htmlFor="alias">Alias (Optional)</Label>
                      <Input
                        id="alias"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        placeholder="Our Treasury Multisignature Wallet"
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
