import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  ethereum_address?: string;
  google_id?: string;
  github_id?: string;
  created_at?: string;
  updated_at?: string;
}

function isValidUser(data: unknown): data is User {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.email === 'string' &&
    typeof d.username === 'string'
  );
}

type AuthContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  token: string | null;
  loginWithProvider: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (isValidUser(data)) {
            setUser(data);
          }
        } else if (response.status === 401) {
          const refreshed = await tryRefresh();
          if (refreshed) {
            const retryResponse = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
              credentials: 'include',
            });
            if (retryResponse.ok) {
              const data = await retryResponse.json();
              if (isValidUser(data)) {
                setUser(data);
              }
            }
          }
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const tryRefresh = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const loginWithProvider = async (jwtToken: string, userData: User) => {
    setToken(jwtToken);
    setUser(userData);
  };

  const signOut = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const value = {
    user,
    setUser,
    token,
    loginWithProvider,
    signOut,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
