import { Helmet } from 'react-helmet-async'
import { Bell, Shield, ShieldAlert, Settings as SettingsIcon, ExternalLink, Loader2, Send, MessageSquare, Webhook, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi, monitorsApi, type NotificationRecord, type Monitor } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export default function Alerts() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [openModal, setOpenModal] = useState<'telegram' | 'webhook' | null>(null)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [hasTelegramConfigured, setHasTelegramConfigured] = useState(false)
  const [hasWebhookConfigured, setHasWebhookConfigured] = useState(false)

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

  useEffect(() => {
    async function fetchMonitors() {
      if (!user) {
        setMonitors([])
        setHasTelegramConfigured(false)
        setHasWebhookConfigured(false)
        return
      }

      try {
        const data = await monitorsApi.list()
        setMonitors(data)
        
        let telegramFound = false
        let webhookFound = false
        
        data.forEach(monitor => {
          try {
            const settings = typeof monitor.settings === 'string' 
              ? JSON.parse(monitor.settings) 
              : monitor.settings
            
            // Check camelCase format (notificationChannels)
            if (settings?.notificationChannels && Array.isArray(settings.notificationChannels)) {
              settings.notificationChannels.forEach((channel: any) => {
                if (channel.type === 'telegram') telegramFound = true
                if (channel.type === 'webhook') webhookFound = true
              })
            }
            // Check snake_case format (notification_channels) for backwards compatibility
            else if (settings?.notification_channels && Array.isArray(settings.notification_channels)) {
              settings.notification_channels.forEach((channel: any) => {
                if (channel.type === 'telegram') telegramFound = true
                if (channel.type === 'webhook') webhookFound = true
              })
            }
            
            // Check old format for backwards compatibility
            if (settings?.notifications && Array.isArray(settings.notifications)) {
              settings.notifications.forEach((notif: any) => {
                if (notif.method === 'telegram') telegramFound = true
                if (notif.method === 'webhook' || notif.method === 'discord' || notif.method === 'slack') webhookFound = true
              })
            }
          } catch (e) {
            console.error('Error parsing monitor settings:', e)
          }
        })
        
        setHasTelegramConfigured(telegramFound)
        setHasWebhookConfigured(webhookFound)
      } catch (error) {
        console.error('Error fetching monitors:', error)
        setMonitors([])
      }
    }
    
    fetchMonitors()
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
          {/* Notification Channels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Telegram Card */}
            <Card 
              className="animate-slide-up hover:shadow-xl hover:border-cyan-400 transition-all cursor-pointer group relative"
              style={{ animationDelay: '50ms' }}
              onClick={() => user && setOpenModal('telegram')}
            >
              <div className={`absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full ${
                hasTelegramConfigured ? 'bg-green-500' : 'bg-gray-300'
              }`} />
              <CardContent className="pt-8 pb-6 flex flex-col items-center">
                <Send className="h-10 w-10 text-cyan-600 group-hover:text-cyan-700 transition-colors mb-3" />
                <h3 className="font-semibold text-base text-center">Telegram</h3>
              </CardContent>
            </Card>

            {/* Webhook Card */}
            <Card 
              className="animate-slide-up hover:shadow-xl hover:border-purple-400 transition-all cursor-pointer group relative"
              style={{ animationDelay: '100ms' }}
              onClick={() => user && setOpenModal('webhook')}
            >
              <div className={`absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full ${
                hasWebhookConfigured ? 'bg-green-500' : 'bg-gray-300'
              }`} />
              <CardContent className="pt-8 pb-6 flex flex-col items-center">
                <Webhook className="h-10 w-10 text-purple-600 group-hover:text-purple-700 transition-colors mb-3" />
                <h3 className="font-semibold text-base text-center">Webhook</h3>
              </CardContent>
            </Card>
          </div>

          {/* Telegram Configuration Modal */}
          <Dialog open={openModal === 'telegram'} onOpenChange={(open) => !open && setOpenModal(null)}>
            <DialogContent className="max-w-lg border-cyan-500/20">
              <DialogHeader>
                <div className="flex items-center justify-center mb-2">
                  <div className="p-4 bg-cyan-500/10 rounded-2xl">
                    <Send className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
                  </div>
                </div>
                <DialogTitle className="text-center text-xl">
                  Telegram Alerts
                </DialogTitle>
                <DialogDescription className="text-center">
                  Configure per-wallet Telegram notifications
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 dark:bg-cyan-500 text-white flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">Get your Chat ID</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        Search for <code className="px-2 py-0.5 bg-background/50 rounded text-cyan-600 dark:text-cyan-400 font-mono text-xs">@userinfobot</code> on Telegram and send it any message to get your Chat ID.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 dark:bg-cyan-500 text-white flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">Configure per wallet</p>
                      <p className="text-sm text-muted-foreground">
                        Go to your <button onClick={() => { setOpenModal(null); navigate('/monitor'); }} className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline cursor-pointer">Monitors</button> page, edit a wallet, enable Telegram notifications, and enter your Chat ID.
                      </p>
                    </div>
                  </div>
                </div>

                {monitors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your Monitors ({monitors.length})</p>
                    <div className="space-y-2">
                      {monitors.map((monitor) => {
                        const settings = typeof monitor.settings === 'string' 
                          ? JSON.parse(monitor.settings) 
                          : monitor.settings
                        const hasTelegram = settings?.notification_channels?.some((ch: any) => ch.type === 'telegram')
                        
                        return (
                          <div 
                            key={monitor.id} 
                            className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {settings?.alias || `${monitor.safeAddress.slice(0, 6)}...${monitor.safeAddress.slice(-4)}`}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">{monitor.network}</p>
                            </div>
                            {hasTelegram ? (
                              <Badge variant="default" className="bg-cyan-600 text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Not configured
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-background border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    💡 <span className="font-medium">Note:</span> We use a shared bot for all users, so you only need your Chat ID!
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Webhook Configuration Modal */}
          <Dialog open={openModal === 'webhook'} onOpenChange={(open) => !open && setOpenModal(null)}>
            <DialogContent className="max-w-lg border-purple-500/20">
              <DialogHeader>
                <div className="flex items-center justify-center mb-2">
                  <div className="p-4 bg-purple-500/10 rounded-2xl">
                    <Webhook className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <DialogTitle className="text-center text-xl">
                  Webhook Alerts
                </DialogTitle>
                <DialogDescription className="text-center">
                  Configure per-wallet webhook notifications (Discord, Slack, custom)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-3">
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                    <div className="flex items-start gap-3 mb-2">
                      <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">Discord</p>
                        <p className="text-sm text-muted-foreground mb-2">
                          In your Discord server: Server Settings → Integrations → Webhooks → New Webhook. Copy the webhook URL.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                    <div className="flex items-start gap-3 mb-2">
                      <Webhook className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">Slack or Custom</p>
                        <p className="text-sm text-muted-foreground">
                          Create an incoming webhook in your Slack workspace or use any custom webhook endpoint that accepts POST requests.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-background border border-border rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                        →
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">Configure per wallet</p>
                        <p className="text-sm text-muted-foreground">
                          Go to your <button onClick={() => { setOpenModal(null); navigate('/monitor'); }} className="text-purple-600 dark:text-purple-400 font-medium hover:underline cursor-pointer">Monitors</button> page, edit a wallet, enable webhook notifications, and paste your webhook URL.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {monitors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your Monitors ({monitors.length})</p>
                    <div className="space-y-2">
                      {monitors.map((monitor) => {
                        const settings = typeof monitor.settings === 'string' 
                          ? JSON.parse(monitor.settings) 
                          : monitor.settings
                        const hasWebhook = settings?.notification_channels?.some((ch: any) => ch.type === 'webhook')
                        
                        return (
                          <div 
                            key={monitor.id} 
                            className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {settings?.alias || `${monitor.safeAddress.slice(0, 6)}...${monitor.safeAddress.slice(-4)}`}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">{monitor.network}</p>
                            </div>
                            {hasWebhook ? (
                              <Badge variant="default" className="bg-purple-600 text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Not configured
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
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
                  <p className="text-sm mt-2">Alerts will appear here when risky transactions are detected, regardless of your configured alerting channels</p>
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
                            {notification.safeAddress.slice(0, 6)}...{notification.safeAddress.slice(-4)} on {notification.network}
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
