import apiClient from './client';
import { ApiResponse, LoginRequest, TokenResponse } from '@/types/api';

export const authApi = {
  login: async (data: LoginRequest): Promise<ApiResponse<TokenResponse>> => {
    const response = await apiClient.post<ApiResponse<TokenResponse>>('/auth/login', data);
    return response.data;
  },
  
  register: async (email: string, password: string, passwordConfirm: string): Promise<ApiResponse<TokenResponse>> => {
    const response = await apiClient.post<ApiResponse<TokenResponse>>('/auth/register', {
      email,
      password,
      password_confirm: passwordConfirm,
    });
    return response.data;
  },
  
  refresh: async (): Promise<ApiResponse<{ token: string }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string }>>('/auth/refresh');
    return response.data;
  },
};
