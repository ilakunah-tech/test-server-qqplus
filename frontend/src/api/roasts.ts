import apiClient from './client';
import { ApiResponse, ListResponse, Roast } from '@/types/api';

export const roastsApi = {
  getRoasts: async (
    limit = 100,
    offset = 0,
    dateFrom?: string,
    dateTo?: string
  ): Promise<ApiResponse<ListResponse<Roast>>> => {
    const response = await apiClient.get<ApiResponse<ListResponse<Roast>>>('/roasts', {
      params: { limit, offset, date_from: dateFrom, date_to: dateTo },
    });
    return response.data;
  },
  
  createRoast: async (data: Omit<Roast, 'id' | 'weight_loss_percent' | 'profile_file' | 'created_at'>): Promise<ApiResponse<Roast>> => {
    const response = await apiClient.post<ApiResponse<Roast>>('/roasts', data);
    return response.data;
  },
  
  getRoast: async (id: string): Promise<ApiResponse<Roast>> => {
    const response = await apiClient.get<ApiResponse<Roast>>(`/roasts/${id}`);
    return response.data;
  },
  
  uploadProfile: async (id: string, file: File): Promise<ApiResponse<{ profile_file: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ApiResponse<{ profile_file: string }>>(
      `/roasts/${id}/upload-profile`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
  
  downloadProfile: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/roasts/${id}/profile`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
