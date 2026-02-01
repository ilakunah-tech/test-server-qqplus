import apiClient from './client';

export interface UserMachine {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

/** Known machine names from Artisan (catalog for suggestions). */
export async function getMachinesCatalog(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/machines/catalog');
  return data;
}

/** Machines added by the current user to their organization. */
export async function getMyMachines(): Promise<UserMachine[]> {
  const { data } = await apiClient.get<UserMachine[]>('/machines');
  return data;
}

export async function addMachine(name: string): Promise<UserMachine> {
  const { data } = await apiClient.post<UserMachine>('/machines', { name: name.trim() });
  return data;
}

export async function removeMachine(machineId: string): Promise<void> {
  await apiClient.delete(`/machines/${machineId}`);
}
