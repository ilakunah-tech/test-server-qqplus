export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface Coffee {
  id: string;
  hr_id: string;
  name: string;
  origin?: string;
  region?: string;
  variety?: string;
  processing?: string;
  moisture?: number;
  density?: number;
  created_at: string;
  updated_at?: string;
}

export interface Batch {
  id: string;
  coffee_id: string;
  lot_number: string;
  green_stock_kg: number;
  roasted_total_kg: number;
  status: 'active' | 'depleted' | 'expired';
  arrival_date?: string;
  expiration_date?: string;
  supplier?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Roast {
  id: string;
  batch_id: string;
  coffee_id: string;
  roast_date: string;
  operator?: string;
  machine?: string;
  green_weight_kg: number;
  roasted_weight_kg: number;
  weight_loss_percent?: number;
  roast_time_sec?: number;
  drop_temp?: number;
  first_crack_temp?: number;
  first_crack_time?: number;
  agtron?: number;
  notes?: string;
  profile_file?: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  coffee_id: string;
  batch_id?: string;
  planned_date: string;
  status: 'pending' | 'completed' | 'cancelled';
  completed_roast_id?: string;
  notes?: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface TokenResponse {
  token: string;
  user_id: string;
}
