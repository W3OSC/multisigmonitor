import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Eye, 
  PlusCircle, 
  Settings, 
  ToggleLeft, 
  ToggleRight, 
  Trash2,
  FileDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  network: string;
  alias?: string;
  active: boolean;
  notify: boolean;
  notificationMethod?: string;
  notificationTarget?: string;
  lastChecked?: string;
  alertCount?: number;
  settings: any;
  created_at: string;
}

// Interface for Alert data
interface Alert {
  id: string;
  safe_address: string;
  network: string;
  transaction_hash: string;
  description: string;
  scanned_at: string;
  type: 'normal' | 'suspicious';
  result: any;
}

interface AlertFilter {
  safe: string | null;
  type: string | null;
}

const Monitor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Alert pagination and filtering state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [alertsPage, setAlertsPage] = useState(1);
  const [alertsPerPage, setAlertsPerPage] = useState(10);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [alertsFilter, setAlertsFilter] = useState<AlertFilter>({
    safe: null,
    type: null
  });
  
  // Calculate total pages based on total alerts and items per page
  const totalPages = Math.max(1, Math.ceil(totalAlerts / alertsPerPage));

  // Fetch monitors on load
  useEffect(() => {
    async function fetchMonitors() {
      if (!user) {
        setMonitors([]);
        setIsLoading(false);
        return;
      }

      try {
        // First fetch the monitors
        const { data, error } = await supabase
          .from('monitors')
          .select('*')
          .eq('user_id', user.id)
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
        
        // Fetch the latest result for each safe_address + network combination
        const resultsPromises = data.map(monitor => 
          supabase
            .from('results')
            .select('safe_address, network, scanned_at, result')
            .eq('safe_address', monitor.safe_address)
            .eq('network', monitor.network)
            .order('scanned_at', { ascending: false })
            .limit(1)
        );
        
        const resultsResponses = await Promise.all(resultsPromises);
        
        // Create a map of the latest scan time for each monitor's safe_address+network
        const latestScans = {};
        resultsResponses.forEach((response, index) => {
          if (response.error) {
            console.error('Error fetching results:', response.error);
            return;
          }
          
          if (response.data && response.data.length > 0) {
            const monitor = data[index];
            const key = `${monitor.safe_address.toLowerCase()}-${monitor.network.toLowerCase()}`;
            latestScans[key] = response.data[0].scanned_at;
          }
        });

        // Get suspicious transaction counts for each address+network pair
        const alertPromises = data.map(monitor =>
          supabase
            .from('results')
            .select('id', { count: 'exact' })
            .eq('safe_address', monitor.safe_address)
            .eq('network', monitor.network)
            .eq('result->type', 'suspicious')
            .not('result->transaction_hash', 'is', null)
        );
        
        const alertResponses = await Promise.all(alertPromises);
        
        // Create a map of alert counts for each address+network pair
        const alertCountMap = {};
        alertResponses.forEach((response, index) => {
          if (response.error) {
            console.error('Error fetching alert counts:', response.error);
            return;
          }
          
          const monitor = data[index];
          const key = `${monitor.safe_address.toLowerCase()}-${monitor.network.toLowerCase()}`;
          alertCountMap[key] = response.count || 0;
        });

        const formattedMonitors = data.map(monitor => {
          const key = `${monitor.safe_address.toLowerCase()}-${monitor.network.toLowerCase()}`;
          return {
            id: monitor.id,
            safe_address: monitor.safe_address,
            network: monitor.network,
            active: monitor.settings?.active !== false, // Default to true if not specified
            notify: monitor.settings?.notify || false,
            settings: monitor.settings || {},
            created_at: monitor.created_at,
            alias: monitor.settings?.alias,
            notificationMethod: monitor.settings?.notificationMethod,
            notificationTarget: monitor.settings?.notificationTarget,
            lastChecked: latestScans[key] || null, // Use actual last checked time or null
            alertCount: alertCountMap[key] || 0 // Real alert count from database
          };
        });

        setMonitors(formattedMonitors);
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMonitors();
  }, [user, toast]);
  
  // Fetch alerts when page, filters, or per page settings change
  useEffect(() => {
    if (!user) return;
    
    // Skip alert fetching if no monitors are set up
    if (monitors.length === 0) {
      setAlerts([]);
      setTotalAlerts(0);
      setIsLoadingAlerts(false);
      return;
    }
    
    async function fetchAlerts() {
      setIsLoadingAlerts(true);
      
      try {
        // Get safe addresses and networks from user's monitors
        const addressNetworkPairs = monitors.map(m => ({
          safe_address: m.safe_address,
          network: m.network
        }));
        
        // Build the query from results table for transaction alerts
        let query = supabase
          .from('results')
          .select('id, safe_address, network, scanned_at, result');
        
        // Apply safe address filter if selected
        if (alertsFilter.safe) {
          const selectedMonitor = monitors.find(m => m.id === alertsFilter.safe);
          if (selectedMonitor) {
            query = query
              .eq('safe_address', selectedMonitor.safe_address)
              .eq('network', selectedMonitor.network);
          }
        } else {
          // Otherwise filter to only include the user's monitored addresses
          const orConditions = addressNetworkPairs.map(pair => 
            `safe_address.eq.${pair.safe_address},network.eq.${pair.network}`
          ).join(',');
          
          if (orConditions) {
            query = query.or(orConditions);
          }
        }
        
        query = query.order('scanned_at', { ascending: false });
        
        // Get count results - simplified approach using client-side filtering
        const { data: allResults, error: countError } = await query;
        
        if (countError) {
          console.error('Error fetching results:', countError);
          throw countError;
        }
        
        // Filter for transaction alerts only (exclude status updates)
        const transactionAlerts = allResults.filter(result => 
          result.result && 
          result.result.transaction_hash && 
          (!alertsFilter.type || result.result.type === alertsFilter.type)
        );
        
        setTotalAlerts(transactionAlerts.length);
        
        // Apply pagination client-side
        const paginatedAlerts = transactionAlerts.slice(
          (alertsPage - 1) * alertsPerPage, 
          alertsPage * alertsPerPage
        );
        
        // Format alerts from the result JSON
        const formattedAlerts: Alert[] = paginatedAlerts.map(alert => {
          const result = alert.result || {};
          return {
            id: alert.id,
            safe_address: alert.safe_address,
            network: alert.network,
            transaction_hash: result.transaction_hash || '',
            description: result.description || 'Unknown transaction',
            scanned_at: alert.scanned_at,
            type: result.type || 'normal',
            result: result
          };
        });
        
        setAlerts(formattedAlerts);
      } catch (error) {
        console.error('Error fetching alerts:', error);
        toast({
          title: "Error Fetching Alerts",
          description: "There was a problem retrieving alert data",
          variant: "destructive",
        });
      } finally {
        setIsLoadingAlerts(false);
      }
    }
    
    fetchAlerts();
  }, [user, alertsPage, alertsPerPage, alertsFilter, monitors, toast]);

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

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Waiting for first check';
    
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

  // Function to generate and download CSV data
  const downloadCsv = () => {
    // Create CSV header
    const header = ['Safe', 'Network', 'Transaction', 'Time', 'Type'].join(',');
    
    // Convert alerts to CSV rows
    const rows = alerts.map(alert => {
      // Find the monitor that matches this safe address
      const monitor = monitors.find(m => 
        m.safe_address === alert.safe_address && 
        m.network === alert.network
      );
      const safeName = monitor?.alias || truncateAddress(alert.safe_address);
      const txDescription = alert.description.replace(/,/g, ';'); // Replace commas to avoid CSV issues
      return [
        safeName,
        alert.network,
        txDescription,
        new Date(alert.scanned_at).toLocaleString(),
        alert.type
      ].join(',');
    });
    
    // Combine header and rows
    const csvContent = [header, ...rows].join('\n');
    
    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link and trigger it
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `safe-watch-alerts-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "CSV Export Complete",
      description: `${alerts.length} alerts exported successfully`
    });
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
                        <span>{formatTimeAgo(monitor.lastChecked)}</span>
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
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle>Alert History</CardTitle>
                    <CardDescription>
                      Transaction alerts from your monitored Safe vaults
                    </CardDescription>
                  </div>
                  
                  <div className="flex flex-row gap-2 items-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs flex items-center gap-1 h-8 px-2"
                      onClick={downloadCsv}
                    >
                      <FileDown className="h-3 w-3" />
                      CSV Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Select 
                        value={alertsFilter.safe || "all"} 
                        onValueChange={(value) => setAlertsFilter(prev => ({ ...prev, safe: value === "all" ? null : value }))}
                      >
                        <SelectTrigger className="h-8 text-xs min-w-[140px] w-fit">
                          <SelectValue placeholder="Filter by Safe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Safes</SelectItem>
                          {monitors.map(monitor => (
                            <SelectItem key={monitor.id} value={monitor.id}>
                              {monitor.alias || truncateAddress(monitor.safe_address)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select 
                        value={alertsFilter.type || "all"} 
                        onValueChange={(value) => setAlertsFilter(prev => ({ ...prev, type: value === "all" ? null : value }))}
                      >
                        <SelectTrigger className="h-8 text-xs min-w-[140px] w-fit">
                          <SelectValue placeholder="Alert Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Alerts</SelectItem>
                          <SelectItem value="suspicious">Suspicious Only</SelectItem>
                          <SelectItem value="normal">Normal Transactions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <p className="text-xs text-muted-foreground whitespace-nowrap mr-2">
                      {totalAlerts === 0
                        ? 'No alerts'
                        : `Showing ${(alertsPage - 1) * alertsPerPage + 1}-${Math.min(alertsPage * alertsPerPage, totalAlerts)} of ${totalAlerts}`}
                    </p>
                    <Select 
                      value={alertsPerPage.toString()} 
                      onValueChange={(value) => {
                        setAlertsPerPage(parseInt(value));
                        setAlertsPage(1); // Reset to first page when changing items per page
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs w-[70px]">
                        <SelectValue placeholder="Show" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Safe</TableHead>
                        <TableHead>Network</TableHead>
                        <TableHead>Transaction</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingAlerts ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : alerts.length > 0 ? (
                        alerts.map((alert, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {monitors.find(m => 
                                m.safe_address === alert.safe_address && 
                                m.network === alert.network
                              )?.alias || 
                               truncateAddress(alert.safe_address)}
                            </TableCell>
                            <TableCell>
                              {alert.network}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate">
                                <Link 
                                  to={`https://etherscan.io/tx/${alert.transaction_hash}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  {alert.description}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell>{formatTimeAgo(alert.scanned_at)}</TableCell>
                            <TableCell>
                              {alert.type === 'suspicious' ? (
                                <Badge variant="destructive">Suspicious</Badge>
                              ) : (
                                <Badge variant="outline">Normal</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                            No alerts found with the current filters
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAlertsPage(1)}
                    disabled={alertsPage === 1}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAlertsPage(prev => Math.max(prev - 1, 1))}
                    disabled={alertsPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 text-sm">
                    <span>Page {alertsPage} of {totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAlertsPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={alertsPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAlertsPage(totalPages)}
                    disabled={alertsPage === totalPages}
                  >
                    Last
                  </Button>
                </div>
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
