"use client";
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Menu, Bell, LogOut, 
  CheckCircle2, Cpu, Database, Bot, Sparkles, Trash2,
  Plus, FolderGit2
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
  const { user, logout } = useAuthStore();
  const router = useRouter();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'Orvin Gate Active',
      message: 'Hindsight Memory pre-flight CI/CD gate loaded with 3 enterprise post-mortems.',
      time: 'Just now',
      read: false,
      type: 'system'
    },
    {
      id: '2',
      title: 'AutoML Training Completed',
      message: '8 algorithms trained & ranked. Best model: RandomForest (85.7% accuracy).',
      time: '2m ago',
      read: false,
      type: 'training'
    },
    {
      id: '3',
      title: 'Dataset Ingestion & Cleaning',
      message: 'sample_customer_churn.csv processed. Outlier capping & encoding applied.',
      time: '5m ago',
      read: true,
      type: 'dataset'
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
        return <Cpu className="w-4 h-4 text-emerald-700" />;
      case 'assistant':
        return <Bot className="w-4 h-4 text-purple-700" />;
      case 'dataset':
        return <Database className="w-4 h-4 text-blue-700" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-700" />;
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-[#FFFFFF] border-b border-[#D6CEBE] px-4 h-16 flex items-center justify-between text-[#0F172A] shadow-xs">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-[#EFEAE1] rounded-xl text-[#334155] hover:text-[#0F172A] transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="text-xl font-bold font-heading flex items-center gap-2">
          {/* Logo icon removed per user request */}
          <span className="font-extrabold text-[#0f172a] tracking-tight text-lg">
            Orvin <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">AI Gate</span>
          </span>
        </Link>
        <Link 
          href="/dashboard" 
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#475569] hover:text-[#0f172a] hover:bg-[#EFEBE0] transition-colors"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-[#0f172a]" />
          <span>Projects</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/projects/new">
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold shadow-sm transition-all">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Project</span>
          </button>
        </Link>

        {/* Notifications Button & Dropdown */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-[#EFEBE0] rounded-lg text-[#475569] hover:text-[#0f172a] transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600 text-[9px] text-white items-center justify-center font-bold"></span>
              </span>
            )}
          </button>

          {/* Light Cream High-Contrast Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#FFFDF9] border border-[#E2DCD0] shadow-xl z-50 animate-slide-up overflow-hidden text-[#0f172a]">
              <div className="p-4 border-b border-[#E2DCD0] flex items-center justify-between bg-[#FAF7F0]">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#0f172a]" />
                  <span className="font-bold text-sm text-[#0f172a]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-semibold border border-[#FDE68A]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead} 
                      className="text-amber-800 hover:text-amber-900 font-bold transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button 
                      onClick={clearNotifications}
                      className="text-[#64748b] hover:text-red-600 transition-colors p-1"
                      title="Clear all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#E2DCD0] bg-[#FFFDF9]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-[#64748b] text-sm">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#94a3b8]" />
                    No new notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`p-4 transition-colors flex gap-3 ${
                        notif.read ? 'bg-[#FFFDF9] hover:bg-[#FAF7F0]' : 'bg-[#FEF3C7]/30 hover:bg-[#FEF3C7]/50'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-[#FAF7F0] border border-[#E2DCD0] h-fit shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="text-xs font-bold text-[#0f172a] truncate">{notif.title}</h4>
                          <span className="text-[10px] text-[#64748b] shrink-0 font-mono">{notif.time}</span>
                        </div>
                        <p className="text-xs text-[#334155] leading-relaxed font-normal">{notif.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* User Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-[#E2DCD0]">
          <div suppressHydrationWarning className="w-8 h-8 rounded-full bg-[#0F172A] flex items-center justify-center text-sm font-bold text-white shadow-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span suppressHydrationWarning className="text-sm font-semibold hidden sm:inline-block text-[#0f172a]">
            {user?.name || 'User'}
          </span>
          <button onClick={handleLogout} className="p-2 hover:bg-[#EFEBE0] rounded-lg text-[#475569] hover:text-[#0f172a] transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}