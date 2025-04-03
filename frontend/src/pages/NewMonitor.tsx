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
  { id: "suspicious", name: "Suspicious transactions only" },
  { id: "all", name: "All transactions" }
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
  
  const [address, setAddress] = useState("");
  const [alias, setAlias] = useState("");
  const [network, setNetwork] = useState("ethereum");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [alertType, setAlertType] = useState<string>("suspicious");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user, setIsLoginDialogOpen } = useAuth();

  // Initialize notification methods
  useEffect(() => {
    setNotifications(
      NOTIFICATION_METHODS.map(method => ({
        method: method.id,
        enabled: false
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
        network,
        active: true,
        alertType,
        notifications: processedNotifications
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
            <Input
              value={notification.webhookUrl || ""}
              onChange={(e) => updateNotificationField(notification.method, "webhookUrl", e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
            />
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
