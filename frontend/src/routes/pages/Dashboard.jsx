import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerResumenDashboard } from "../services/dashboardService";
import { canAccess } from "../utils/auth";

function Dashboard() {
    const [data, setData] = useState({
        indicadores: {},
        ultimas_ventas: [],
        stock_critico: [],
        pagos_por_metodo: [],
    });
    const [error, setError] = useState("");

    useEffect(() => {
        const cargar = async () => {
            try {
                const res = await obtenerResumenDashboard();
                if (res.ok) setData(res.data || {});
                else setError(res.mensaje || "No se pudo cargar el inicio.");
            } catch (err) {
                console.error(err);
                setError("No se pudo cargar el inicio.");
            }
        };
        cargar();
    }, []);

    const ind = data.indicadores || {};
    const atajos = [
        canAccess("facturacion") && { to: "/facturacion", title: "Nueva factura", sub: "Ir directo al flujo de venta y DTE." },
        canAccess("ventas") && { to: "/ventas", title: "Ventas", sub: "Consultar ventas recientes y estados." },
        canAccess("clientes") && { to: "/clientes", title: "Clientes", sub: "Administrar clientes según tu rol." },
        canAccess("inventario") && { to: "/inventario", title: "Inventario", sub: "Revisar stock, movimientos y kardex." },
        canAccess("documentosDte") && { to: "/documentos-dte", title: "Documentos DTE", sub: "Revisar comprobantes y su flujo local." },
        canAccess("pagos") && { to: "/pagos", title: "Pagos", sub: "Registrar o revisar cobros del día." },
    ].filter(Boolean);

    const totalPagosHoy = useMemo(
        () => (data.pagos_por_metodo || []).reduce((acc, item) => acc + Number(item.total || 0), 0),
        [data.pagos_por_metodo]
    );

    return (
        <div className="page-stack">
            {error && <div className="alert error">{error}</div>}

            <section className="hero-card">
                <div>
                    <h2>Panel operativo del día</h2>
                    <p>
                        Este inicio ya está pensado como un tablero real: ventas del día, control documental, stock crítico,
                        últimos movimientos y accesos rápidos para trabajar sin perder tiempo.
                    </p>
                </div>
                <div className="hero-actions">
                    {canAccess("facturacion") && <Link to="/facturacion" className="btn btn-primary">+ Nueva factura</Link>}
                </div>
            </section>

            <section className="stats-grid four">
                <article className="stat-card"><span>Ventas del día</span><strong>${Number(ind.ventas_hoy_total || 0).toFixed(2)}</strong><small>{Number(ind.ventas_hoy_cantidad || 0)} venta(s)</small></article>
                <article className="stat-card"><span>Facturas emitidas</span><strong>{Number(ind.ventas_hoy_cantidad || 0)}</strong><small>Operación del día</small></article>
                <article className="stat-card"><span>DTE enviados</span><strong>{Number(ind.dte_enviados || 0)}</strong><small>{Number(ind.dte_pendientes || 0)} pendientes</small></article>
                <article className="stat-card"><span>IVA generado</span><strong>${Number(ind.iva_generado || 0).toFixed(2)}</strong><small>{Number(ind.productos_total || 0)} productos activos</small></article>
            </section>

            <section className="quick-grid">
                {atajos.map((item) => (
                    <Link key={item.to} to={item.to} className="quick-card">
                        <div className="quick-title">{item.title}</div>
                        <div className="quick-sub">{item.sub}</div>
                    </Link>
                ))}
            </section>

            <section className="dashboard-two-col">
                <div className="panel">
                    <div className="panel-header"><div><h3>Últimas ventas del día</h3><p>Lo más reciente para revisar número de control, método y estado.</p></div></div>
                    <div className="table-wrap">
                        <table className="app-table compact">
                            <thead>
                                <tr><th>N° control</th><th>Tipo DTE</th><th>Cliente</th><th>Total</th><th>Método</th><th>Estado MH</th><th>Hora</th></tr>
                            </thead>
                            <tbody>
                                {(data.ultimas_ventas || []).map((venta) => (
                                    <tr key={venta.id}>
                                        <td>{venta.numero_control}</td>
                                        <td><span className="badge info">{venta.tipo_dte}</span></td>
                                        <td>{venta.cliente}</td>
                                        <td>${Number(venta.total || 0).toFixed(2)}</td>
                                        <td>{venta.metodo_pago}</td>
                                        <td><span className={`badge ${venta.estado_mh === 'PENDIENTE' ? 'warning' : 'success'}`}>{venta.estado_mh}</span></td>
                                        <td>{new Date(venta.fecha).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</td>
                                    </tr>
                                ))}
                                {(!data.ultimas_ventas || data.ultimas_ventas.length === 0) && (
                                    <tr><td colSpan="7"><div className="empty-state small">Aún no hay ventas registradas hoy.</div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="dashboard-two-col">
                <div className="panel">
                    <div className="panel-header"><div><h3>Stock crítico</h3><p>Productos que requieren atención para no frenar ventas.</p></div></div>
                    <div className="stack-list">
                        {(data.stock_critico || []).map((item) => {
                            const stock = Number(item.stock_actual || 0);
                            const fill = Math.max(5, Math.min(100, stock));
                            const danger = stock <= 5;
                            return (
                                <div key={item.id} className="stock-row">
                                    <div className="stock-head"><span>{item.nombre}</span><strong>{stock} und.</strong></div>
                                    <div className="stock-track"><div className={`stock-fill ${danger ? 'danger' : stock <= 10 ? 'warning' : 'success'}`} style={{ width: `${fill}%` }}></div></div>
                                </div>
                            );
                        })}
                        {(!data.stock_critico || data.stock_critico.length === 0) && <div className="empty-state small">No hay productos en stock crítico.</div>}
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header"><div><h3>Métodos de pago hoy</h3><p>Resumen rápido para saber cómo se está cobrando.</p></div></div>
                    <div className="stack-list">
                        {(data.pagos_por_metodo || []).map((item) => (
                            <div key={item.codigo} className="metric-line">
                                <span>{item.nombre}</span>
                                <strong>${Number(item.total || 0).toFixed(2)}</strong>
                            </div>
                        ))}
                        <div className="metric-line total"><span>Total</span><strong>${Number(totalPagosHoy || 0).toFixed(2)}</strong></div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Dashboard;
