import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7111/api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')
      
      if (!token) {
        setStatus('error')
        setMessage('Invalid verification link')
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/email/verify?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          credentials: 'include',
        })

        const data = await response.json()

        if (data.success) {
          setStatus('success')
          setMessage(data.message)
        } else {
          setStatus('error')
          setMessage(data.message || 'Verification failed')
        }
      } catch (error) {
        setStatus('error')
        setMessage('An error occurred during verification')
      }
    }

    verifyEmail()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-8">
      <Helmet>
        <title>Verify Email - Multisig Monitor</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 text-jsr-purple animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
          </div>
          <CardTitle>
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'success' && (
            <Button 
              className="w-full" 
              onClick={() => navigate('/alerts')}
            >
              Go to Alerts Settings
            </Button>
          )}
          {status === 'error' && (
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => navigate('/alerts')}
            >
              Back to Alerts
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
