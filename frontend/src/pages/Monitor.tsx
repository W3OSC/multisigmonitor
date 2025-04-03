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

// Interface for Alert data
interface Alert {
  id: string;
  address: string;
  alias?: string;
  network: string;
  txHash: string;
  description: string;
  timestamp: string;
  type: 'normal' | 'suspicious';
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
  
  // Fetch alerts when page, filters, or per page settings change
  useEffect(() => {
    if (!user) return;
    
    async function fetchAlerts() {
      setIsLoadingAlerts(true);
      
      try {
        // In a real app, this would be an API call with filtering and pagination
        // For this demo, we'll simulate some data
        
        // Wait a moment to simulate loading
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Generate mock alerts - in a real app this would come from your API
        const mockAlerts: Alert[] = [
          {
            id: '1',
            address: '0x1234567890123456789012345678901234567890',
            alias: 'Main Treasury',
            network: 'Ethereum',
            txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            description: 'Suspicious multi-sig execution with unknown contract',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
            type: 'suspicious'
          },
          {
            id: '2',
            address: '0x0987654321098765432109876543210987654321',
            alias: 'Grants Safe',
            network: 'Polygon',
            txHash: '0x0987654321098765432109876543210987654321098765432109876543210987',
            description: 'Normal token transfer of 5,000 USDC',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
            type: 'normal'
          },
          {
            id: '3',
            address: '0x0987654321098765432109876543210987654321',
            alias: 'Grants Safe',
            network: 'Polygon',
            txHash: '0x1111222233334444555566667777888899990000111122223333444455556666',
            description: 'Suspicious contract interaction with blacklisted address',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
            type: 'suspicious'
          },
          {
            id: '4',
            address: '0x1234567890123456789012345678901234567890',
            alias: 'Main Treasury',
            network: 'Ethereum',
            txHash: '0x2222333344445555666677778888999900001111222233334444555566667777',
            description: 'Normal interaction with Uniswap router',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
            type: 'normal'
          },
          {
            id: '5',
            address: '0x5678901234567890123456789012345678901234',
            network: 'Arbitrum',
            txHash: '0x3333444455556666777788889999000011112222333344445555666677778888',
            description: 'Normal token approval to verified contract',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 days ago
            type: 'normal'
          }
        ];
        
        // Apply filters
        let filteredAlerts = [...mockAlerts];
        
        if (alertsFilter.safe) {
          filteredAlerts = filteredAlerts.filter(alert => 
            alert.address === alertsFilter.safe ||
            monitors.find(m => m.id === alertsFilter.safe)?.safe_address === alert.address
          );
        }
        
        if (alertsFilter.type) {
          filteredAlerts = filteredAlerts.filter(alert => 
            alert.type === alertsFilter.type
          );
        }
        
        // Calculate pagination
        const total = filteredAlerts.length;
        const startIndex = (alertsPage - 1) * alertsPerPage;
        const endIndex = startIndex + alertsPerPage;
        const pagedAlerts = filteredAlerts.slice(startIndex, endIndex);
        
        setAlerts(pagedAlerts);
        setTotalAlerts(total);
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

  // Function to generate and download CSV data
  const downloadCsv = () => {
    // Create CSV header
    const header = ['Safe', 'Network', 'Transaction', 'Time', 'Type'].join(',');
    
    // Convert alerts to CSV rows
    const rows = alerts.map(alert => {
      const safeName = alert.alias || truncateAddress(alert.address);
      const txDescription = alert.description.replace(/,/g, ';'); // Replace commas to avoid CSV issues
      return [
        safeName,
        alert.network,
        txDescription,
        new Date(alert.timestamp).toLocaleString(),
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
                              {alert.alias || truncateAddress(alert.address)}
                            </TableCell>
                            <TableCell>{alert.network}</TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate">
                                <Link 
                                  to={`https://etherscan.io/tx/${alert.txHash}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  {alert.description}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell>{formatTimeAgo(alert.timestamp)}</TableCell>
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
