import apiClient from './client';
import { ApiResponse, ListResponse } from '@/types/api';

export interface RecipeComponent {
  coffee_id: string;
  coffee_name?: string;
  percentage: number;
}

export interface Blend {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  recipe: RecipeComponent[];
  available_weight_kg?: number;
  created_at: string;
  updated_at: string;
}

export interface BlendCreate {
  name: string;
  description?: string;
  recipe: { coffee_id: string; percentage: number }[];
}

export interface BlendUpdate {
  name?: string;
  description?: string;
  recipe?: { coffee_id: string; percentage: number }[];
}

export const getBlends = async (limit = 100, offset = 0) => {
  const response = await apiClient.get<ApiResponse<ListResponse<Blend>>>(
    '/blends',
    { params: { limit, offset } }
  );
  return response.data.data;
};

export const createBlend = async (data: BlendCreate) => {
  const response = await apiClient.post<ApiResponse<Blend>>('/blends', data);
  return response.data.data;
};

export const getBlend = async (id: string) => {
  const response = await apiClient.get<ApiResponse<Blend>>(`/blends/${id}`);
  return response.data.data;
};

export const updateBlend = async (id: string, data: BlendUpdate) => {
  const response = await apiClient.put<ApiResponse<Blend>>(`/blends/${id}`, data);
  return response.data.data;
};

export const deleteBlend = async (id: string) => {
  await apiClient.delete(`/blends/${id}`);
};
