import { apiFetch } from './api';
export const obtenerExistencias = async () => apiFetch('/inventario/existencias');
export const obtenerMovimientos = async () => apiFetch('/inventario/movimientos');
export const obtenerKardex = async () => apiFetch('/inventario/kardex');
export const registrarMovimiento = async (payload) => apiFetch('/inventario/movimientos', { method: 'POST', body: payload });
