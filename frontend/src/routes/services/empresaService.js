import { apiFetch } from './api';
export const obtenerEmpresas = async () => apiFetch('/empresas');
export const actualizarEmpresa = async (id, empresa) => apiFetch(`/empresas/${id}`, { method: 'PUT', body: empresa });
