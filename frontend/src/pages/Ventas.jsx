import { useEffect, useMemo, useState } from "react";
import { obtenerVentas } from "../services/ventaService";

const badgeEstadoVenta = (estado) => {
    if (estado === "PAGADA") return "success";
    if (estado === "PARCIAL") return "warning";
    if (estado === "ANULADA") return "danger";
    return "info";
};

const badgeEstadoDte = (estado) => {
    if (estado === "PROCESADO") return "success";
    if (estado === "PENDIENTE") return "warning";
    if (estado === "RECHAZADO") return "danger";
    return "info";
};

function Ventas() {
    const [ventas, setVentas] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [mensaje, setMensaje] = useState("");

    const cargarVentas = async () => {
        try {
            const respuesta = await obtenerVentas();
            setVentas(respuesta.data || []);
        } catch (error) {
            console.error("Error al cargar ventas:", error);
            setMensaje("No se pudieron cargar las ventas.");
        }
    };

    useEffect(() => {
        cargarVentas();
    }, []);

    const ventasFiltradas = useMemo(() => {
        const filtro = busqueda.trim().toLowerCase();
        if (!filtro) return ventas;

        return ventas.filter((venta) =>
            [venta.id, venta.cliente_nombre, venta.numero_control, venta.tipo_dte, venta.estado, venta.dte_estado]
                .join(" ")
                .toLowerCase()
                .includes(filtro)
        );
    }, [ventas, busqueda]);

    const totalVentas = ventas.reduce((acc, item) => acc + Number(item.total || 0), 0);

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Ventas registradas</h2>
                    <p>Historial completo de ventas con estado de cobro, control DTE y saldo pendiente visible.</p>
                </div>
                <div className="hero-actions">
                    <div className="pill">{ventas.length} venta(s)</div>
                    <div className="pill">${totalVentas.toFixed(2)} acumulado</div>
                </div>
            </section>

            {mensaje && <div className="alert error">{mensaje}</div>}

            <section className="panel">
                <div className="toolbar">
                    <div>
                        <h3>Listado</h3>
                        <p className="muted">Busca por cliente, número de control, estado o tipo de DTE.</p>
                    </div>
                    <input
                        className="search-input"
                        placeholder="Buscar venta"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                {ventasFiltradas.length === 0 ? (
                    <div className="empty-state">No hay ventas para mostrar.</div>
                ) : (
                    <div className="table-wrap">
                        <table className="app-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Cliente</th>
                                    <th>Fecha</th>
                                    <th>Documento</th>
                                    <th>Total</th>
                                    <th>Cobro</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ventasFiltradas.map((venta) => (
                                    <tr key={venta.id}>
                                        <td>{venta.id}</td>
                                        <td>
                                            <div className="table-title">{venta.cliente_nombre}</div>
                                            <div className="table-subtitle">Venta #{venta.id}</div>
                                        </td>
                                        <td>{new Date(venta.fecha).toLocaleString("es-SV")}</td>
                                        <td>
                                            <div className="table-title">{venta.numero_control}</div>
                                            <div className="table-subtitle">DTE {venta.tipo_dte} · {venta.dte_estado}</div>
                                        </td>
                                        <td>
                                            <div className="table-title">${Number(venta.total).toFixed(2)}</div>
                                            <div className="table-subtitle">Subtotal ${Number(venta.subtotal || 0).toFixed(2)} · IVA ${Number(venta.iva || 0).toFixed(2)}</div>
                                        </td>
                                        <td>
                                            <div className="table-title">Pagado ${Number(venta.total_pagado || 0).toFixed(2)}</div>
                                            <div className="table-subtitle">Saldo ${Number(venta.saldo_pendiente || 0).toFixed(2)}</div>
                                        </td>
                                        <td>
                                            <div className="inline-actions">
                                                <span className={`badge ${badgeEstadoVenta(venta.estado)}`}>{venta.estado}</span>
                                                <span className={`badge ${badgeEstadoDte(venta.dte_estado)}`}>{venta.dte_estado}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

export default Ventas;
