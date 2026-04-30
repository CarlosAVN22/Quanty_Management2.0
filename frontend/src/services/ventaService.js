import { apiFetch } from './api';
export const obtenerVentas = async () => apiFetch('/ventas');
export const crearVenta = async (venta) => apiFetch('/ventas', { method: 'POST', body: venta });
