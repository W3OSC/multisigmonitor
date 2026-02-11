import { Helmet } from 'react-helmet-async'
import { Shield, ExternalLink, Key, Copy, Trash2, Plus, Sparkles, Zap, ChevronRight, Home } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { useState, useEffect } from 'react'
import { apiKeysApi, type ApiKey, type CreateApiKeyResponse } from '@/lib/api'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(null)
  const [creating, setCreating] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const keys = await apiKeysApi.list()
      setApiKeys(keys)
    } catch (error) {
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKey = async () => {
    setCreating(true)
    try {
      const newKey = await apiKeysApi.create({ 
        name: newKeyName.trim() || undefined 
      })
      setCreatedKey(newKey)
      setShowCreateDialog(false)
      setNewKeyName('')
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
      await loadApiKeys()
      toast.success('API key created successfully!')
    } catch (error) {
      toast.error('Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
    toast.success('API key copied to clipboard!')
  }

  const handleRevokeKey = async (id: string, name: string) => {
    try {
      await apiKeysApi.revoke(id)
      await loadApiKeys()
      toast.success('API key revoked successfully')
    } catch (error) {
      toast.error('Failed to revoke API key')
    }
  }

  const getKeyAge = (createdAt: string) => {
    const now = new Date()
    const created = new Date(createdAt)
    const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    if (days < 30) return `${days} days ago`
    const months = Math.floor(days / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  }

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const days = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (days < 0) return 'Expired'
    if (days === 0) return 'Expires today'
    if (days === 1) return '1 day left'
    if (days < 30) return `${days} days left`
    const months = Math.floor(days / 30)
    return months === 1 ? '1 month left' : `${months} months left`
  }

  const getExpiryColor = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const days = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (days < 0) return 'text-red-500'
    if (days < 30) return 'text-orange-500'
    if (days < 60) return 'text-yellow-500'
    return 'text-green-500'
  }

  const activeKeys = apiKeys.filter(k => !k.is_revoked && new Date(k.expires_at) > new Date())

  const getDisplayName = () => {
    if (user?.username) return user.username
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    if (user?.user_metadata?.name) return user.user_metadata.name
    if (user?.email) return user.email.split('@')[0]
    return 'User'
  }

  const getInitials = () => {
    const name = getDisplayName()
    return name.charAt(0).toUpperCase()
  }

  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url || null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Settings - Multisig Monitor</title>
        <meta name="description" content="Manage your account settings and preferences." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="flex-1 container py-12">
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <Home className="h-4 w-4 mr-1" />
            Dashboard
          </Button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Settings</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        <div className="space-y-6">
          {user?.ethereum_address && (
            <div className="bg-card border border-border rounded-lg p-6 animate-slide-up backdrop-blur-sm">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Ethereum Address</label>
                  <Input 
                    type="text" 
                    value={user.ethereum_address}
                    disabled
                    className="bg-muted font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-jsr-purple" />
              <h2 className="text-xl font-bold text-foreground">Appearance</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">Theme</p>
                  <p className="text-xs text-muted-foreground">Toggle between light and dark mode</p>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Key className="w-5 h-5 text-jsr-purple" />
                {showConfetti && (
                  <Sparkles className="w-4 h-4 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">API Keys</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeKeys.length} active key{activeKeys.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button
                onClick={() => setShowCreateDialog(true)}
                size="sm"
                className="bg-gradient-to-r from-jsr-purple to-purple-600 hover:from-purple-600 hover:to-jsr-purple transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Key
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-jsr-purple"></div>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-12 bg-secondary/30 rounded-lg border-2 border-dashed border-border">
                <Key className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="font-semibold text-foreground mb-2">No API Keys</h3>
                <p className="text-sm text-muted-foreground mb-4">Create an API key to access the API programmatically</p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  variant="outline"
                  className="border-jsr-purple text-jsr-purple hover:bg-jsr-purple hover:text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Key
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key, index) => (
                  <Card
                    key={key.id}
                    className={`border transition-all duration-300 hover:shadow-md ${
                      key.is_revoked || new Date(key.expires_at) < new Date()
                        ? 'opacity-50 bg-secondary/20'
                        : 'bg-card hover:border-jsr-purple/50'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {key.name}
                            {!key.is_revoked && new Date(key.expires_at) > new Date() && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                <Zap className="w-3 h-3" />
                                Active
                              </span>
                            )}
                            {key.is_revoked && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                Revoked
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            Created {getKeyAge(key.createdAt)}
                            {key.last_used_at && ` • Last used ${getKeyAge(key.last_used_at)}`}
                          </CardDescription>
                        </div>
                        {!key.is_revoked && new Date(key.expires_at) > new Date() && (
                          <Button
                            onClick={() => handleRevokeKey(key.id, key.name)}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded font-mono text-xs">
                          <Key className="w-3 h-3 text-muted-foreground" />
                          <span className="flex-1">{key.key_prefix}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-medium ${getExpiryColor(key.expires_at)}`}>
                            {getTimeUntilExpiry(key.expires_at)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <ExternalLink className="w-5 h-5 text-jsr-purple" />
              <h2 className="text-xl font-bold text-foreground">Developer</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">API Documentation</p>
                  <p className="text-xs text-muted-foreground">Interactive API documentation and testing</p>
                </div>
                <a href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:7111'}/api-docs`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    Open Docs
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-jsr-purple" />
                Create New API Key
              </DialogTitle>
            <DialogDescription>
              Give your API key a descriptive name (optional). It will expire in 6 months.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Key Name
              </label>
              <Input
                placeholder="e.g., Production Server, Development, Mobile App"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                className="w-full"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateKey}
                disabled={creating}
                className="flex-1 bg-gradient-to-r from-jsr-purple to-purple-600 hover:from-purple-600 hover:to-jsr-purple"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Key
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowCreateDialog(false)}
                variant="outline"
                disabled={creating}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
              API Key Created Successfully!
            </DialogTitle>
            <DialogDescription className="text-orange-600 dark:text-orange-400 font-medium">
              Make sure to copy your API key now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="font-semibold text-foreground">Achievement Unlocked!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You've created "{createdKey.name}". Use this key in your application's headers:
                </p>
                <code className="block mt-2 p-2 bg-black/20 rounded text-xs">
                  X-API-Key: {createdKey.key_prefix}...
                </code>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Your API Key
                </label>
                <div className="flex gap-2">
                  <Input
                    value={createdKey.key}
                    readOnly
                    className="font-mono text-xs flex-1 bg-secondary"
                  />
                  <Button
                    onClick={() => handleCopyKey(createdKey.key)}
                    className={`transition-all duration-300 ${
                      copiedKey
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-jsr-purple hover:bg-purple-600'
                    }`}
                  >
                    {copiedKey ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-secondary/30 rounded">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">{new Date(createdKey.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-secondary/30 rounded">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="font-medium text-orange-500">
                    {new Date(createdKey.expires_at).toLocaleDateString()} (6 months)
                  </span>
                </div>
              </div>

              <Button
                onClick={() => setCreatedKey(null)}
                className="w-full"
                variant="outline"
              >
                I've Saved My Key
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </main>
    </div>
  )
}
