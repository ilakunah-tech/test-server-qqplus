import { useEffect, useRef, useState } from 'react';
import { WS_URL } from '@/utils/constants';
import { authStore } from '@/store/authStore';
import { settingsStore } from '@/store/settingsStore';
import { notificationStore } from '@/store/notificationStore';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const token = authStore((state) => state.token);
  const wsNotifications = settingsStore((state) => state.wsNotifications);

  useEffect(() => {
    if (!token || !wsNotifications) {
      setIsConnected(false);
      return;
    }

    const connect = () => {
      try {
        const ws = new WebSocket(`${WS_URL}/notifications?token=${token}`);
        
        ws.onopen = () => {
          setIsConnected(true);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'notification') {
              notificationStore.getState().addNotification({
                id: `${Date.now()}-${Math.random()}`,
                ...message,
              });
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token, wsNotifications]);

  return { isConnected };
};
