// В dev через Vite proxy — относительный URL избегает CORS; в prod — полный URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '/api/v1' : 'http://localhost:8000/api/v1');
export const WS_URL = import.meta.env.VITE_WS_URL ?? (import.meta.env.DEV ? `ws://${location.host}/ws` : 'ws://localhost:8000/ws');
