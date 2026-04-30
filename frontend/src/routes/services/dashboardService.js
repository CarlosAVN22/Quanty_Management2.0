import { apiFetch } from './api';
export const obtenerResumenDashboard = async () => apiFetch('/dashboard');
