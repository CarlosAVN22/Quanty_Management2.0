import { apiFetch } from './api';

export const loginUsuario = async (payload) => apiFetch('/auth/login', { method: 'POST', body: payload });
