import { useNavigate } from 'react-router-dom';
import { authStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { LoginRequest } from '@/types/api';

export const useAuth = () => {
  const navigate = useNavigate();
  const { login: setAuth, logout, isAuthenticated, token } = authStore();

  const login = async (data: LoginRequest) => {
    try {
      const response = await authApi.login(data);
      setAuth(response.data.token, response.data.user_id);
      navigate('/dashboard');
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return {
    login,
    logout: handleLogout,
    isAuthenticated,
    token,
  };
};
