'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Container, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (!success) {
        setError('Invalid credentials or unable to connect to registry');
      }
    } catch {
      setError('Connection failed. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
      
      {/* Jika ingin latar tambahan, pastikan SVG data URL-nya valid */}
      {/* <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-20" /> */}

      <Card className="w-full max-w-md relative backdrop-blur-xl bg-slate-900/80 border-slate-700/50 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Container className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-white mb-2">NEXT Registry UI</CardTitle>
          <CardDescription className="text-slate-400 text-base">
            Sign in to manage your private Docker registry
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300 font-medium">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500 h-12 focus:border-blue-500/50 focus:ring-blue-500/20"
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800/50 border-slate-600/50 text-white placeholder:text-slate-500 h-12 focus:border-blue-500/50 focus:ring-blue-500/20"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <Alert className="border-red-500/50 bg-red-500/10 backdrop-blur-sm">
                <Shield className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-700/50">
            <div className="text-center text-sm text-slate-500">
              <p className="flex items-center justify-center space-x-2">
                <span>Registry:</span>
                <code className="bg-slate-800/50 px-2 py-1 rounded text-slate-400 font-mono text-xs">
                  {process.env.NEXT_PUBLIC_REGISTRY_HOST || 'registry.mastomi.cloud'}
                </code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}