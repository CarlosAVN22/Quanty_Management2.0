import { useEffect, useMemo, useState } from "react";
import { obtenerProductos } from "../services/productoService";
import {
    obtenerExistencias,
    obtenerMovimientos,
    obtenerKardex,
    registrarMovimiento,
} from "../services/inventarioService";

const formatoNaturaleza = (naturaleza) => {
    if (naturaleza === "SALIDA") return "danger";
    if (naturaleza === "ENTRADA") return "success";
    return "warning";
};

function Inventario() {
    const [productos, setProductos] = useState([]);
    const [existencias, setExistencias] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [kardex, setKardex] = useState([]);
    const [tabActiva, setTabActiva] = useState("existencias");
    const [formulario, setFormulario] = useState({
        producto_id: "",
        tipo: "ENTRADA",
        cantidad: "",
        observacion: "",
    });
    const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
    const [kardexFiltro, setKardexFiltro] = useState("");

    const cargarTodo = async () => {
        try {
            const [productosRes, existenciasRes, movimientosRes, kardexRes] = await Promise.all([
                obtenerProductos(),
                obtenerExistencias(),
                obtenerMovimientos(),
                obtenerKardex(),
            ]);

            setProductos((productosRes.data || []).filter((item) => item.activo));
            setExistencias(existenciasRes.data || []);
            setMovimientos(movimientosRes.data || []);
            setKardex(kardexRes.data || []);
        } catch (error) {
            console.error("Error al cargar inventario:", error);
            setMensaje({ tipo: "error", texto: "No se pudo cargar la información de inventario." });
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
            producto_id: "",
            tipo: "ENTRADA",
            cantidad: "",
            observacion: "",
        });
    };

    const guardarMovimiento = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: "", texto: "" });

        try {
            const respuesta = await registrarMovimiento({
                producto_id: Number(formulario.producto_id),
                tipo: formulario.tipo,
                cantidad: Number(formulario.cantidad || 0),
                observacion: formulario.observacion,
            });

            if (respuesta.ok) {
                setMensaje({ tipo: "success", texto: respuesta.mensaje || "Movimiento registrado correctamente." });
                limpiarFormulario();
                await cargarTodo();
                setTabActiva("movimientos");
            } else {
                setMensaje({ tipo: "error", texto: respuesta.mensaje || "No se pudo registrar el movimiento." });
            }
        } catch (error) {
            console.error("Error al guardar movimiento:", error);
            setMensaje({ tipo: "error", texto: error?.message || "Ocurrió un error al registrar el movimiento." });
        }
    };

    const resumen = useMemo(() => {
        const stockBajo = existencias.filter((item) => Number(item.cantidad) <= Number(item.stock_minimo || 0)).length;
        const sinStock = existencias.filter((item) => Number(item.cantidad) <= 0).length;
        return {
            totalExistencias: existencias.length,
            stockBajo,
            sinStock,
            movimientos: movimientos.length,
        };
    }, [existencias, movimientos]);

    const productoSeleccionado = productos.find((item) => String(item.id) === String(formulario.producto_id));

    const kardexFiltrado = useMemo(() => {
        const filtro = kardexFiltro.trim().toLowerCase();
        if (!filtro) return kardex;

        return kardex.filter((item) => [
            item.producto_codigo,
            item.producto_nombre,
            item.bodega_nombre,
            item.detalle,
            item.tipo_nombre,
            item.tipo_codigo,
            item.observacion,
        ].join(" ").toLowerCase().includes(filtro));
    }, [kardex, kardexFiltro]);

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Inventario</h2>
                    <p>
                        Controla entradas, salidas y ajustes desde una sola vista. El precio se toma automáticamente
                        del precio registrado en productos.
                    </p>
                </div>
                <div className="hero-actions">
                    <div className="pill">{resumen.totalExistencias} existencia(s)</div>
                    <div className="pill">{resumen.stockBajo} con stock bajo</div>
                    <div className="pill">{resumen.movimientos} movimiento(s)</div>
                </div>
            </section>

            {mensaje.texto && <div className={`alert ${mensaje.tipo === "success" ? "success" : "error"}`}>{mensaje.texto}</div>}

            <section className="metric-grid">
                <article className="metric-card">
                    <small>Existencias</small>
                    <strong>{resumen.totalExistencias}</strong>
                    <span>Registros actuales por producto y bodega.</span>
                </article>
                <article className="metric-card">
                    <small>Stock bajo</small>
                    <strong>{resumen.stockBajo}</strong>
                    <span>Productos por debajo del mínimo configurado.</span>
                </article>
                <article className="metric-card">
                    <small>Sin stock</small>
                    <strong>{resumen.sinStock}</strong>
                    <span>Productos agotados en bodega principal.</span>
                </article>
                <article className="metric-card">
                    <small>Kardex</small>
                    <strong>{kardex.length}</strong>
                    <span>Líneas de trazabilidad disponibles para auditoría.</span>
                </article>
            </section>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h3>Registrar movimiento</h3>
                        <p>Selecciona producto, tipo y cantidad. El precio se trae automáticamente desde productos.</p>
                    </div>
                </div>

                <form className="page-stack" onSubmit={guardarMovimiento}>
                    <div className="form-grid three">
                        <div className="app-field">
                            <label>Producto</label>
                            <select name="producto_id" value={formulario.producto_id} onChange={handleChange} required>
                                <option value="">Seleccione un producto</option>
                                {productos.map((producto) => (
                                    <option key={producto.id} value={producto.id}>
                                        {producto.codigo} · {producto.nombre}
                                    </option>
                                ))}
                            </select>
                            {productoSeleccionado && (
                                <span className="helper">
                                    Stock actual: {Number(productoSeleccionado.stock_actual || 0).toFixed(2)} · Precio: ${Number(productoSeleccionado.precio_venta || 0).toFixed(2)}
                                </span>
                            )}
                        </div>
                        <div className="app-field">
                            <label>Tipo</label>
                            <select name="tipo" value={formulario.tipo} onChange={handleChange}>
                                <option value="ENTRADA">Entrada</option>
                                <option value="SALIDA">Salida</option>
                                <option value="AJUSTE_POSITIVO">Ajuste positivo</option>
                                <option value="AJUSTE_NEGATIVO">Ajuste negativo</option>
                            </select>
                        </div>
                        <div className="app-field">
                            <label>Cantidad</label>
                            <input name="cantidad" type="number" min="0.01" step="0.01" value={formulario.cantidad} onChange={handleChange} required />
                        </div>
                        <div className="app-field full">
                            <label>Observación</label>
                            <textarea name="observacion" value={formulario.observacion} onChange={handleChange} placeholder="Obligatorio para ajustes." />
                        </div>
                    </div>

                    <div className="button-row">
                        <button type="submit" className="btn btn-primary">Guardar movimiento</button>
                    </div>
                </form>
            </section>

            <section className="panel">
                <div className="toolbar">
                    <div>
                        <h3>Consultas de inventario</h3>
                        <p className="muted">Alterna entre existencias, movimientos y kardex.</p>
                    </div>
                    <div className="segmented">
                        <button className={tabActiva === "existencias" ? "active" : ""} onClick={() => setTabActiva("existencias")}>Existencias</button>
                        <button className={tabActiva === "movimientos" ? "active" : ""} onClick={() => setTabActiva("movimientos")}>Movimientos</button>
                        <button className={tabActiva === "kardex" ? "active" : ""} onClick={() => setTabActiva("kardex")}>Kardex</button>
                    </div>
                </div>

                {tabActiva === "existencias" && (
                    existencias.length === 0 ? (
                        <div className="empty-state">No hay existencias registradas.</div>
                    ) : (
                        <div className="table-wrap">
                            <table className="app-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Producto</th>
                                        <th>Bodega</th>
                                        <th>Stock</th>
                                        <th>Mínimo</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {existencias.map((item) => {
                                        const actual = Number(item.cantidad || 0);
                                        const minimo = Number(item.stock_minimo || 0);
                                        const badge = actual <= 0 ? "danger" : actual <= minimo ? "warning" : "success";
                                        const texto = actual <= 0 ? "Sin stock" : actual <= minimo ? "Bajo" : "Ok";

                                        return (
                                            <tr key={item.id}>
                                                <td>{item.codigo}</td>
                                                <td>
                                                    <div className="table-title">{item.nombre}</div>
                                                    <div className="table-subtitle">{item.descripcion || "Sin descripción"}</div>
                                                </td>
                                                <td>{item.bodega}</td>
                                                <td>{actual.toFixed(2)}</td>
                                                <td>{minimo.toFixed(2)}</td>
                                                <td><span className={`badge ${badge}`}>{texto}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}

                {tabActiva === "movimientos" && (
                    movimientos.length === 0 ? (
                        <div className="empty-state">No hay movimientos registrados.</div>
                    ) : (
                        <div className="table-wrap">
                            <table className="app-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Tipo</th>
                                        <th>Producto</th>
                                        <th>Bodega</th>
                                        <th>Cantidad</th>
                                        <th>Precio</th>
                                        <th>Total</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientos.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.id}</td>
                                            <td><span className={`badge ${formatoNaturaleza(item.naturaleza)}`}>{item.tipo_nombre}</span></td>
                                            <td>
                                                <div className="table-title">{item.producto_codigo} · {item.producto_nombre}</div>
                                                <div className="table-subtitle">{item.observacion || "Sin observación"}</div>
                                            </td>
                                            <td>{item.bodega_nombre}</td>
                                            <td>{Number(item.cantidad).toFixed(2)}</td>
                                            <td>${Number(item.precio_unitario || 0).toFixed(2)}</td>
                                            <td>${Number(item.precio_total || 0).toFixed(2)}</td>
                                            <td>{new Date(item.fecha).toLocaleString("es-SV")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}

                {tabActiva === "kardex" && (
                    <div className="page-stack" style={{ gap: 16 }}>
                        <div className="kardex-header-box">
                            <div>
                                <h4>Kardex oficial de movimientos</h4>
                                <p>Consulta la trazabilidad con entradas, salidas, saldo y precio tomado desde productos.</p>
                            </div>
                            <input
                                className="search-input"
                                value={kardexFiltro}
                                onChange={(e) => setKardexFiltro(e.target.value)}
                                placeholder="Filtrar kardex por producto, detalle u observación"
                            />
                        </div>

                        {kardexFiltrado.length === 0 ? (
                            <div className="empty-state">No hay movimientos en kardex.</div>
                        ) : (
                            <div className="table-wrap kardex-wrap">
                                <table className="app-table kardex-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Fecha</th>
                                            <th>Producto</th>
                                            <th>Tipo</th>
                                            <th>Detalle</th>
                                            <th>Entrada</th>
                                            <th>Salida</th>
                                            <th>Saldo</th>
                                            <th>Precio</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kardexFiltrado.map((item) => (
                                            <tr key={item.id}>
                                                <td>{item.id}</td>
                                                <td>{new Date(item.fecha).toLocaleString("es-SV")}</td>
                                                <td>
                                                    <div className="table-title">{item.producto_codigo} · {item.producto_nombre}</div>
                                                    <div className="table-subtitle">{item.bodega_nombre}</div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${formatoNaturaleza(item.naturaleza)}`}>{item.tipo_nombre || item.tipo_codigo || "Movimiento"}</span>
                                                </td>
                                                <td>
                                                    <div className="table-title">{item.detalle || "Sin detalle"}</div>
                                                    <div className="table-subtitle">{item.observacion || "Sin observación"}</div>
                                                </td>
                                                <td>{Number(item.entrada).toFixed(2)}</td>
                                                <td>{Number(item.salida).toFixed(2)}</td>
                                                <td><strong>{Number(item.saldo).toFixed(2)}</strong></td>
                                                <td>${Number(item.precio_unitario || 0).toFixed(2)}</td>
                                                <td>${Number(item.precio_total || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Inventario;
