import { Helmet } from 'react-helmet-async'
import { Shield, Activity, AlertTriangle, CheckCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    activeMonitors: 0,
    totalTransactions: 0,
    pendingAlerts: 0,
    safeWallets: 0,
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(false)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
        setLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <div className="p-8">
      <Helmet>
        <title>Dashboard - Multisig Monitor</title>
        <meta name="description" content="Your multisig wallet monitoring dashboard." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-slide-down">
          <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your multisig wallets and track transactions
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-jsr-purple"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-jsr-purple/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-jsr-purple" />
                </div>
                <span className="text-3xl font-bold text-foreground">{stats.activeMonitors}</span>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Active Monitors</h3>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-500" />
                </div>
                <span className="text-3xl font-bold text-foreground">{stats.totalTransactions}</span>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Transactions</h3>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-500" />
                </div>
                <span className="text-3xl font-bold text-foreground">{stats.pendingAlerts}</span>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Pending Alerts</h3>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <span className="text-3xl font-bold text-foreground">{stats.safeWallets}</span>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Safe Wallets</h3>
            </div>
          </div>
        )}

        <div className="mt-8 bg-card border border-border rounded-lg p-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Recent Activity</h2>
          <div className="text-center py-12 text-muted-foreground">
            No recent activity
          </div>
        </div>
      </div>
    </div>
  )
}
