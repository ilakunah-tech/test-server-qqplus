import apiClient from './client';
import { ApiResponse, LoginRequest, TokenResponse } from '@/types/api';
import type { User, UserRole } from '@/types/api';

export const authApi = {
  getMe: async (): Promise<ApiResponse<User>> => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },

  getUsers: async (): Promise<ApiResponse<User[]>> => {
    const response = await apiClient.get<ApiResponse<User[]>>('/auth/users');
    return response.data;
  },

  createUser: async (
    username: string,
    email: string,
    password: string,
    role: UserRole = 'user'
  ): Promise<ApiResponse<User>> => {
    const response = await apiClient.post<ApiResponse<User>>('/auth/users', {
      username: username.trim(),
      email,
      password,
      role,
      is_active: true,
    });
    return response.data;
  },

  updateUserRole: async (userId: string, role: UserRole): Promise<ApiResponse<User>> => {
    const response = await apiClient.patch<ApiResponse<User>>(`/auth/users/${userId}/role`, {
      role,
    });
    return response.data;
  },

  updateUser: async (
    userId: string,
    data: { username?: string; email?: string; password?: string; role?: UserRole }
  ): Promise<ApiResponse<User>> => {
    const body: Record<string, string> = {};
    if (data.username !== undefined) body.username = data.username.trim();
    if (data.email !== undefined) body.email = data.email;
    if (data.password !== undefined && data.password !== '') body.password = data.password;
    if (data.role !== undefined) body.role = data.role;
    const response = await apiClient.patch<ApiResponse<User>>(`/auth/users/${userId}`, body);
    return response.data;
  },

  deleteUser: async (userId: string): Promise<ApiResponse<{ message: string; id: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string; id: string }>>(
      `/auth/users/${userId}`
    );
    return response.data;
  },

  login: async (data: LoginRequest): Promise<ApiResponse<TokenResponse & { email?: string; role?: UserRole }>> => {
    const response = await apiClient.post<ApiResponse<TokenResponse>>('/auth/login', data);
    return response.data;
  },

  changePassword: async (
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.patch<ApiResponse<{ message: string }>>('/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  refresh: async (): Promise<ApiResponse<{ token: string }>> => {
    const response = await apiClient.post<ApiResponse<{ token: string }>>('/auth/refresh');
    return response.data;
  },
};
