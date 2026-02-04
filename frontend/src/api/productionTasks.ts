import apiClient from './client';
import { ApiResponse, ListResponse } from '@/types/api';

export interface ProductionTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  notification_text: string;
  task_type: 'schedule' | 'counter' | 'one_time';
  schedule_day_of_week?: number; // 0-6 (Monday=0, Sunday=6)
  schedule_time?: string; // HH:MM:SS
  counter_trigger_value?: number;
  counter_current_value: number;
  counter_reset_on_trigger: boolean;
  machine_id?: string;
  machine_name?: string;
  scheduled_date?: string; // YYYY-MM-DD
  scheduled_time?: string; // HH:MM:SS
  repeat_after_days?: number;
  is_active: boolean;
  last_triggered_at?: string;
  last_triggered_roast_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProductionTaskHistory {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  notification_text: string;
  task_type: 'schedule' | 'counter' | 'one_time';
  machine_id?: string;
  machine_name?: string;
  triggered_at: string;
  triggered_by_roast_id?: string;
  trigger_reason?: string;
  marked_completed_at?: string;
  marked_completed_by_user_id?: string;
  snoozed_until?: string;
  snoozed_by_user_id?: string;
  created_at: string;
}

export interface ProductionTaskCreateInput {
  title: string;
  description?: string;
  notification_text: string;
  task_type: 'schedule' | 'counter' | 'one_time';
  schedule_day_of_week?: number;
  schedule_time?: string; // HH:MM
  counter_trigger_value?: number;
  counter_reset_on_trigger?: boolean;
  machine_id?: string;
  scheduled_date?: string; // YYYY-MM-DD
  scheduled_time?: string; // HH:MM
  repeat_after_days?: number;
  is_active?: boolean;
}

export interface ProductionTaskUpdateInput {
  title?: string;
  description?: string;
  notification_text?: string;
  is_active?: boolean;
  schedule_day_of_week?: number;
  schedule_time?: string;
  counter_trigger_value?: number;
  counter_reset_on_trigger?: boolean;
  machine_id?: string;
  counter_current_value?: number;
  scheduled_date?: string;
  scheduled_time?: string;
  repeat_after_days?: number;
}

export interface ProductionTaskSnoozeInput {
  snooze_until: string; // ISO datetime
}

export const productionTasksApi = {
  getTasks: async (
    taskType?: 'schedule' | 'counter' | 'one_time',
    isActive?: boolean,
    machineId?: string,
    limit = 1000,
    offset = 0
  ): Promise<ApiResponse<ListResponse<ProductionTask>>> => {
    const response = await apiClient.get<ApiResponse<ListResponse<ProductionTask>>>(
      '/production-tasks',
      {
        params: { task_type: taskType, is_active: isActive, machine_id: machineId, limit, offset },
      }
    );
    return response.data;
  },

  getTask: async (id: string): Promise<ApiResponse<ProductionTask>> => {
    const response = await apiClient.get<ApiResponse<ProductionTask>>(`/production-tasks/${id}`);
    return response.data;
  },

  createTask: async (data: ProductionTaskCreateInput): Promise<ApiResponse<ProductionTask>> => {
    const response = await apiClient.post<ApiResponse<ProductionTask>>('/production-tasks', data);
    return response.data;
  },

  updateTask: async (
    id: string,
    data: ProductionTaskUpdateInput
  ): Promise<ApiResponse<ProductionTask>> => {
    const response = await apiClient.put<ApiResponse<ProductionTask>>(`/production-tasks/${id}`, data);
    return response.data;
  },

  deleteTask: async (id: string): Promise<void> => {
    await apiClient.delete(`/production-tasks/${id}`);
  },

  getHistory: async (
    taskId?: string,
    machineId?: string,
    completedOnly?: boolean,
    limit = 1000,
    offset = 0
  ): Promise<ApiResponse<ListResponse<ProductionTaskHistory>>> => {
    const response = await apiClient.get<ApiResponse<ListResponse<ProductionTaskHistory>>>(
      '/production-tasks/history/list',
      {
        params: { task_id: taskId, machine_id: machineId, completed_only: completedOnly, limit, offset },
      }
    );
    return response.data;
  },

  markCompleted: async (historyId: string): Promise<ApiResponse<ProductionTaskHistory>> => {
    const response = await apiClient.post<ApiResponse<ProductionTaskHistory>>(
      `/production-tasks/history/${historyId}/complete`
    );
    return response.data;
  },

  snoozeTask: async (
    historyId: string,
    data: ProductionTaskSnoozeInput
  ): Promise<ApiResponse<ProductionTaskHistory>> => {
    const response = await apiClient.post<ApiResponse<ProductionTaskHistory>>(
      `/production-tasks/history/${historyId}/snooze`,
      data
    );
    return response.data;
  },
};
