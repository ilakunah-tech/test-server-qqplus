import { useEffect, useState, useRef } from 'react';
import { notificationStore, ProductionTaskNotification } from '@/store/notificationStore';
import { productionTasksApi } from '@/api/productionTasks';
import { Bell, X, Check, RefreshCw } from 'lucide-react';

/** In-app toast for production task notifications (works without desktop notification permission) */
export const NotificationToast = () => {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ProductionTaskNotification | null>(null);
  const [completing, setCompleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = notificationStore.subscribe(() => {
      const notifications = notificationStore.getState().notifications;
      const prodTask = notifications.find(
        (n) => n.event_type === 'production_task' && n.id !== lastSeenRef.current
      );
      if (prodTask) {
        lastSeenRef.current = prodTask.id;
        const payload = prodTask.payload as ProductionTaskNotification;
        setCurrent(payload);
        setVisible(true);
        setCompleting(false);

        // Auto-hide after 15 seconds (longer for reminders)
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setVisible(false);
          setCurrent(null);
          timeoutRef.current = null;
        }, payload.is_reminder ? 20000 : 10000);
      }
    });
    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setCurrent(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleMarkCompleted = async () => {
    if (!current?.history_id || completing) return;
    setCompleting(true);
    try {
      await productionTasksApi.markCompleted(current.history_id);
      handleClose();
    } catch (err) {
      console.error('Failed to mark completed:', err);
      setCompleting(false);
    }
  };

  if (!visible || !current) return null;

  const machineText = current.machine_name ? ` (${current.machine_name})` : '';
  const isReminder = current.is_reminder;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] animate-fade-in max-w-sm"
      role="alert"
      aria-live="polite"
    >
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/90 shadow-lg shadow-amber-900/20 p-4 flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          {isReminder ? (
            <RefreshCw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {isReminder && (
            <span className="inline-block text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-800/40 rounded px-1.5 py-0.5 mb-1">
              Напоминание
            </span>
          )}
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{current.title}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {current.notification_text}
            {machineText}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleMarkCompleted}
              disabled={completing}
              className="inline-flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {completing ? 'Сохранение...' : 'Выполнено'}
            </button>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 text-gray-500"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
