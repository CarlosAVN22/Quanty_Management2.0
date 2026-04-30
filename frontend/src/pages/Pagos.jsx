import { useEffect, useMemo, useState } from "react";
import {
    obtenerMetodosPago,
    obtenerPagos,
    obtenerVentasParaPago,
    registrarPago,
} from "../services/pagoService";

function Pagos() {
    const [metodos, setMetodos] = useState([]);
    const [ventas, setVentas] = useState([]);
    const [pagos, setPagos] = useState([]);
    const [formulario, setFormulario] = useState({
        venta_id: "",
        metodo_pago_id: "",
        monto: "",
        referencia_externa: "",
        autorizacion: "",
        observacion: "",
    });
    const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

    const cargarTodo = async () => {
        try {
            const [metodosRes, ventasRes, pagosRes] = await Promise.all([
                obtenerMetodosPago(),
                obtenerVentasParaPago(),
                obtenerPagos(),
            ]);

            setMetodos((metodosRes.data || []).filter((item) => item.activo));
            setVentas(ventasRes.data || []);
            setPagos(pagosRes.data || []);
        } catch (error) {
            console.error("Error al cargar pagos:", error);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar los pagos y referencias." });
        }
    };

    useEffect(() => {
        cargarTodo();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormulario((prev) => ({ ...prev, [name]: value }));
    };

    const limpiarFormulario = () => {
        setFormulario({
            venta_id: "",
            metodo_pago_id: "",
            monto: "",
            referencia_externa: "",
            autorizacion: "",
            observacion: "",
        });
    };

    const ventaSeleccionada = ventas.find((item) => String(item.id) === String(formulario.venta_id));
    const metodoSeleccionado = metodos.find((item) => String(item.id) === String(formulario.metodo_pago_id));
    const ventasPendientes = ventas.filter((item) => Number(item.saldo_pendiente || 0) > 0);

    const sugerirSaldo = () => {
        if (ventaSeleccionada) {
            setFormulario((prev) => ({ ...prev, monto: Number(ventaSeleccionada.saldo_pendiente || 0).toFixed(2) }));
        }
    };

    const guardarPago = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: "", texto: "" });

        try {
            const res = await registrarPago({
                venta_id: Number(formulario.venta_id),
                metodo_pago_id: Number(formulario.metodo_pago_id),
                monto: Number(formulario.monto || 0),
                referencia_externa: formulario.referencia_externa,
                autorizacion: formulario.autorizacion,
                observacion: formulario.observacion,
            });

            if (res.ok) {
                setMensaje({ tipo: "success", texto: "Pago registrado correctamente." });
                limpiarFormulario();
                cargarTodo();
            } else {
                setMensaje({ tipo: "error", texto: res.mensaje || "No se pudo registrar el pago." });
            }
        } catch (error) {
            console.error("Error al guardar pago:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al registrar el pago." });
        }
    };

    const totalPagos = useMemo(() => pagos.reduce((acc, item) => acc + Number(item.monto || 0), 0), [pagos]);

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Pagos</h2>
                    <p>
                        Registra cobros parciales o totales usando ventas pendientes y métodos de pago en combo para que todo quede claro.
                    </p>
                </div>
                <div className="hero-actions">
                    <div className="pill">{ventasPendientes.length} venta(s) con saldo</div>
                    <div className="pill">${totalPagos.toFixed(2)} pagos registrados</div>
                </div>
            </section>

            {mensaje.texto && <div className={`alert ${mensaje.tipo === "success" ? "success" : "error"}`}>{mensaje.texto}</div>}

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h3>Registrar pago</h3>
                        <p>Selecciona una venta pendiente y el método de pago correspondiente.</p>
                    </div>
                </div>

                <form className="page-stack" onSubmit={guardarPago}>
                    <div className="form-grid three">
                        <div className="app-field">
                            <label>Venta</label>
                            <select name="venta_id" value={formulario.venta_id} onChange={handleChange} required>
                                <option value="">Seleccione una venta</option>
                                {ventasPendientes.map((venta) => (
                                    <option key={venta.id} value={venta.id}>
                                        Venta #{venta.id} · {venta.cliente_nombre} · Saldo ${Number(venta.saldo_pendiente).toFixed(2)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="app-field">
                            <label>Método de pago</label>
                            <select name="metodo_pago_id" value={formulario.metodo_pago_id} onChange={handleChange} required>
                                <option value="">Seleccione un método</option>
                                {metodos.map((metodo) => (
                                    <option key={metodo.id} value={metodo.id}>{metodo.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="app-field">
                            <label>Monto</label>
                            <input name="monto" type="number" min="0.01" step="0.01" value={formulario.monto} onChange={handleChange} required />
                            {ventaSeleccionada && (
                                <button type="button" className="btn btn-small btn-outline" onClick={sugerirSaldo}>
                                    Usar saldo pendiente
                                </button>
                            )}
                        </div>
                        <div className="app-field">
                            <label>Referencia externa</label>
                            <input name="referencia_externa" value={formulario.referencia_externa} onChange={handleChange} />
                            {metodoSeleccionado?.requiere_referencia && <span className="helper">Este método requiere referencia.</span>}
                        </div>
                        <div className="app-field">
                            <label>Autorización</label>
                            <input name="autorizacion" value={formulario.autorizacion} onChange={handleChange} />
                        </div>
                        <div className="app-field full">
                            <label>Observación</label>
                            <textarea name="observacion" value={formulario.observacion} onChange={handleChange} />
                        </div>
                    </div>

                    {ventaSeleccionada && (
                        <div className="status-grid">
                            <div className="status-box">
                                <h4>Cliente</h4>
                                <p>{ventaSeleccionada.cliente_nombre}</p>
                            </div>
                            <div className="status-box">
                                <h4>Total venta</h4>
                                <p>${Number(ventaSeleccionada.total).toFixed(2)}</p>
                            </div>
                            <div className="status-box">
                                <h4>Saldo pendiente</h4>
                                <p>${Number(ventaSeleccionada.saldo_pendiente).toFixed(2)}</p>
                            </div>
                        </div>
                    )}

                    <div className="button-row">
                        <button type="submit" className="btn btn-primary">Registrar pago</button>
                    </div>
                </form>
            </section>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h3>Historial de pagos</h3>
                        <p>Consulta rápida de los cobros realizados.</p>
                    </div>
                </div>

                {pagos.length === 0 ? (
                    <div className="empty-state">No hay pagos registrados.</div>
                ) : (
                    <div className="table-wrap">
                        <table className="app-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Venta</th>
                                    <th>Método</th>
                                    <th>Monto</th>
                                    <th>Estado</th>
                                    <th>Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagos.map((pago) => (
                                    <tr key={pago.id}>
                                        <td>{pago.id}</td>
                                        <td>
                                            <div className="table-title">Venta #{pago.venta_id}</div>
                                            <div className="table-subtitle">{pago.cliente_nombre}</div>
                                        </td>
                                        <td>
                                            <div className="table-title">{pago.metodo_nombre}</div>
                                            <div className="table-subtitle">{pago.referencia_externa || "Sin referencia"}</div>
                                        </td>
                                        <td>${Number(pago.monto).toFixed(2)}</td>
                                        <td><span className={`badge ${pago.estado === "APROBADO" ? "success" : pago.estado === "RECHAZADO" ? "danger" : "warning"}`}>{pago.estado}</span></td>
                                        <td>{new Date(pago.fecha).toLocaleString("es-SV")}</td>
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

export default Pagos;
