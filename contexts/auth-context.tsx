'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import RegistryAPI from '@/lib/registry-api';

interface AuthContextType {
  isAuthenticated: boolean;
  registryApi: RegistryAPI | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [registryApi, setRegistryApi] = useState<RegistryAPI | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const api = new RegistryAPI(username, password);
      
      const isConnected = await api.testConnection();
      if (isConnected) {
        setRegistryApi(api);
        setIsAuthenticated(true);
        localStorage.setItem('registry_auth', JSON.stringify({ username, password }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setRegistryApi(null);
    localStorage.removeItem('registry_auth');
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem('registry_auth');
    if (savedAuth) {
      const { username, password } = JSON.parse(savedAuth);
      login(username, password).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, registryApi, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}