import { useEffect, useState } from "react";
import { activityApi, type WorkerActivity } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  AlertCircle, 
  Bell, 
  CheckCircle2, 
  Radio,
  RefreshCw,
  XCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";

const EVENT_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  scan_started: { icon: Radio, color: "text-blue-500", label: "SCAN" },
  scan_completed: { icon: CheckCircle2, color: "text-green-500", label: "DONE" },
  transaction_found: { icon: Activity, color: "text-purple-500", label: "TX" },
  transaction_analyzed: { icon: Activity, color: "text-indigo-500", label: "ANALYZE" },
  alert_sent: { icon: Bell, color: "text-yellow-500", label: "ALERT" },
  scan_error: { icon: XCircle, color: "text-red-500", label: "ERROR" },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}



interface ActivityLogProps {
  monitorId?: string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function ActivityLog({ 
  monitorId, 
  limit = 20, 
  autoRefresh = true,
  refreshInterval = 30000 
}: ActivityLogProps) {
  const [activities, setActivities] = useState<WorkerActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchActivities = async () => {
    try {
      const response = await activityApi.list({ limit, monitorId });
      setActivities(response.activities);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    if (autoRefresh) {
      const interval = setInterval(fetchActivities, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [monitorId, limit, autoRefresh, refreshInterval]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchActivities();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Worker Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Updated {formatTimeAgo(lastRefresh.toISOString())}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[300px] pr-4">
          {isLoading && activities.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Loading activity...
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs">Worker events will appear here</p>
            </div>
          ) : (
            <div className="font-mono text-[11px] divide-y divide-border/30">
              {activities.map((activity) => {
                const config = EVENT_TYPE_CONFIG[activity.eventType] || {
                  icon: Activity,
                  color: "text-muted-foreground",
                  label: activity.eventType.toUpperCase(),
                };
                const Icon = config.icon;
                
                let metadata: Record<string, any> = {};
                if (activity.metadata) {
                  try {
                    metadata = JSON.parse(activity.metadata);
                  } catch {}
                }
                
                const time = new Date(activity.createdAt).toLocaleTimeString('en-US', { hour12: false });
                
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-1.5 py-1 hover:bg-muted/30"
                  >
                    <span className="text-muted-foreground shrink-0">{time}</span>
                    <Icon className={`h-3 w-3 ${config.color} shrink-0`} />
                    <span className={`shrink-0 ${config.color}`}>[{config.label}]</span>
                    {activity.network && (
                      <span className="text-blue-400 shrink-0">[{activity.network.toUpperCase()}]</span>
                    )}
                    <span className="text-foreground truncate">{activity.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
