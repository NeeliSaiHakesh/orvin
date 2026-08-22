"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrainCircuit, Mail, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.auth.login({ email, password });
      const token = res.access_token || 'demo-token';
      login(token, { id: 'user-1', name: email.split('@')[0], email });
      router.push('/dashboard');
    } catch {
      // Fallback for seamless demo mode
      login('demo-session-token', { id: 'user-demo', name: email.split('@')[0] || 'Demo User', email: email || 'user@automlops.ai' });
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md z-10 p-4">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold font-heading mb-2">
            <BrainCircuit className="text-cyan-400 w-8 h-8" />
            <span className="gradient-text">AutoMLOps</span>
          </Link>
          <p className="text-gray-400">Welcome back! Please login to your account.</p>
        </div>

        {error && (
          <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400 mb-4 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Card glow className="animate-slide-up">
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input 
                label="Email Address" 
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-5 h-5" />}
                required
              />
              <Input 
                label="Password" 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-5 h-5" />}
                required
              />
              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center gap-2 text-gray-300">
                  <input type="checkbox" defaultChecked className="rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500/50" />
                  Remember me
                </label>
                <span className="text-xs text-gray-400">Default: any credentials</span>
              </div>
              <Button type="submit" className="w-full" isLoading={loading}>
                Sign In
              </Button>
            </form>
            
            <div className="mt-6 text-center text-sm text-gray-400">
              Don&apos;t have an account? <Link href="/auth/register" className="text-cyan-400 hover:text-cyan-300 font-medium">Register here</Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}