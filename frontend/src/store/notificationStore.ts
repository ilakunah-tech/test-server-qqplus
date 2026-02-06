import { create } from 'zustand';

export interface Notification {
  id: string;
  type: string;
  event_type: string;
  payload: any;
  timestamp: string;
}

export interface ProductionTaskNotification {
  task_id: string;
  history_id: string;
  title: string;
  notification_text: string;
  task_type: 'schedule' | 'counter' | 'one_time';
  machine_id?: string;
  machine_name?: string;
  triggered_at: string;
  trigger_reason?: string;
  is_reminder?: boolean;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
}

// Request permission for desktop notifications
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

export const notificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification: Notification) => {
    set((state) => {
      const newNotifications = [notification, ...state.notifications].slice(0, 50);
      
      // Show desktop notification for production_task events
      if (notification.event_type === 'production_task' && 'Notification' in window) {
        const payload = notification.payload as ProductionTaskNotification;
        if (Notification.permission === 'granted') {
          const machineText = payload.machine_name ? ` (${payload.machine_name})` : '';
          const reminderPrefix = payload.is_reminder ? '🔔 Напоминание: ' : '';
          new Notification(reminderPrefix + payload.title, {
            body: payload.notification_text + machineText,
            icon: '/vite.svg',
            tag: `${payload.history_id}-${Date.now()}`, // Unique tag so reminders always show
            requireInteraction: false,
          });
        }
      }
      
      return { notifications: newNotifications };
    });
  },
  clearNotifications: () => {
    set({ notifications: [] });
  },
}));
