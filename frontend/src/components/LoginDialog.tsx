import { useState, useEffect, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Github, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { getNonce, verifySignature } from "@/utils/siwe";

type LoginDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LoginDialog({ isOpen, onClose }: LoginDialogProps) {
  const { loginWithProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<'google' | 'github' | 'ethereum' | null>(null);
  const hasSignedRef = useRef(false);
  
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const handleGoogleSignIn = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/`;
    const scope = 'openid email profile';
    const responseType = 'code';
    
    const state = btoa(JSON.stringify({
      random: Math.random().toString(36).substring(7),
      provider: 'google'
    }));
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', responseType);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);

    window.location.href = authUrl.toString();
  };

  const handleGitHubSignIn = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = `${window.location.origin}/`;
    
    const state = btoa(JSON.stringify({
      random: Math.random().toString(36).substring(7),
      provider: 'github'
    }));
    
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'read:user user:email');
    authUrl.searchParams.set('state', state);

    window.location.href = authUrl.toString();
  };

  const handleEthereumSignIn = async () => {
    if (!connectors[0]) {
      setError('No wallet connector available');
      return;
    }

    setError('');
    setLoading(true);
    setProvider('ethereum');
    hasSignedRef.current = false;
    connect({ connector: connectors[0] });
  };

  useEffect(() => {
    const performSigning = async () => {
      if (!isConnected || !address || provider !== 'ethereum' || hasSignedRef.current) {
        return;
      }

      hasSignedRef.current = true;
      setLoading(true);

      try {
        const { message } = await getNonce(address);
        const signature = await signMessageAsync({ message });
        const { token, user } = await verifySignature(message, signature, address);

        await loginWithProvider(token, user);
        disconnect();
        onClose();
      } catch (err) {
        console.error('Ethereum login error:', err);
        setError(err instanceof Error ? err.message : 'Ethereum login failed. Please try again.');
        disconnect();
        hasSignedRef.current = false;
      } finally {
        setLoading(false);
        setProvider(null);
      }
    };

    performSigning();
  }, [isConnected, address, provider, signMessageAsync, disconnect, loginWithProvider, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to Multisig Monitor</DialogTitle>
          <DialogDescription>
            Choose your preferred authentication method
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={loading || !import.meta.env.VITE_GOOGLE_CLIENT_ID}
            className="flex items-center justify-center gap-2"
          >
            {loading && provider === 'google' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                  <path d="M1 1h22v22H1z" fill="none" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handleGitHubSignIn}
            disabled={loading || !import.meta.env.VITE_GITHUB_CLIENT_ID}
            className="flex items-center justify-center gap-2"
          >
            {loading && provider === 'github' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <Github className="h-4 w-4" />
                <span>Continue with GitHub</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handleEthereumSignIn}
            disabled={loading}
            className="flex items-center justify-center gap-2"
          >
            {loading && provider === 'ethereum' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isConnected ? 'Signing in...' : 'Connecting wallet...'}</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
                  <path fill="currentColor" d="M127.96 0l-2.796 9.5v275.668l2.795 2.79 127.962-75.638z"/>
                  <path fill="currentColor" opacity="0.6" d="M127.96 0L0 212.32l127.96 75.638V154.158z"/>
                  <path fill="currentColor" d="M127.96 312.19l-1.575 1.92v98.198l1.575 4.6L256 236.587z"/>
                  <path fill="currentColor" opacity="0.6" d="M127.96 416.905v-104.714L0 236.585z"/>
                  <path fill="currentColor" opacity="0.2" d="M127.96 287.96l127.96-75.637-127.96-58.163z"/>
                  <path fill="currentColor" opacity="0.6" d="M0 212.32l127.96 75.638v-133.8z"/>
                </svg>
                <span>Continue with Ethereum</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
