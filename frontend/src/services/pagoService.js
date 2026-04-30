import { apiFetch } from './api';
export const obtenerMetodosPago = async () => apiFetch('/pagos/metodos');
export const crearMetodoPago = async (payload) => apiFetch('/pagos/metodos', { method: 'POST', body: payload });
export const obtenerPagos = async () => apiFetch('/pagos');
export const obtenerVentasPendientesPago = async () => apiFetch('/pagos/ventas');
export const registrarPago = async (payload) => apiFetch('/pagos', { method: 'POST', body: payload });

export const obtenerVentasParaPago = obtenerVentasPendientesPago;
