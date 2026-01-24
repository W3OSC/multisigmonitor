import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithProvider } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      navigate('/');
      return;
    }

    let provider: 'google' | 'github' = 'google';
    
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        if (stateData.provider) {
          provider = stateData.provider;
        }
      } catch (e) {
        console.error('Failed to parse OAuth state:', e);
      }
    }

    const handleCallback = async () => {
      try {
        const endpoint = provider === 'github' 
          ? '/auth/github/callback' 
          : '/auth/google/callback';

        const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error(`${provider} login failed`);
        }

        const data = await response.json();
        await loginWithProvider(data.token, data.user);
        navigate('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, loginWithProvider]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p>Completing sign in...</p>
      </div>
    </div>
  );
}
