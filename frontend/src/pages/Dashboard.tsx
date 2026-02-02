import { Helmet } from "react-helmet-async";
import {
  Shield,
  Activity,
  AlertTriangle,
  Bell,
  TrendingUp,
  Network,
  Zap,
  Target,
  Award,
  Eye,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { dashboardApi, type DashboardStats } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [animatedStats, setAnimatedStats] = useState({
    monitors: 0,
    transactions: 0,
    suspicious: 0,
    alerts: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const statsData = await dashboardApi.getStats();
        setStats(statsData);
        setLoading(false);

        // Animate counters
        const duration = 1000;
        const steps = 30;
        const interval = duration / steps;
        let currentStep = 0;

        const timer = setInterval(() => {
          currentStep++;
          const progress = currentStep / steps;

          setAnimatedStats({
            monitors: Math.floor(statsData.activeMonitors * progress),
            transactions: Math.floor(statsData.totalTransactions * progress),
            suspicious: Math.floor(
              statsData.suspiciousTransactions * progress,
            ),
            alerts: Math.floor(statsData.recentAlerts * progress),
          });

          if (currentStep >= steps) {
            clearInterval(timer);
            setAnimatedStats({
              monitors: statsData.activeMonitors,
              transactions: statsData.totalTransactions,
              suspicious: statsData.suspiciousTransactions,
              alerts: statsData.recentAlerts,
            });
          }
        }, interval);

        return () => clearInterval(timer);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const safeWallets = stats
    ? stats.totalTransactions - stats.suspiciousTransactions
    : 0;
  const securityScore =
    stats && stats.totalTransactions > 0
      ? Math.round((safeWallets / stats.totalTransactions) * 100)
      : 100;

  const getSecurityLevel = (score: number) => {
    if (score >= 95)
      return { text: "Excellent", color: "text-green-500", bg: "bg-green-500" };
    if (score >= 85)
      return { text: "Good", color: "text-blue-500", bg: "bg-blue-500" };
    if (score >= 70)
      return { text: "Fair", color: "text-yellow-500", bg: "bg-yellow-500" };
    return { text: "Needs Attention", color: "text-red-500", bg: "bg-red-500" };
  };

  const securityLevel = getSecurityLevel(securityScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-8">
      <Helmet>
        <title>Dashboard - Multisig Monitor</title>
        <meta
          name="description"
          content="Your multisig wallet monitoring dashboard."
        />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="mb-8 animate-slide-down">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                Dashboard
              </h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Real-time security posture of your multisig wallets
              </p>
            </div>
            {stats && (
              <div className="hidden md:flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-jsr-purple/10 to-purple-600/10 border border-jsr-purple/20 rounded-xl">
                <Award className={`w-6 h-6 ${securityLevel.color}`} />
                <div>
                  <div className="text-xs text-muted-foreground">
                    Security Rating
                  </div>
                  <div className={`text-xl font-bold ${securityLevel.color}`}>
                    {securityLevel.text}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-jsr-purple/20 border-t-jsr-purple"></div>
              <Shield className="w-8 h-8 text-jsr-purple absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="mt-4 text-muted-foreground animate-pulse">
              Loading your security dashboard...
            </p>
          </div>
        ) : !user ? (
          <div className="text-center py-24 bg-gradient-to-r from-secondary/50 to-secondary/30 rounded-2xl border-2 border-dashed">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4 text-lg">
              Please sign in to view your dashboard
            </p>
          </div>
        ) : stats ? (
          <>
            {/* Score Card */}
            <Card className="mb-6 bg-gradient-to-br from-jsr-purple/5 via-purple-600/5 to-pink-500/5 border-jsr-purple/20 overflow-hidden relative animate-slide-up">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-jsr-purple/10 to-transparent rounded-full blur-3xl" />
              <CardContent className="pt-8 pb-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-jsr-purple to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Target className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold">{securityScore}%</div>
                      <div className="text-sm text-muted-foreground">
                        Security Score
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <div className="text-sm text-muted-foreground mb-2">
                      Protection Level
                    </div>
                    <Progress value={securityScore} className="h-3" />
                    <div
                      className={`text-xs mt-1 font-medium ${securityLevel.color}`}
                    >
                      {securityLevel.text} Protection
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {stats.active_monitors > 0 && (
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                        <Shield className="w-3 h-3 mr-1" />
                        {stats.active_monitors} Safes
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up"
              style={{ animationDelay: "50ms" }}
            >
              <Card
                className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40 relative overflow-hidden"
                onClick={() => navigate("/monitor")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Shield className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold bg-gradient-to-br from-purple-600 to-purple-800 bg-clip-text text-transparent">
                        {animatedStats.monitors}
                      </div>
                      <div className="text-xs text-purple-600 font-medium">
                        ACTIVE
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Active Monitors
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Protected multisig wallets
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20 hover:border-blue-500/40 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Activity className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold bg-gradient-to-br from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        {animatedStats.transactions}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        TRACKED
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Total Transactions
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Monitored operations
                  </p>
                </CardContent>
              </Card>

              <Card
                className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-orange-500/10 to-red-500/5 border-orange-500/20 hover:border-orange-500/40 relative overflow-hidden"
                onClick={() => navigate("/alerts")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <AlertTriangle className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold bg-gradient-to-br from-orange-600 to-red-600 bg-clip-text text-transparent">
                        {animatedStats.suspicious}
                      </div>
                      <div className="text-xs text-orange-600 font-medium">
                        FLAGGED
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Suspicious Activity
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Threats detected
                  </p>
                </CardContent>
              </Card>

              <Card
                className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/20 hover:border-amber-500/40 relative overflow-hidden"
                onClick={() => navigate("/alerts")}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Bell className="w-7 h-7 text-white animate-pulse" />
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold bg-gradient-to-br from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                        {animatedStats.alerts}
                      </div>
                      <div className="text-xs text-amber-600 font-medium">
                        7 DAYS
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Recent Alerts
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Notifications sent
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Stats */}
            <div
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 animate-slide-up"
              style={{ animationDelay: "100ms" }}
            >
              <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-3xl font-bold text-green-600">
                      {safeWallets}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Clean Transactions
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    No threats detected
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-green-500/20 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full transition-all duration-1000"
                        style={{
                          width: `${stats.totalTransactions > 0 ? (safeWallets / stats.totalTransactions) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-green-600">
                      {stats.totalTransactions > 0
                        ? Math.round(
                            (safeWallets / stats.totalTransactions) * 100,
                          )
                        : 0}
                      %
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-500/10 to-pink-500/5 border-purple-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Network className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-3xl font-bold text-purple-600">
                      {stats.monitoredNetworks.length}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    Networks Monitored
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {stats.monitoredNetworks.slice(0, 3).map((network) => (
                      <Badge
                        key={network}
                        className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs"
                      >
                        {network}
                      </Badge>
                    ))}
                    {stats.monitoredNetworks.length > 3 && (
                      <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
                        +{stats.monitoredNetworks.length - 3} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    </div>
                    <span className="text-3xl font-bold text-foreground">
                      {safeWallets}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Clean Transactions
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    No issues detected
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Network className="w-6 h-6 text-purple-500" />
                    </div>
                    <span className="text-3xl font-bold text-foreground">
                      {stats.monitoredNetworks.length}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Networks Monitored
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {stats.monitoredNetworks.slice(0, 3).map((network) => (
                      <Badge
                        key={network}
                        variant="outline"
                        className="text-xs"
                      >
                        {network}
                      </Badge>
                    ))}
                    {stats.monitoredNetworks.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{stats.monitoredNetworks.length - 3} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              Unable to load dashboard data
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
