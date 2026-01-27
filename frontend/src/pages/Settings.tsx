import { Helmet } from 'react-helmet-async'
import { Shield, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Settings() {
  const { user } = useAuth()

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
    <div className="p-4 sm:p-6 md:p-8">
      <Helmet>
        <title>Settings - Multisig Monitor</title>
        <meta name="description" content="Manage your account settings and preferences." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 sm:mb-8 animate-slide-down">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your account and preferences</p>
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
              <Shield className="w-5 h-5 text-jsr-purple" />
              <h2 className="text-xl font-bold text-foreground">Security</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">API Keys</p>
                  <p className="text-xs text-muted-foreground">Manage your API access keys</p>
                </div>
                <Button variant="outline" size="sm">Manage</Button>
              </div>
            </div>
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
                <a href="http://localhost:7111/api-docs" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    Open Docs
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
