import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2, AlertCircle, Shield } from 'lucide-react'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { getNonce, verifySignature } from '@/utils/siwe'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const code = searchParams.get('code')
  const { loginWithProvider, isAuthenticated, isLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [provider, setProvider] = useState<'google' | 'github' | 'ethereum' | null>(null)
  const isProcessingCallback = useRef(false)
  const hasSignedRef = useRef(false)
  
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(redirectTo || '/', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo])

  useEffect(() => {
    if (code && !isProcessingCallback.current) {
      const state = searchParams.get('state')
      let detectedProvider: 'google' | 'github' = 'google'
      
      if (state) {
        try {
          const stateData = JSON.parse(atob(state))
          if (stateData.provider) {
            detectedProvider = stateData.provider
          }
        } catch (e) {
          console.error('Failed to parse OAuth state:', e)
        }
      }
      
      setProvider(detectedProvider)
      if (detectedProvider === 'github') {
        handleGitHubCallback(code)
      } else {
        handleGoogleCallback(code)
      }
    }
  }, [code])

  const handleGoogleCallback = async (authCode: string) => {
    if (isProcessingCallback.current) return
    isProcessingCallback.current = true
    
    setLoading(true)
    setError('')
    
    try {
      const state = searchParams.get('state')
      let targetRedirect = redirectTo
      if (state) {
        try {
          const stateData = JSON.parse(atob(state))
          if (stateData.redirect) {
            targetRedirect = stateData.redirect
          }
        } catch (e) {
          console.error('Failed to parse OAuth state:', e)
        }
      }
      
      const redirectUri = `${window.location.origin}/login`
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/google/callback`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: redirectUri,
        }),
      })

      if (!response.ok) {
        throw new Error('Authentication failed')
      }

      const data = await response.json()
      await loginWithProvider(data.token, data.user)
      sessionStorage.setItem('justLoggedIn', 'true')
      navigate(targetRedirect || '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed. Please try again.')
      setLoading(false)
      isProcessingCallback.current = false
    }
  }

  const handleGitHubCallback = async (authCode: string) => {
    if (isProcessingCallback.current) return
    isProcessingCallback.current = true
    
    setLoading(true)
    setError('')
    
    try {
      const state = searchParams.get('state')
      let targetRedirect = redirectTo
      if (state) {
        try {
          const stateData = JSON.parse(atob(state))
          if (stateData.redirect) {
            targetRedirect = stateData.redirect
          }
        } catch (e) {
          console.error('Failed to parse OAuth state:', e)
        }
      }
      
      const redirectUri = `${window.location.origin}/login`
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/github/callback`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: redirectUri,
        }),
      })

      if (!response.ok) {
        throw new Error('Authentication failed')
      }

      const data = await response.json()
      await loginWithProvider(data.token, data.user)
      sessionStorage.setItem('justLoggedIn', 'true')
      navigate(targetRedirect || '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub login failed. Please try again.')
      setLoading(false)
      isProcessingCallback.current = false
    }
  }

  const handleGoogleSignIn = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    const redirectUri = `${window.location.origin}/login`
    const scope = 'openid email profile'
    const responseType = 'code'
    
    const stateData = {
      random: Math.random().toString(36).substring(7),
      redirect: redirectTo || null,
      provider: 'google'
    }
    const state = btoa(JSON.stringify(stateData))
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', responseType)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    window.location.href = authUrl.toString()
  }

  const handleGitHubSignIn = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
    const redirectUri = `${window.location.origin}/login`
    const scope = 'user:email'
    
    const stateData = {
      random: Math.random().toString(36).substring(7),
      redirect: redirectTo || null,
      provider: 'github'
    }
    const state = btoa(JSON.stringify(stateData))
    
    const authUrl = new URL('https://github.com/login/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('state', state)

    window.location.href = authUrl.toString()
  }

  const handleEthereumSignIn = async () => {
    if (!connectors[0]) {
      setError('No wallet connector available')
      return
    }

    setError('')
    setLoading(true)
    setProvider('ethereum')
    hasSignedRef.current = false
    connect({ connector: connectors[0] })
  }

  useEffect(() => {
    const performSigning = async () => {
      if (!isConnected || !address || provider !== 'ethereum' || hasSignedRef.current) {
        return
      }

      hasSignedRef.current = true
      setLoading(true)

      try {
        const { message } = await getNonce(address)
        const signature = await signMessageAsync({ message })
        const { token, user } = await verifySignature(message, signature)

        await loginWithProvider(token, user)
        disconnect()
        sessionStorage.setItem('justLoggedIn', 'true')
        navigate(redirectTo || '/')
      } catch (err) {
        console.error('Ethereum login error:', err)
        setError(err instanceof Error ? err.message : 'Ethereum login failed. Please try again.')
        disconnect()
        hasSignedRef.current = false
      } finally {
        setLoading(false)
        setProvider(null)
      }
    }

    performSigning()
  }, [isConnected, address, provider])

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-background via-background to-secondary/20 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-jsr-purple/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-jsr-purple-dark/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative z-10">
        <div className="max-w-lg space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-jsr-purple to-jsr-purple-dark rounded-xl flex items-center justify-center shadow-lg shadow-jsr-purple/50">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <span className="text-4xl font-bold jsr-text-gradient">
              multisigmonitor
            </span>
          </div>
          
          <h2 className="text-5xl font-bold text-foreground leading-tight">
            Welcome back
          </h2>
          
          <p className="text-xl text-muted-foreground leading-relaxed">
            Monitor and manage your Safe multisig wallets with real-time alerts and comprehensive security analysis.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-jsr-purple to-jsr-purple-dark rounded-xl flex items-center justify-center shadow-lg shadow-jsr-purple/50">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold jsr-text-gradient">
                multisigmonitor
              </span>
            </div>
          </div>

          <div className="backdrop-blur-sm bg-card border border-border rounded-xl shadow-2xl p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">Sign In</h1>
              <p className="text-muted-foreground text-sm mt-2">Continue with your account</p>
            </div>

            {error && !isAuthenticated && (
              <div className="mb-6 p-4 bg-destructive/20 border border-destructive/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || !import.meta.env.VITE_GOOGLE_CLIENT_ID}
                className="w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-3 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && provider === 'google' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGitHubSignIn}
                disabled={loading || !import.meta.env.VITE_GITHUB_CLIENT_ID}
                className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-3 border border-border disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && provider === 'github' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    <span>Continue with GitHub</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleEthereumSignIn}
                disabled={loading}
                className="w-full bg-jsr-purple/20 hover:bg-jsr-purple/30 text-jsr-purple-light hover:text-jsr-purple font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-3 border border-jsr-purple/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && provider === 'ethereum' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isConnected ? 'Signing in...' : 'Connecting wallet...'}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
                      <path fill="currentColor" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"/>
                      <path fill="currentColor" opacity="0.6" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
                      <path fill="currentColor" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z"/>
                      <path fill="currentColor" opacity="0.6" d="M127.962 416.905v-104.72L0 236.585z"/>
                      <path fill="currentColor" opacity="0.2" d="M127.961 287.958l127.96-75.637-127.96-58.162z"/>
                      <path fill="currentColor" opacity="0.6" d="M0 212.32l127.96 75.638v-133.8z"/>
                    </svg>
                    <span>Continue with Ethereum</span>
                  </>
                )}
              </button>
            </div>

            {(!import.meta.env.VITE_GOOGLE_CLIENT_ID || !import.meta.env.VITE_GITHUB_CLIENT_ID) && (
              <p className="mt-4 text-xs text-center text-muted-foreground">
                {!import.meta.env.VITE_GOOGLE_CLIENT_ID && !import.meta.env.VITE_GITHUB_CLIENT_ID
                  ? 'OAuth authentication not configured'
                  : !import.meta.env.VITE_GOOGLE_CLIENT_ID
                  ? 'Google authentication not configured'
                  : 'GitHub authentication not configured'}
              </p>
            )}
          </div>

          <div className="text-center">
            <Link to="/" className="text-muted-foreground hover:text-jsr-purple text-sm">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
