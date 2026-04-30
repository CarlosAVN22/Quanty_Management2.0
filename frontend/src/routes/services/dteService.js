import { apiFetch } from './api';
export const obtenerTiposDTE = async () => apiFetch('/dte/tipos');
export const obtenerDocumentosDTE = async () => apiFetch('/dte');
export const obtenerDocumentoDTEDetalle = async (id) => apiFetch(`/dte/${id}`);
export const enviarDTE = async (id) => apiFetch(`/dte/${id}/enviar`, { method: 'POST' });
