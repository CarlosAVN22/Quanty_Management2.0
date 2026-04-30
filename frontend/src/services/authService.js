import { apiFetch } from './api';

export const obtenerContextoLogin = async () => apiFetch('/auth/contexto', { headers: {} });
export const loginUsuario = async (payload) => apiFetch('/auth/login', { method: 'POST', body: payload, headers: {} });
