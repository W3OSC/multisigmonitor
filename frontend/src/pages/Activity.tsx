import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { activityApi, type WorkerActivity } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Activity, 
  AlertCircle, 
  Bell, 
  CheckCircle2, 
  ChevronRight,
  Home,
  Radio,
  RefreshCw,
  Trash2,
  XCircle 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EVENT_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string; bgColor: string; description: string }> = {
  scan_started: { 
    icon: Radio, 
    color: "text-blue-500", 
    bgColor: "bg-blue-500/10", 
    label: "Worker: Scan Started",
    description: "Worker began monitoring Safe for new transactions"
  },
  scan_completed: { 
    icon: CheckCircle2, 
    color: "text-green-500", 
    bgColor: "bg-green-500/10", 
    label: "Worker: Scan Complete",
    description: "Worker finished monitoring cycle"
  },
  transaction_found: { 
    icon: Activity, 
    color: "text-purple-500", 
    bgColor: "bg-purple-500/10", 
    label: "Transaction Detected",
    description: "New transaction discovered by worker"
  },
  transaction_analyzed: { 
    icon: Activity, 
    color: "text-indigo-500", 
    bgColor: "bg-indigo-500/10", 
    label: "Security Analysis",
    description: "Transaction analyzed for risks"
  },
  alert_sent: { 
    icon: Bell, 
    color: "text-yellow-500", 
    bgColor: "bg-yellow-500/10", 
    label: "Alert Dispatched",
    description: "Notification sent to configured channels"
  },
  scan_error: { 
    icon: XCircle, 
    color: "text-red-500", 
    bgColor: "bg-red-500/10", 
    label: "Worker Error",
    description: "Worker encountered an error"
  },
};

const ActivityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activities, setActivities] = useState<WorkerActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchActivities = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const query: { limit: number; eventType?: string } = { limit };
      if (eventTypeFilter !== "all") {
        query.eventType = eventTypeFilter;
      }
      const response = await activityApi.list(query);
      setActivities(response.activities);
      setTotal(response.total);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [user, eventTypeFilter, limit]);

  const handleRefresh = () => {
    fetchActivities();
  };

  const handleClear = async () => {
    try {
      setIsClearing(true);
      await activityApi.clear();
      setActivities([]);
      setTotal(0);
      setShowClearConfirm(false);
    } catch (error) {
      console.error("Failed to clear activities:", error);
    } finally {
      setIsClearing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to view activity logs.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 container py-12">
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <Home className="h-4 w-4 mr-1" />
            Dashboard
          </Button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Activity Log</span>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Activity Log</h1>
            <p className="text-muted-foreground mt-1">Monitor worker activity and system events</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="scan_started">Worker: Scan Started</SelectItem>
                <SelectItem value="scan_completed">Worker: Scan Complete</SelectItem>
                <SelectItem value="transaction_found">Transactions Detected</SelectItem>
                <SelectItem value="transaction_analyzed">Security Analysis</SelectItem>
                <SelectItem value="alert_sent">Alerts Dispatched</SelectItem>
                <SelectItem value="scan_error">Worker Errors</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              disabled={isLoading || total === 0}
              className="flex items-center gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Activity Log</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {total} activity log entries. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClear}
                disabled={isClearing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isClearing ? "Clearing..." : "Clear All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Worker Events</CardTitle>
                  <CardDescription>
                    {total} total events - Last updated {lastRefresh.toLocaleTimeString()}
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {isLoading && activities.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Loading activity...
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-lg font-medium">No activity yet</p>
                <p className="text-sm">Worker events will appear here as your monitors are scanned</p>
              </div>
            ) : (
              <div className="font-mono text-xs bg-background rounded-lg border border-border overflow-hidden">
                <div className="divide-y divide-border/50">
                  {activities.map((activity) => {
                    const config = EVENT_TYPE_CONFIG[activity.eventType] || {
                      icon: Activity,
                      color: "text-muted-foreground",
                      bgColor: "bg-muted",
                      label: activity.eventType,
                      description: "Worker activity"
                    };
                    const Icon = config.icon;
                    
                    let metadata: Record<string, any> = {};
                    if (activity.metadata) {
                      try {
                        metadata = JSON.parse(activity.metadata);
                      } catch (error) {
                        console.warn('Failed to parse activity metadata:', error);
                      }
                    }
                    
                    const timestamp = new Date(activity.createdAt).toISOString().replace('T', ' ').slice(0, 19);
                    
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-muted-foreground shrink-0">{timestamp}</span>
                        <Icon className={`h-3.5 w-3.5 ${config.color} shrink-0`} />
                        <span className={`shrink-0 ${config.color}`}>[{config.label}]</span>
                        {activity.network && (
                          <span className="text-blue-400 shrink-0">[{activity.network.toUpperCase()}]</span>
                        )}
                        <span className="text-foreground truncate">{activity.message}</span>
                        {activity.safeAddress && (
                          <span className="text-muted-foreground shrink-0">safe={activity.safeAddress}</span>
                        )}
                        {metadata.totalTransactions !== undefined && (
                          <span className="text-muted-foreground shrink-0">
                            txs={metadata.totalTransactions} pending={metadata.pendingTransactions || 0}
                          </span>
                        )}
                        {metadata.txHash && (
                          <span className="text-muted-foreground shrink-0">tx={metadata.txHash}</span>
                        )}
                        {metadata.alertType && (
                          <span className="text-yellow-500 shrink-0">[{metadata.alertType}]</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ActivityPage;
