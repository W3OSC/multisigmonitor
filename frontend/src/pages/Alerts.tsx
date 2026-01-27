import { Helmet } from 'react-helmet-async'
import { Bell, Shield, ShieldAlert, Settings as SettingsIcon, ExternalLink, Loader2, Mail, Send, MessageSquare, Webhook } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { notificationsApi, type NotificationRecord } from '@/lib/api'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function Alerts() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [selectedAlertType, setSelectedAlertType] = useState<string | null>(null)

  const alertTypes = [
    {
      id: 'email',
      name: 'Email',
      icon: Mail,
      description: 'Receive alerts via email',
      isActive: false,
      bgColor: 'bg-blue-500',
      iconColor: 'text-blue-500',
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: Send,
      description: 'Receive alerts via Telegram bot',
      isActive: false,
      bgColor: 'bg-cyan-500',
      iconColor: 'text-cyan-500',
    },
    {
      id: 'discord',
      name: 'Discord',
      icon: MessageSquare,
      description: 'Receive alerts via Discord webhook',
      isActive: false,
      bgColor: 'bg-indigo-500',
      iconColor: 'text-indigo-500',
    },
    {
      id: 'webhook',
      name: 'Webhook',
      icon: Webhook,
      description: 'Send alerts to custom endpoints',
      isActive: false,
      bgColor: 'bg-purple-500',
      iconColor: 'text-purple-500',
    },
  ]

  useEffect(() => {
    async function fetchNotifications() {
      if (!user) {
        setNotifications([])
        return
      }

      setIsLoadingNotifications(true)
      try {
        const data = await notificationsApi.list()
        setNotifications(data)
      } catch (error) {
        console.error('Error fetching notifications:', error)
        setNotifications([])
      } finally {
        setIsLoadingNotifications(false)
      }
    }
    
    fetchNotifications()
  }, [user])

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return `${Math.floor(seconds / 604800)}w ago`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-8">
      <Helmet>
        <title>Alerts - Multisig Monitor</title>
        <meta name="description" content="Manage notification settings and view alert history." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 animate-slide-down">
          <h1 className="text-4xl font-bold text-foreground mb-2">Alerts</h1>
          <p className="text-muted-foreground">
            Configure alert settings and view notification history
          </p>
        </div>

        <div className="space-y-6">
          {/* Alert Settings Section */}
          <Card className="animate-slide-up">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-jsr-purple" />
                <div>
                  <CardTitle>Alert Settings</CardTitle>
                  <CardDescription>
                    Configure how you want to receive alerts about your monitored wallets
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {alertTypes.map((alertType) => {
                  const Icon = alertType.icon
                  return (
                    <div
                      key={alertType.id}
                      onClick={() => setSelectedAlertType(alertType.id)}
                      className="group relative overflow-hidden rounded-lg border-2 border-border hover:border-jsr-purple transition-all duration-300 cursor-pointer bg-card"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-12 h-12 rounded-lg ${alertType.bgColor} bg-opacity-10 group-hover:bg-opacity-20 transition-all flex items-center justify-center shrink-0`}>
                            <Icon className={`h-6 w-6 ${alertType.iconColor}`} />
                          </div>
                          <div className="flex items-center gap-2">
                            {alertType.isActive ? (
                              <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 text-xs px-2 py-0">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted border-muted-foreground/20 text-xs px-2 py-0">
                                Off
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <h3 className="text-base font-semibold mb-1 group-hover:text-jsr-purple transition-colors">
                          {alertType.name}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {alertType.description}
                        </p>
                        
                        <div className="mt-3 flex items-center text-xs text-jsr-purple font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Configure
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </div>
                      </div>
                      
                      <div className={`absolute inset-0 ${alertType.bgColor} opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none`} />
                    </div>
                  )
                })}
              </div>
              
              <div className="p-4 bg-jsr-purple/5 border border-jsr-purple/20 rounded-lg text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <span className="text-xl">💡</span>
                  <span>Alert settings are configured per-wallet in the Monitor settings. Use the gear icon on each wallet card to configure alerts for that specific wallet.</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dialog for configuring alerts */}
          <Dialog open={selectedAlertType !== null} onOpenChange={(open) => !open && setSelectedAlertType(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure {alertTypes.find(a => a.id === selectedAlertType)?.name} Alerts</DialogTitle>
                <DialogDescription>
                  Set up {alertTypes.find(a => a.id === selectedAlertType)?.name} notifications for your monitored wallets
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground text-center">
                  Alert configuration is done per-wallet in the Monitor settings. Navigate to your wallet and click the gear icon to configure {alertTypes.find(a => a.id === selectedAlertType)?.name} alerts.
                </p>
              </div>
            </DialogContent>
          </Dialog>

          {/* Notification History Section */}
          <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SettingsIcon className="w-5 h-5 text-jsr-purple" />
                <div>
                  <CardTitle>Alert History</CardTitle>
                  <CardDescription>
                    Recent alerts sent by the monitoring system
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingNotifications ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No alerts sent yet</p>
                  <p className="text-sm mt-2">Alerts will appear here when transactions are detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => {
                    const notifDate = new Date(notification.notified_at)
                    const timeAgo = formatTimeAgo(notifDate.getTime())
                    
                    return (
                      <div 
                        key={notification.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="mt-1">
                          {notification.transaction_type === 'suspicious' ? (
                            <ShieldAlert className="h-5 w-5 text-orange-500" />
                          ) : notification.transaction_type === 'management' ? (
                            <SettingsIcon className="h-5 w-5 text-blue-500" />
                          ) : (
                            <Shield className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={
                              notification.transaction_type === 'suspicious' ? 'destructive' : 
                              notification.transaction_type === 'management' ? 'default' : 
                              'outline'
                            }>
                              {notification.transaction_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{timeAgo}</span>
                          </div>
                          
                          <p className="text-sm mt-1">
                            {notification.safe_address.slice(0, 6)}...{notification.safe_address.slice(-4)} on {notification.network}
                          </p>
                          
                          <a
                            href={`/monitor/${notification.transaction_hash}`}
                            className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                          >
                            View Transaction <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {notifDate.toLocaleDateString()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
