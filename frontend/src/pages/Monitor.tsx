import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Eye, PlusCircle, Settings, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Monitor {
  id: string;
  safe_address: string;
  alias?: string;
  network?: string;
  active: boolean;
  notify: boolean;
  notificationMethod?: string;
  notificationTarget?: string;
  lastChecked?: string;
  alertCount?: number;
  settings: any;
  created_at: string;
}

const Monitor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMonitors() {
      if (!user) {
        setMonitors([]);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('monitors')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching monitors:', error);
          toast({
            title: "Error Fetching Monitors",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        const formattedMonitors = data.map(monitor => ({
          id: monitor.id,
          safe_address: monitor.safe_address,
          active: monitor.settings?.active !== false, // Default to true if not specified
          notify: monitor.notify,
          settings: monitor.settings || {},
          created_at: monitor.created_at,
          alias: monitor.settings?.alias,
          network: monitor.settings?.network || 'Ethereum',
          notificationMethod: monitor.settings?.notificationMethod,
          notificationTarget: monitor.settings?.notificationTarget,
          lastChecked: new Date().toISOString(), // Placeholder for now
          alertCount: 0 // Placeholder for now
        }));

        setMonitors(formattedMonitors);
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMonitors();
  }, [user, toast]);

  const toggleMonitor = async (id: string) => {
    const monitor = monitors.find(m => m.id === id);
    if (!monitor) return;
    
    const newActiveState = !monitor.active;
    
    try {
      // Update locally first for immediate UI feedback
      setMonitors(monitors.map(m => 
        m.id === id ? { ...m, active: newActiveState } : m
      ));

      // Then update in the database
      const { error } = await supabase
        .from('monitors')
        .update({ 
          settings: {
            ...monitor.settings,
            active: newActiveState
          }
        })
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: newActiveState ? "Monitor Activated" : "Monitor Paused",
        description: newActiveState
          ? `Activated monitoring for ${monitor.alias || monitor.safe_address}` 
          : `Paused monitoring for ${monitor.alias || monitor.safe_address}`,
      });
    } catch (error: any) {
      console.error('Error toggling monitor:', error);
      
      // Revert the local state change on error
      setMonitors(monitors.map(m => 
        m.id === id ? { ...m, active: !newActiveState } : m
      ));
      
      toast({
        title: "Error Updating Monitor",
        description: error.message || "Failed to update monitor status",
        variant: "destructive",
      });
    }
  };

  const deleteMonitor = async (id: string) => {
    const monitor = monitors.find(m => m.id === id);
    if (!monitor) return;
    
    try {
      // Update UI first for responsiveness
      setMonitors(monitors.filter(m => m.id !== id));
      
      // Then delete from database
      const { error } = await supabase
        .from('monitors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Monitor Deleted",
        description: `Successfully removed monitoring for ${monitor.alias || monitor.safe_address}`,
      });
    } catch (error: any) {
      console.error('Error deleting monitor:', error);
      
      // Restore the monitor in the UI on error
      setMonitors(prev => [...prev, monitor]);
      
      toast({
        title: "Error Deleting Monitor",
        description: error.message || "Failed to delete monitor",
        variant: "destructive",
      });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const truncateAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
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
                You need to sign in to view your monitors
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please sign in to access your Safe monitoring dashboard.
              </p>
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Monitors</h1>
          
          <Button 
            onClick={() => navigate("/monitor/new")}
            className="jsr-button flex items-center gap-2"
          >
            <PlusCircle className="h-5 w-5" />
            Add Monitor
          </Button>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="opacity-70 animate-pulse">
                <CardHeader>
                  <div className="h-6 w-3/4 bg-muted rounded mb-2"></div>
                  <div className="h-4 w-1/2 bg-muted rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 w-full bg-muted rounded mb-2"></div>
                  <div className="h-4 w-2/3 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : monitors.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {monitors.map(monitor => (
                <Card key={monitor.id} className={monitor.active ? "" : "opacity-70"}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="truncate">{monitor.alias || truncateAddress(monitor.safe_address)}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/monitor/config/${monitor.id}`)}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Edit Settings</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleMonitor(monitor.id)}>
                            {monitor.active ? (
                              <>
                                <ToggleLeft className="mr-2 h-4 w-4" />
                                <span>Pause Monitor</span>
                              </>
                            ) : (
                              <>
                                <ToggleRight className="mr-2 h-4 w-4" />
                                <span>Activate Monitor</span>
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive" 
                            onClick={() => deleteMonitor(monitor.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${monitor.active ? "bg-jsr-green" : "bg-muted-foreground"}`}></span>
                      {monitor.network} • {monitor.active ? "Active" : "Paused"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="font-mono">{truncateAddress(monitor.safe_address)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Notifications:</span>
                        <span>{monitor.notify ? (monitor.notificationMethod || 'Enabled') : 'Disabled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last checked:</span>
                        <span>{monitor.lastChecked ? formatTimeAgo(monitor.lastChecked) : 'Never'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Alerts:</span>
                        <span className="flex items-center">
                          {(monitor.alertCount || 0) > 0 && (
                            <AlertCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
                          )}
                          {monitor.alertCount || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>
                  Last 7 days of monitoring alerts across all your Safe vaults
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Safe</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monitors.some(m => (m.alertCount || 0) > 0) ? (
                      <>
                        <TableRow>
                          <TableCell className="font-medium">
                            0x0987...4321
                          </TableCell>
                          <TableCell>Polygon</TableCell>
                          <TableCell>Suspicious transaction pattern</TableCell>
                          <TableCell>Yesterday, 15:42</TableCell>
                          <TableCell className="text-destructive">Active</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">
                            0x0987...4321
                          </TableCell>
                          <TableCell>Polygon</TableCell>
                          <TableCell>High-risk contract interaction</TableCell>
                          <TableCell>3 days ago</TableCell>
                          <TableCell className="text-destructive">Active</TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                          No alerts detected in the past 7 days
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-6 mb-6">
              <Eye className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No monitors set up yet</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Start monitoring your Safe multisignature vaults to receive alerts about suspicious transactions
            </p>
            <Button 
              onClick={() => navigate("/monitor/new")}
              className="jsr-button"
            >
              Set Up Your First Monitor
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Monitor;
