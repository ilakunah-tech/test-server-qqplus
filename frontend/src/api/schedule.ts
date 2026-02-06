import apiClient from './client';
import { ApiResponse, ListResponse, Schedule } from '@/types/api';

export interface ScheduleCreateInput {
  title: string;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_weight_kg?: number;
  coffee_id?: string;
  batch_id?: string;
  machine_id?: string;
  notes?: string;
}

export interface ScheduleBulkItemInput {
  title: string;
  scheduled_weight_kg?: number;
  coffee_id?: string;
  batch_id?: string;
  roast_target?: string; // filter, omni, espresso
  notes?: string;
}

export interface ScheduleBulkCreateInput {
  scheduled_date: string; // YYYY-MM-DD
  machine_id?: string;
  items: ScheduleBulkItemInput[];
}

export const scheduleApi = {
  getSchedule: async (
    dateFrom?: string,
    dateTo?: string,
    coffeeId?: string,
    machineId?: string,
    limit = 1000,
    offset = 0
  ): Promise<ApiResponse<ListResponse<Schedule>>> => {
    const response = await apiClient.get<ApiResponse<ListResponse<Schedule>>>('/schedule', {
      params: { date_from: dateFrom, date_to: dateTo, coffee_id: coffeeId, machine_id: machineId, limit, offset },
    });
    return response.data;
  },

  createScheduleBulk: async (
    data: ScheduleBulkCreateInput
  ): Promise<ApiResponse<{ items: Schedule[]; total: number }>> => {
    const response = await apiClient.post<ApiResponse<{ items: Schedule[]; total: number }>>(
      '/schedule/bulk',
      data
    );
    return response.data;
  },

  createSchedule: async (data: ScheduleCreateInput): Promise<ApiResponse<Schedule>> => {
    const response = await apiClient.post<ApiResponse<Schedule>>('/schedule', data);
    return response.data;
  },

  updateSchedule: async (id: string, data: Partial<Schedule>): Promise<ApiResponse<Schedule>> => {
    const response = await apiClient.put<ApiResponse<Schedule>>(`/schedule/${id}`, data);
    return response.data;
  },

  completeSchedule: async (
    id: string,
    data: { roast_id: string; roasted_weight_kg?: number; notes?: string }
  ): Promise<ApiResponse<Schedule>> => {
    const response = await apiClient.put<ApiResponse<Schedule>>(`/schedule/${id}/complete`, data);
    return response.data;
  },

  deleteSchedule: async (id: string): Promise<void> => {
    await apiClient.delete(`/schedule/${id}`);
  },
};
