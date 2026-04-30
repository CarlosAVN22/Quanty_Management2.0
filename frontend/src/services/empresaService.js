import { apiFetch } from './api';

export const obtenerEmpresas = async () => apiFetch('/empresas');
export const actualizarEmpresa = async (id, empresa) => apiFetch(`/empresas/${id}`, { method: 'PUT', body: empresa });
export const obtenerSucursalesEmpresa = async (empresaId) => apiFetch(`/empresas/${empresaId}/sucursales`);
export const crearSucursalEmpresa = async (empresaId, sucursal) => apiFetch(`/empresas/${empresaId}/sucursales`, { method: 'POST', body: sucursal });
export const actualizarSucursalEmpresa = async (empresaId, sucursalId, sucursal) => apiFetch(`/empresas/${empresaId}/sucursales/${sucursalId}`, { method: 'PUT', body: sucursal });
