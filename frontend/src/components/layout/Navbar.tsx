"use client";
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  BrainCircuit, Menu, Bell, User, LogOut, 
  CheckCircle2, Cpu, Database, Bot, Sparkles, X, Trash2
} from 'lucide-react';
import { useAuthStore, useUIStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'training' | 'dataset' | 'assistant' | 'system';
}

export function Navbar() {
  const { toggleSidebar } = useUIStore();
  const { user, logout, hydrate } = useAuthStore();
  const router = useRouter();

  useEffect(() => { hydrate(); }, [hydrate]);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'AutoML Training Completed',
      message: '8 algorithms trained & ranked. Best model: RandomForest (85.7% accuracy).',
      time: 'Just now',
      read: false,
      type: 'training'
    },
    {
      id: '2',
      title: 'AI MLOps Assistant Online',
      message: 'Grounding pipeline initialized with real project metrics & SHAP values.',
      time: '2m ago',
      read: false,
      type: 'assistant'
    },
    {
      id: '3',
      title: 'Dataset Ingestion & Cleaning',
      message: 'sample_customer_churn.csv processed. Outlier capping & encoding applied.',
      time: '5m ago',
      read: true,
      type: 'dataset'
    },
    {
      id: '4',
      title: 'FastAPI Microservice Ready',
      message: 'REST API, Swagger docs & Dockerfile packaged for one-click export.',
      time: '10m ago',
      read: true,
      type: 'system'
    }
  ]);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const getNotifIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'training':
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'assistant':
        return <Bot className="w-4 h-4 text-purple-400" />;
      case 'dataset':
        return <Database className="w-4 h-4 text-cyan-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-[#0a0f1d]/95 backdrop-blur-md border-b border-white/10 px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="text-xl font-bold font-heading flex items-center gap-2">
          <BrainCircuit className="text-cyan-400" />
          <span className="gradient-text hidden sm:inline-block">AutoMLOps</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Button & Dropdown */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500 text-[9px] text-white items-center justify-center font-bold"></span>
              </span>
            )}
          </button>

          {/* Solid High-Contrast Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0e1628] border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-50 animate-slide-up overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#080d19]">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-sm text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 text-xs font-semibold border border-purple-500/40">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead} 
                      className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button 
                      onClick={clearNotifications}
                      className="text-gray-400 hover:text-red-400 transition-colors p-1"
                      title="Clear all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-white/10 bg-[#0e1628]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                    No new notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`p-4 transition-colors flex gap-3 ${
                        notif.read ? 'bg-[#0e1628] hover:bg-[#152038]' : 'bg-[#1a233d] hover:bg-[#202c4b]'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-[#080d19] border border-white/10 h-fit shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="text-xs font-bold text-white truncate">{notif.title}</h4>
                          <span className="text-[10px] text-gray-400 shrink-0 font-mono">{notif.time}</span>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-normal">{notif.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* User Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="text-sm font-medium hidden sm:inline-block text-gray-200">{user?.name || 'User'}</span>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}