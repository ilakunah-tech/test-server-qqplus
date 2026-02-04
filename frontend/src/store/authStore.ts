import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@/types/api';

interface AuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
  username: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (token: string, userId: string, email?: string, role?: UserRole, username?: string) => void;
  setUser: (email: string, role: UserRole, username?: string) => void;
  setEmail: (email: string) => void;
  logout: () => void;
}

export const authStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      email: null,
      username: null,
      role: null,
      isAuthenticated: false,
      login: (token: string, userId: string, email?: string, role?: UserRole, username?: string) => {
        set({
          token,
          userId,
          email: email ?? null,
          username: username ?? null,
          role: role ?? 'user',
          isAuthenticated: true,
        });
      },
      setUser: (email: string, role: UserRole, username?: string) => set({ email, role, username: username ?? null }),
      setEmail: (email: string) => set({ email }),
      logout: () => {
        set({ token: null, userId: null, email: null, username: null, role: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
