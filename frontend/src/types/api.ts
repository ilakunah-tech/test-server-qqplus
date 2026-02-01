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
  /** Backend may return `label` instead of `name` */
  label?: string;
  origin?: string;
  region?: string;
  variety?: string;
  processing?: string;
  moisture?: number;
  density?: number;
  stock_weight_kg?: number;
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

// ==================== BLEND ====================

export interface BlendIngredient {
  coffee: string;  // hr_id like "C1001"
  ratio: number;   // 0.0 to 1.0
  label?: string;  // "Brazil Santa Maria"
}

export interface BlendSpec {
  label: string;
  ingredients: BlendIngredient[];
}

// ==================== TELEMETRY ====================

export interface RoastTelemetry {
  timex?: number[];      // seconds
  temp1?: number[];      // ET (Environmental/Exhaust Temp) - Artisan convention
  temp2?: number[];      // BT (Bean Temp) - Artisan convention
  extra_temp1?: number[];
  extra_temp2?: number[];
  air?: number[];
  drum?: number[];
  gas?: number[];
  fan?: number[];
  heater?: number[];
}

// ==================== ROAST ====================

export interface Roast {
  id: string;
  user_id?: string;
  
  // Foreign keys
  batch_id?: string;
  coffee_id?: string;
  blend_id?: string;
  schedule_id?: string;
  
  // Batch identification
  batch_number: number;
  label: string;
  
  // Timestamps
  roasted_at?: string;
  /** Frontend/create alias for roasted_at */
  roast_date?: string;
  GMT_offset: number;
  modified_at?: string;
  created_at: string;
  updated_at?: string;
  
  // Weights (kg)
  green_weight_kg: number;
  roasted_weight_kg?: number;
  weight_loss?: number;
  defects_weight: number;
  
  // HR IDs (Artisan string identifiers)
  coffee_hr_id?: string;
  blend_hr_id?: string;
  location_hr_id?: string;
  blend_spec?: BlendSpec;
  
  // Roaster info
  machine?: string;
  operator?: string;
  email?: string;
  
  // Roast events - temperatures
  charge_temp?: number;
  TP_temp?: number;
  DRY_temp?: number;
  FCs_temp?: number;
  FCe_temp?: number;
  SCs_temp?: number;
  SCe_temp?: number;
  drop_temp?: number;
  
  // Roast events - times (seconds)
  TP_time?: number;
  DRY_time?: number;
  FCs_time?: number;
  FCe_time?: number;
  SCs_time?: number;
  SCe_time?: number;
  drop_time?: number;
  
  // Phases
  DEV_time?: number;
  DEV_ratio?: number;
  
  // Quality metrics
  whole_color: number;
  ground_color: number;
  cupping_score: number;
  
  // Temperature mode
  mode: 'C' | 'F';
  temp_unit: 'C' | 'F';
  
  // Telemetry
  telemetry: RoastTelemetry;
  
  // Other
  title?: string;
  roast_level?: string;
  notes?: string;
  
  /** Backend field for .alog path */
  alog_file_path?: string;
  profile_file?: string;
  
  // Reference profile (эталонный профиль)
  is_reference?: boolean;
  reference_name?: string;
  reference_for_coffee_id?: string;
  reference_for_blend_id?: string;
  reference_machine?: string;
  
  // Stock tracking
  deducted_components?: Array<{
    coffee_id: string;
    deducted_weight_kg: number;
  }>;
}

// ==================== SCHEDULE ====================

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

// ==================== API RESPONSES ====================

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

// ==================== ROAST EVENT MARKERS ====================

export interface RoastEvent {
  name: string;
  time: number;       // seconds
  temp: number;       // temperature
  label: string;      // display label
  color: string;      // marker color
}

export function getRoastEvents(roast: Roast): RoastEvent[] {
  const events: RoastEvent[] = [];
  const unit = roast.temp_unit || 'C';
  
  if (roast.charge_temp != null) {
    events.push({
      name: 'Charge',
      time: 0,
      temp: roast.charge_temp,
      label: `Charge, ${roast.charge_temp.toFixed(1)}°${unit}`,
      color: '#22c55e',  // green
    });
  }
  
  if (roast.TP_temp != null && roast.TP_time != null) {
    events.push({
      name: 'TP',
      time: roast.TP_time,
      temp: roast.TP_temp,
      label: `TP, ${roast.TP_temp.toFixed(1)}°${unit}`,
      color: '#3b82f6',  // blue
    });
  }
  
  if (roast.DRY_temp != null && roast.DRY_time != null) {
    events.push({
      name: 'Dry',
      time: roast.DRY_time,
      temp: roast.DRY_temp,
      label: `Dry, ${roast.DRY_temp.toFixed(0)}°${unit}`,
      color: '#f59e0b',  // amber
    });
  }
  
  if (roast.FCs_temp != null && roast.FCs_time != null) {
    events.push({
      name: 'FC',
      time: roast.FCs_time,
      temp: roast.FCs_temp,
      label: `FC, ${roast.FCs_temp.toFixed(1)}°${unit}`,
      color: '#ef4444',  // red
    });
  }
  
  if (roast.FCe_temp != null && roast.FCe_time != null) {
    events.push({
      name: 'FCe',
      time: roast.FCe_time,
      temp: roast.FCe_temp,
      label: `FCe, ${roast.FCe_temp.toFixed(1)}°${unit}`,
      color: '#dc2626',  // dark red
    });
  }
  
  if (roast.SCs_temp != null && roast.SCs_time != null) {
    events.push({
      name: 'SC',
      time: roast.SCs_time,
      temp: roast.SCs_temp,
      label: `SC, ${roast.SCs_temp.toFixed(1)}°${unit}`,
      color: '#7c3aed',  // violet
    });
  }
  
  if (roast.drop_temp != null && roast.drop_time != null) {
    events.push({
      name: 'Drop',
      time: roast.drop_time,
      temp: roast.drop_temp,
      label: `Drop, ${roast.drop_temp.toFixed(1)}°${unit}`,
      color: '#059669',  // emerald
    });
  }
  
  return events;
}
