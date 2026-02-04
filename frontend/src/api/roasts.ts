import apiClient from './client';
import { ApiResponse, ListResponse, Roast } from '@/types/api';

export const roastsApi = {
  getRoasts: async (
    limit = 100,
    offset = 0,
    dateFrom?: string,
    dateTo?: string,
    coffeeId?: string,
    inQualityControl?: boolean
  ): Promise<ApiResponse<ListResponse<Roast>>> => {
    const response = await apiClient.get<ApiResponse<ListResponse<Roast>>>('/roasts', {
      params: { limit, offset, date_from: dateFrom, date_to: dateTo, coffee_id: coffeeId || undefined, in_quality_control: inQualityControl },
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

  updateRoast: async (
    id: string,
    data: Partial<Pick<Roast, 'notes' | 'cupping_score' | 'label' | 'title' | 'green_weight_kg' | 'roasted_weight_kg' | 'operator' | 'machine' | 'email' | 'cupping_date' | 'cupping_verdict' | 'espresso_date' | 'espresso_verdict' | 'espresso_notes' | 'reference_beans_notes' | 'in_quality_control'>>
  ): Promise<ApiResponse<Roast>> => {
    const response = await apiClient.patch<ApiResponse<Roast>>(`/roasts/${id}`, data);
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

  getProfileData: async (id: string): Promise<AlogProfile> => {
    const response = await apiClient.get<AlogProfile>(`/roasts/${id}/profile/data`);
    return response.data;
  },

  deleteRoast: async (id: string): Promise<void> => {
    await apiClient.delete(`/roasts/${id}`);
  },

  // Reference profiles (эталонные профили)
  getReferences: async (params: {
    coffee_id?: string;
    blend_id?: string;
    coffee_hr_id?: string;
    blend_hr_id?: string;
    machine?: string;
  }): Promise<ApiResponse<ListResponse<Roast>>> => {
    const response = await apiClient.get<ApiResponse<ListResponse<Roast>>>('/roasts/references', {
      params: {
        coffee_id: params.coffee_id,
        blend_id: params.blend_id,
        coffee_hr_id: params.coffee_hr_id,
        blend_hr_id: params.blend_hr_id,
        machine: params.machine ?? undefined,
      },
    });
    return response.data;
  },

  createReference: async (
    roastId: string,
    body: { reference_name: string; reference_for_coffee_id?: string; reference_for_blend_id?: string; reference_machine: string }
  ): Promise<ApiResponse<Roast>> => {
    const response = await apiClient.post<ApiResponse<Roast>>(`/roasts/${roastId}/reference`, body);
    return response.data;
  },

  replaceReference: async (
    roastId: string,
    body: { replace_reference_roast_id: string; reference_name?: string }
  ): Promise<ApiResponse<Roast>> => {
    const response = await apiClient.post<ApiResponse<Roast>>(`/roasts/${roastId}/reference/replace`, body);
    return response.data;
  },

  removeReference: async (roastId: string): Promise<void> => {
    await apiClient.delete(`/roasts/${roastId}/reference`);
  },
};

/** Parsed .alog profile (Artisan format) */
export interface AlogProfile {
  title?: string;
  beans?: string;
  weight?: [number, number, string];
  roastdate?: string;
  roastisodate?: string;
  roasttime?: string;
  roastepoch?: number;
  roastbatchnr?: number;
  roastbatchprefix?: string;
  roastbatchpos?: number;
  roastUUID?: string;
  plus_store?: string;
  plus_store_label?: string;
  plus_coffee?: string;
  plus_coffee_label?: string;
  roastertype?: string;
  operator?: string;
  organization?: string;
  machinesetup?: string;
  drumspeed?: string;
  roastingnotes?: string;
  cuppingnotes?: string;
  mode?: string;  // 'C' or 'F'
  whole_color?: number;
  ground_color?: number;
  
  // Bean parameters
  moisture_greens?: number;
  greens_temp?: number;
  moisture_roasted?: number;
  density?: [number, string, number, string];  // [0.7, 'g', 1, 'l']
  density_roasted?: [number, string, number, string];
  beansize_min?: string;
  beansize_max?: string;
  
  // Telemetry arrays (Artisan .alog format)
  timex?: number[];
  temp1?: number[];  // ET (Environmental/Exhaust Temperature)
  temp2?: number[];  // BT (Bean Temperature)
  
  // Event types and special events
  etypes?: string[];  // ['Air', 'Drum', 'Задвижка', 'Gas', '--']
  specialevents?: number[];  // indices into timex
  specialeventstype?: number[];  // 0=Air, 1=Drum, 2=Damper, 3=Gas
  specialeventsvalue?: number[];  // values (scaled)
  specialeventsStrings?: string[];  // display strings
  
  // Time indices for key events [CHARGE, DRY, FCs, FCe, SCs, SCe, DROP, COOL]
  timeindex?: number[];
  
  // Flavor profile
  flavors?: number[];
  flavorlabels?: string[];
  flavorstartangle?: number;
  
  // Computed values from Artisan
  computed?: {
    // Key event temperatures
    CHARGE_ET?: number;
    CHARGE_BT?: number;
    TP_idx?: number;
    TP_time?: number;
    TP_ET?: number;
    TP_BT?: number;
    DRY_time?: number;
    DRY_ET?: number;
    DRY_BT?: number;
    FCs_time?: number;
    FCs_ET?: number;
    FCs_BT?: number;
    FCe_time?: number;
    FCe_ET?: number;
    FCe_BT?: number;
    SCs_time?: number;
    SCs_ET?: number;
    SCs_BT?: number;
    DROP_time?: number;
    DROP_ET?: number;
    DROP_BT?: number;
    
    // Times
    totaltime?: number;
    dryphasetime?: number;
    midphasetime?: number;
    finishphasetime?: number;
    
    // RoR by phase (°C/min)
    dry_phase_ror?: number;
    mid_phase_ror?: number;
    finish_phase_ror?: number;
    total_ror?: number;
    fcs_ror?: number;
    
    // Temperature deltas by phase
    dry_phase_delta_temp?: number;
    mid_phase_delta_temp?: number;
    finish_phase_delta_temp?: number;
    
    // AUC metrics
    AUC?: number;
    AUCbase?: number;
    AUCbegin?: string;
    AUCfromeventflag?: number;
    dry_phase_AUC?: number;
    mid_phase_AUC?: number;
    finish_phase_AUC?: number;
    
    // Max temperatures
    MET?: number;  // Max ET
    
    // Weight
    weight_loss?: number;
    weightin?: number;
    weightout?: number;
    roast_defects_weight?: number;
    total_yield?: number;
    total_loss?: number;
    set_density?: number;
    moisture_greens?: number;
    
    // Advanced metrics
    det?: number;  // delta ET
    dbt?: number;  // delta BT
    total_ts?: number;  // total time spent
    total_ts_ET?: number;
    total_ts_BT?: number;
    
    // BBP (Between Batch Protocol)
    bbp_total_time?: number;
    bbp_bottom_temp?: number;
    bbp_begin_to_bottom_time?: number;
    bbp_bottom_to_charge_time?: number;
    bbp_begin_to_bottom_ror?: number;
    bbp_bottom_to_charge_ror?: number;
    
    // Energy (BTU/CO2)
    BTU_batch?: number;
    BTU_batch_per_green_kg?: number;
    CO2_batch?: number;
    CO2_batch_per_green_kg?: number;
    
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
