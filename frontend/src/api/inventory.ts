import apiClient from './client';
import { ApiResponse, ListResponse, Coffee, Batch } from '@/types/api';

export const inventoryApi = {
  getCoffees: async (limit = 1000, offset = 0): Promise<ApiResponse<ListResponse<Coffee>>> => {
    const response = await apiClient.get<ApiResponse<ListResponse<Coffee>>>('/inventory/coffees', {
      params: { limit, offset },
    });
    return response.data;
  },
  
  createCoffee: async (data: Omit<Coffee, 'id' | 'hr_id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Coffee>> => {
    const response = await apiClient.post<ApiResponse<Coffee>>('/inventory/coffees', data);
    return response.data;
  },
  
  getCoffee: async (id: string): Promise<ApiResponse<Coffee>> => {
    const response = await apiClient.get<ApiResponse<Coffee>>(`/inventory/coffees/${id}`);
    return response.data;
  },
  
  getBatches: async (coffeeId?: string, limit = 100, offset = 0): Promise<ApiResponse<ListResponse<Batch>>> => {
    const response = await apiClient.get<ApiResponse<ListResponse<Batch>>>('/inventory/batches', {
      params: { coffee_id: coffeeId, limit, offset },
    });
    return response.data;
  },
  
  createBatch: async (data: Omit<Batch, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Batch>> => {
    const response = await apiClient.post<ApiResponse<Batch>>('/inventory/batches', data);
    return response.data;
  },
  
  updateBatch: async (id: string, data: Partial<Batch>): Promise<ApiResponse<Batch>> => {
    const response = await apiClient.put<ApiResponse<Batch>>(`/inventory/batches/${id}`, data);
    return response.data;
  },
};
