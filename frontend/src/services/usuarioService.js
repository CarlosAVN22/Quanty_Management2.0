import { apiFetch } from './api';
export const obtenerRoles = async () => apiFetch('/usuarios/roles');
export const obtenerUsuarios = async () => apiFetch('/usuarios');
export const crearUsuario = async (payload) => apiFetch('/usuarios', { method: 'POST', body: payload });
export const actualizarUsuario = async (id, payload) => apiFetch(`/usuarios/${id}`, { method: 'PUT', body: payload });
export const cambiarEstadoUsuario = async (id, payload) => apiFetch(`/usuarios/${id}/estado`, { method: 'PATCH', body: payload });
