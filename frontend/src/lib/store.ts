import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  _hydrated: boolean;
  hydrate: () => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
}

interface UIState {
  sidebarOpen: boolean;
  loading: boolean;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
}

// Auth store — starts with null to match SSR, hydrates from localStorage on client
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  _hydrated: false,
  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    let user: User | null = null;
    try {
      const stored = localStorage.getItem('user');
      if (stored) user = JSON.parse(stored);
    } catch { /* ignore */ }
    set({ token, user, isAuthenticated: !!token, _hydrated: true });
  },
  login: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    set({ token: null, user: null, isAuthenticated: false });
  },
  setUser: (user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user });
  },
}));

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
}));

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  loading: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setLoading: (loading) => set({ loading }),
}));