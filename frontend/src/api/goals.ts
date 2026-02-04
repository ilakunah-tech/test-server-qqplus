import apiClient from './client';

export interface GoalParameterConfig {
  enabled: boolean;
  tolerance: number;
}

export interface RoastGoal {
  id: string;
  name: string;
  goal_type: string;
  is_active: boolean;
  failed_status: 'failed' | 'warning';
  missing_value_status: 'failed' | 'warning';
  parameters: Record<string, GoalParameterConfig>;
  created_at: string;
  updated_at: string;
}

export interface RoastGoalCreate {
  name: string;
  goal_type?: string;
  is_active?: boolean;
  failed_status?: 'failed' | 'warning';
  missing_value_status?: 'failed' | 'warning';
  parameters: Record<string, GoalParameterConfig>;
}

export interface RoastGoalUpdate {
  name?: string;
  goal_type?: string;
  is_active?: boolean;
  failed_status?: 'failed' | 'warning';
  missing_value_status?: 'failed' | 'warning';
  parameters?: Record<string, GoalParameterConfig>;
}

export const goalsApi = {
  getGoals: async (): Promise<RoastGoal[]> => {
    // Don't send is_active param for now to avoid validation issues
    const response = await apiClient.get<RoastGoal[]>('/roasts/goals');
    // Handle both array response and wrapped response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // If wrapped in data field
    return (response.data as any).data || response.data || [];
  },

  getGoal: async (goalId: string): Promise<RoastGoal> => {
    const response = await apiClient.get<RoastGoal>(`/roasts/goals/${goalId}`);
    return response.data;
  },

  createGoal: async (data: RoastGoalCreate): Promise<RoastGoal> => {
    console.log('Creating goal with data:', data);
    const response = await apiClient.post<RoastGoal>('/roasts/goals', data);
    console.log('Goal created, response:', response.data);
    return response.data;
  },

  updateGoal: async (goalId: string, data: RoastGoalUpdate): Promise<RoastGoal> => {
    const response = await apiClient.patch<RoastGoal>(`/roasts/goals/${goalId}`, data);
    return response.data;
  },

  deleteGoal: async (goalId: string): Promise<void> => {
    await apiClient.delete(`/roasts/goals/${goalId}`);
  },
};
