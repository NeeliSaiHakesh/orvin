"use client";
import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { BrainCircuit, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('demo@automlops.ai');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLogin = useCallback(async (overrideEmail?: string, overridePassword?: string) => {
    const finalEmail = (overrideEmail || email || 'demo@automlops.ai').trim();
    const finalPassword = (overridePassword || password || 'password123').trim();

    setLoading(true);
    setError(null);

    // Save user to localStorage immediately (works regardless of API)
    const userName = finalEmail.split('@')[0] || 'Engineer';
    const userObj = { id: 'user-1', name: userName, email: finalEmail };

    try {
      // Try real API login with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, password: finalPassword }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
      } else {
        // API returned error - use demo token
        localStorage.setItem('token', 'demo-session-token');
      }
    } catch {
      // Network error or timeout - use demo token
      localStorage.setItem('token', 'demo-session-token');
    }

    // Always save user and redirect
    localStorage.setItem('user', JSON.stringify(userObj));

    // Hard redirect - guaranteed to work
    window.location.href = '/dashboard';
  }, [email, password]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin();
  };

  const handleSignInClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    doLogin();
  };

  const handleDemoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    doLogin('demo@automlops.ai', 'password123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#0a0a1a' }}>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 p-4">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold font-heading mb-2">
            <BrainCircuit className="text-cyan-400 w-8 h-8" />
            <span className="gradient-text">AutoMLOps</span>
          </Link>
          <p className="text-gray-400">Welcome back! Sign in to your workspace.</p>
        </div>

        {error && (
          <div className="glass border-red-500/30 bg-red-500/10 p-4 rounded-xl text-red-400 mb-4 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="glass animate-slide-up" style={{ boxShadow: '0 0 30px rgba(139, 92, 246, 0.15)' }}>
          <div className="p-6">
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Email Address</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    placeholder="demo@automlops.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 pl-10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="w-full flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 pl-10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500/50" />
                  Remember me
                </label>
                <span className="text-xs text-cyan-400 font-medium">Demo mode enabled</span>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  onClick={handleSignInClick}
                  className="w-full inline-flex items-center justify-center rounded-lg font-semibold text-base py-3 text-white transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0a0a1a]"
                  style={{
                    background: 'linear-gradient(to right, #7C3AED, #06B6D4)',
                    boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDemoClick}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-cyan-500/30 text-cyan-300 text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  ⚡ Instant Demo Access
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="text-cyan-400 hover:text-cyan-300 font-medium">
                Register here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}