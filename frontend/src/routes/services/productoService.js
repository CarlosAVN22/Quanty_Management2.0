import { apiFetch } from './api';
export const obtenerReferenciasProducto = async () => apiFetch('/productos/referencias');
export const obtenerProductos = async () => apiFetch('/productos');
export const crearProducto = async (payload) => apiFetch('/productos', { method: 'POST', body: payload });
export const actualizarProducto = async (id, payload) => apiFetch(`/productos/${id}`, { method: 'PUT', body: payload });
export const eliminarProducto = async (id) => apiFetch(`/productos/${id}`, { method: 'DELETE' });
