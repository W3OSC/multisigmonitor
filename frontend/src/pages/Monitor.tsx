
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderWithLoginDialog } from "@/components/Header";
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

interface Monitor {
  id: string;
  address: string;
  alias: string | null;
  network: string;
  active: boolean;
  notificationMethod: string;
  notificationTarget: string;
  lastChecked: string;
  alertCount: number;
}

const Monitor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real app, you would fetch from your API
    setTimeout(() => {
      setMonitors([
        {
          id: "m1",
          address: "0x1234567890123456789012345678901234567890",
          alias: "Main Treasury",
          network: "Ethereum",
          active: true,
          notificationMethod: "Email",
          notificationTarget: "admin@example.com",
          lastChecked: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          alertCount: 0
        },
        {
          id: "m2",
          address: "0x0987654321098765432109876543210987654321",
          alias: null,
          network: "Polygon",
          active: true,
          notificationMethod: "Discord",
          notificationTarget: "webhooks/...",
          lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          alertCount: 2
        }
      ]);
      setIsLoading(false);
    }, 1000);
  }, []);

  const toggleMonitor = (id: string) => {
    setMonitors(monitors.map(m => 
      m.id === id ? { ...m, active: !m.active } : m
    ));
    
    const monitor = monitors.find(m => m.id === id);
    
    toast({
      title: monitor?.active ? "Monitor Paused" : "Monitor Activated",
      description: monitor?.active 
        ? `Paused monitoring for ${monitor.alias || monitor.address}` 
        : `Activated monitoring for ${monitor.alias || monitor.address}`,
    });
  };

  const deleteMonitor = (id: string) => {
    const monitor = monitors.find(m => m.id === id);
    
    setMonitors(monitors.filter(m => m.id !== id));
    
    toast({
      title: "Monitor Deleted",
      description: `Successfully removed monitoring for ${monitor?.alias || monitor?.address}`,
    });
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
                      <CardTitle className="truncate">{monitor.alias || truncateAddress(monitor.address)}</CardTitle>
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
                        <span className="font-mono">{truncateAddress(monitor.address)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Notifications:</span>
                        <span>{monitor.notificationMethod}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last checked:</span>
                        <span>{formatTimeAgo(monitor.lastChecked)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Alerts:</span>
                        <span className="flex items-center">
                          {monitor.alertCount > 0 && (
                            <AlertCircle className="mr-1 h-3.5 w-3.5 text-destructive" />
                          )}
                          {monitor.alertCount}
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
                    {monitors.some(m => m.alertCount > 0) ? (
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
