import { apiFetch } from './api';

export const obtenerClientes = async () => apiFetch('/clientes');
export const crearCliente = async (cliente) => apiFetch('/clientes', { method: 'POST', body: cliente });
export const actualizarCliente = async (id, cliente) => apiFetch(`/clientes/${id}`, { method: 'PUT', body: cliente });
export const eliminarCliente = async (id) => apiFetch(`/clientes/${id}`, { method: 'DELETE' });
