import { create } from 'zustand';

export interface Notification {
  id: string;
  type: string;
  event_type: string;
  payload: any;
  timestamp: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
}

export const notificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50), // Keep last 50
    }));
  },
  clearNotifications: () => {
    set({ notifications: [] });
  },
}));
