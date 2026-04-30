import { useEffect, useMemo, useState } from "react";
import { obtenerClientes } from "../services/clienteService";
import { obtenerProductos } from "../services/productoService";
import { obtenerMetodosPago } from "../services/pagoService";
import { crearVenta } from "../services/ventaService";
import { obtenerDocumentoDTEDetalle, obtenerTiposDTE } from "../services/dteService";
import FacturaPreviewModal from "../components/FacturaPreviewModal";

const tiposDteFallback = [
    { codigo: "01", nombre: "Factura", schema_archivo: "fe-fc-v1.json" },
    { codigo: "03", nombre: "Comprobante de crédito fiscal", schema_archivo: "fe-ccf-v3.json" },
    { codigo: "04", nombre: "Nota de remisión", schema_archivo: "fe-nr-v3.json" },
    { codigo: "05", nombre: "Nota de crédito", schema_archivo: "fe-nc-v3.json" },
    { codigo: "06", nombre: "Nota de débito", schema_archivo: "fe-nd-v3.json" },
    { codigo: "07", nombre: "Comprobante de retención", schema_archivo: "fe-cr-v1.json" },
    { codigo: "08", nombre: "Comprobante de liquidación", schema_archivo: "fe-cl-v1.json" },
    { codigo: "09", nombre: "Documento contable de liquidación", schema_archivo: "fe-dcl-v1.json" },
    { codigo: "11", nombre: "Factura de exportación", schema_archivo: "fe-fex-v1.json" },
    { codigo: "14", nombre: "Factura de sujeto excluido", schema_archivo: "fe-fse-v1.json" },
    { codigo: "15", nombre: "Comprobante de donación", schema_archivo: "fe-cd-v1.json" },
];

const pagoInicial = {
    registrar_pago: true,
    metodo_pago_id: "",
    monto: "",
    referencia_externa: "",
    autorizacion: "",
    observacion: "",
};

const crearTextoBusqueda = (producto) => [
    producto.codigo,
    producto.nombre,
    producto.descripcion,
    producto.categoria_nombre,
    producto.unidad_nombre,
].join(" ").toLowerCase();

function Facturacion() {
    const [clientes, setClientes] = useState([]);
    const [productos, setProductos] = useState([]);
    const [metodosPago, setMetodosPago] = useState([]);
    const [tiposDte, setTiposDte] = useState(tiposDteFallback);
    const [clienteModo, setClienteModo] = useState("MOSTRADOR");
    const [clienteId, setClienteId] = useState("");
    const [tipoDte, setTipoDte] = useState("01");
    const [productoBusqueda, setProductoBusqueda] = useState("");
    const [detalle, setDetalle] = useState([]);
    const [observacion, setObservacion] = useState("");
    const [pago, setPago] = useState(pagoInicial);
    const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
    const [guardando, setGuardando] = useState(false);
    const [ultimaFacturaId, setUltimaFacturaId] = useState(null);
    const [previewFactura, setPreviewFactura] = useState(null);
    const [cargandoPreview, setCargandoPreview] = useState(false);

    const cargarDatos = async () => {
        try {
            const [clientesRes, productosRes, metodosRes, tiposDteRes] = await Promise.all([
                obtenerClientes(),
                obtenerProductos(),
                obtenerMetodosPago(),
                obtenerTiposDTE(),
            ]);

            setClientes((clientesRes.data || []).filter((item) => item.activo));
            setProductos((productosRes.data || []).filter((item) => item.activo));
            const metodos = (metodosRes.data || []).filter((item) => item.activo);
            setMetodosPago(metodos);
            setTiposDte((tiposDteRes.data || []).length > 0 ? tiposDteRes.data : tiposDteFallback);

            setPago((prev) => ({
                ...prev,
                metodo_pago_id: prev.metodo_pago_id || String(metodos[0]?.id || ""),
            }));
        } catch (error) {
            console.error("Error al cargar datos de facturación:", error);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar clientes, productos y métodos de pago." });
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const subtotal = useMemo(
        () => detalle.reduce((acc, item) => acc + item.cantidad * item.precio_unitario, 0),
        [detalle]
    );

    const iva = useMemo(
        () => detalle.reduce((acc, item) => {
            const linea = item.cantidad * item.precio_unitario;
            return item.aplica_iva ? acc + linea * 0.13 : acc;
        }, 0),
        [detalle]
    );

    const total = Number((subtotal + iva).toFixed(2));

    useEffect(() => {
        setPago((prev) => ({
            ...prev,
            monto: prev.registrar_pago ? String(total || "") : "",
        }));
    }, [total]);

    const clienteSeleccionado = clientes.find((item) => String(item.id) === String(clienteId));
    const metodoSeleccionado = metodosPago.find((item) => String(item.id) === String(pago.metodo_pago_id));
    const tipoDteSeleccionado = tiposDte.find((item) => item.codigo === tipoDte);

    const productosFiltrados = useMemo(() => {
        const filtro = productoBusqueda.trim().toLowerCase();
        const base = [...productos].sort((a, b) => {
            const stockA = Number(a.stock_actual || 0);
            const stockB = Number(b.stock_actual || 0);
            if (stockA === stockB) return String(a.nombre).localeCompare(String(b.nombre), "es");
            return stockB - stockA;
        });

        if (!filtro) return base.slice(0, 12);

        return base
            .filter((producto) => crearTextoBusqueda(producto).includes(filtro))
            .slice(0, 12);
    }, [productos, productoBusqueda]);

    const agregarProducto = (producto) => {
        setMensaje({ tipo: "", texto: "" });
        if (!producto) return;

        const stockActual = Number(producto.stock_actual || 0);
        if (stockActual <= 0) {
            setMensaje({ tipo: "error", texto: `El producto ${producto.nombre} no tiene stock disponible.` });
            return;
        }

        setDetalle((prev) => {
            const existente = prev.find((item) => item.producto_id === producto.id);

            if (existente) {
                if (existente.cantidad + 1 > stockActual) {
                    setMensaje({ tipo: "error", texto: `No puedes agregar más de ${stockActual.toFixed(2)} unidades para ${producto.nombre}.` });
                    return prev;
                }

                return prev.map((item) => (
                    item.producto_id === producto.id
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item
                ));
            }

            return [
                ...prev,
                {
                    producto_id: producto.id,
                    codigo: producto.codigo,
                    nombre: producto.nombre,
                    categoria: producto.categoria_nombre,
                    cantidad: 1,
                    precio_unitario: Number(producto.precio_venta),
                    aplica_iva: Boolean(producto.aplica_iva),
                    stock_actual: stockActual,
                },
            ];
        });

        setProductoBusqueda("");
    };

    const actualizarCantidad = (productoId, cantidadNueva) => {
        const cantidad = Number(cantidadNueva);

        setDetalle((prev) => prev.map((item) => {
            if (item.producto_id !== productoId) return item;
            if (!cantidad || cantidad <= 0) return item;
            if (cantidad > item.stock_actual) {
                setMensaje({ tipo: "error", texto: `La cantidad máxima para ${item.nombre} es ${item.stock_actual.toFixed(2)}.` });
                return item;
            }

            return { ...item, cantidad };
        }));
    };

    const eliminarProducto = (productoId) => {
        setDetalle((prev) => prev.filter((item) => item.producto_id !== productoId));
    };

    const limpiarFormulario = () => {
        setClienteModo("MOSTRADOR");
        setClienteId("");
        setTipoDte("01");
        setProductoBusqueda("");
        setDetalle([]);
        setObservacion("");
        setPago((prev) => ({
            ...pagoInicial,
            registrar_pago: true,
            metodo_pago_id: String(prev.metodo_pago_id || metodosPago[0]?.id || ""),
            monto: "",
        }));
    };

    const cargarFacturaParaPreview = async (dteId) => {
        if (!dteId) return;
        setCargandoPreview(true);
        try {
            const respuesta = await obtenerDocumentoDTEDetalle(dteId);
            if (respuesta.ok) {
                setPreviewFactura(respuesta.data);
            } else {
                setMensaje({ tipo: "error", texto: respuesta.mensaje || "No se pudo preparar la factura." });
            }
        } catch (error) {
            console.error("Error al abrir factura:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al preparar la factura." });
        } finally {
            setCargandoPreview(false);
        }
    };

    const guardarVenta = async (abrirFacturaAlFinal = false) => {
        setMensaje({ tipo: "", texto: "" });

        if (clienteModo === "REGISTRADO" && !clienteId) {
            setMensaje({ tipo: "error", texto: "Debes seleccionar un cliente registrado." });
            return;
        }

        if (detalle.length === 0) {
            setMensaje({ tipo: "error", texto: "Agrega al menos un producto al detalle." });
            return;
        }

        if (pago.registrar_pago && !pago.metodo_pago_id) {
            setMensaje({ tipo: "error", texto: "Selecciona un método de pago para registrar el cobro." });
            return;
        }

        if (pago.registrar_pago && Number(pago.monto || 0) <= 0) {
            setMensaje({ tipo: "error", texto: "El monto del pago debe ser mayor a cero." });
            return;
        }

        if (metodoSeleccionado?.requiere_referencia && !String(pago.referencia_externa || "").trim()) {
            setMensaje({ tipo: "error", texto: `El método ${metodoSeleccionado.nombre} requiere referencia.` });
            return;
        }

        setGuardando(true);

        try {
            const payload = {
                cliente_id: clienteModo === "REGISTRADO" ? Number(clienteId) : null,
                tipo_dte: tipoDte,
                observacion,
                productos: detalle.map((item) => ({
                    producto_id: item.producto_id,
                    cantidad: Number(item.cantidad),
                    precio_unitario: Number(item.precio_unitario),
                    aplica_iva: item.aplica_iva,
                })),
                pago: pago.registrar_pago ? {
                    metodo_pago_id: Number(pago.metodo_pago_id),
                    monto: Number(pago.monto || total),
                    referencia_externa: pago.referencia_externa,
                    autorizacion: pago.autorizacion,
                    observacion: pago.observacion,
                } : null,
            };

            const respuesta = await crearVenta(payload);

            if (respuesta.ok) {
                const dteId = respuesta.data?.dte?.id;
                setUltimaFacturaId(dteId || null);
                setMensaje({
                    tipo: "success",
                    texto: respuesta.data?.pago
                        ? `Venta #${respuesta.data.venta.id} guardada con pago ${respuesta.data.pago.metodo_nombre}. DTE: ${respuesta.data.dte.numero_control}.`
                        : `Venta #${respuesta.data.venta.id} guardada correctamente. DTE generado: ${respuesta.data.dte.numero_control}.`,
                });
                limpiarFormulario();
                await cargarDatos();
                if (abrirFacturaAlFinal && dteId) {
                    await cargarFacturaParaPreview(dteId);
                }
            } else {
                setMensaje({ tipo: "error", texto: respuesta.mensaje || "No se pudo registrar la venta." });
            }
        } catch (error) {
            console.error("Error al registrar venta:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al registrar la venta." });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Facturación local</h2>
                    <p>
                        Ahora la venta trabaja con vista previa integrada de factura, sin pop-ups bloqueados,
                        buscador real de productos y pago directamente dentro del flujo de facturación.
                    </p>
                </div>
                <div className="hero-actions">
                    <div className="pill">{detalle.length} producto(s)</div>
                    <div className="pill">${total.toFixed(2)} total</div>
                </div>
            </section>

            {mensaje.texto && <div className={`alert ${mensaje.tipo === "success" ? "success" : "error"}`}>{mensaje.texto}</div>}

            {ultimaFacturaId && (
                <div className="alert info invoice-inline-actions">
                    <span>Última factura generada lista para revisar.</span>
                    <div className="inline-actions wrap">
                        <button className="btn btn-small btn-primary" onClick={() => cargarFacturaParaPreview(ultimaFacturaId)} disabled={cargandoPreview}>
                            {cargandoPreview ? "Preparando..." : "Ver factura emitida"}
                        </button>
                    </div>
                </div>
            )}

            <div className="summary-grid">
                <section className="page-stack">
                    <article className="panel">
                        <div className="panel-header">
                            <div>
                                <h3>Datos del documento</h3>
                                <p>Selecciona el tipo de DTE y cómo deseas manejar al cliente en esta venta.</p>
                            </div>
                        </div>

                        <div className="doc-type-grid">
                            {tiposDte.map((tipo) => (
                                <button
                                    key={tipo.codigo}
                                    type="button"
                                    className={`doc-type-card${tipoDte === tipo.codigo ? " selected" : ""}`}
                                    onClick={() => setTipoDte(tipo.codigo)}
                                >
                                    <strong>{tipo.codigo}</strong>
                                    <span>{tipo.nombre}</span>
                                </button>
                            ))}
                        </div>

                        <div className="toggle-row" style={{ marginTop: 18 }}>
                            <button
                                type="button"
                                className={`toggle-chip${clienteModo === "MOSTRADOR" ? " active" : ""}`}
                                onClick={() => setClienteModo("MOSTRADOR")}
                            >
                                Venta en escritorio
                            </button>
                            <button
                                type="button"
                                className={`toggle-chip${clienteModo === "REGISTRADO" ? " active" : ""}`}
                                onClick={() => setClienteModo("REGISTRADO")}
                            >
                                Cliente registrado
                            </button>
                        </div>

                        <div className="form-grid" style={{ marginTop: 16 }}>
                            <div className="app-field full">
                                <label>Cliente</label>
                                {clienteModo === "MOSTRADOR" ? (
                                    <div className="search-result-card selected">
                                        <div>
                                            <strong>VENTA EN ESCRITORIO</strong>
                                            <div className="table-subtitle">Se usará el cliente general automáticamente al guardar la venta.</div>
                                        </div>
                                    </div>
                                ) : (
                                    <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                                        <option value="">Seleccione un cliente</option>
                                        {clientes.map((cliente) => (
                                            <option key={cliente.id} value={cliente.id}>
                                                {cliente.nombre} {cliente.documento ? `· ${cliente.documento}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="app-field full">
                                <label>Observación</label>
                                <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Observación interna de la venta" />
                            </div>
                        </div>
                    </article>

                    <article className="panel">
                        <div className="panel-header">
                            <div>
                                <h3>Agregar productos</h3>
                                <p>Busca por código, nombre, categoría o descripción. Los productos agotados también aparecen, pero no se pueden agregar.</p>
                            </div>
                            <div className="pill">{productosFiltrados.length} resultado(s)</div>
                        </div>

                        <div className="app-field product-search-wrap">
                            <label>Buscador de productos</label>
                            <div className="search-with-icon">
                                <span>🔎</span>
                                <input
                                    value={productoBusqueda}
                                    onChange={(e) => setProductoBusqueda(e.target.value)}
                                    placeholder="Busca un producto por nombre, código, categoría o descripción"
                                />
                            </div>

                            <div className="search-results-list compact-results">
                                {productosFiltrados.length === 0 ? (
                                    <div className="empty-inline">No hay productos que coincidan con la búsqueda.</div>
                                ) : (
                                    productosFiltrados.map((producto) => {
                                        const stock = Number(producto.stock_actual || 0);
                                        const agotado = stock <= 0;
                                        return (
                                            <button
                                                type="button"
                                                key={producto.id}
                                                className={`search-result-card ${agotado ? "disabled" : ""}`}
                                                onClick={() => agregarProducto(producto)}
                                                disabled={agotado}
                                            >
                                                <div>
                                                    <strong>{producto.codigo} · {producto.nombre}</strong>
                                                    <div className="table-subtitle">{producto.categoria_nombre || "Sin categoría"} · {producto.unidad_nombre || "Unidad"}</div>
                                                </div>
                                                <div className="search-result-meta">
                                                    <strong>${Number(producto.precio_venta).toFixed(2)}</strong>
                                                    <span className={`stock-chip ${agotado ? "out" : stock <= Number(producto.stock_minimo || 0) ? "low" : "ok"}`}>
                                                        {agotado ? "Agotado" : `Stock ${stock.toFixed(2)}`}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {detalle.length === 0 ? (
                            <div className="empty-state">Todavía no has agregado productos a la venta.</div>
                        ) : (
                            <div className="detail-list">
                                {detalle.map((item) => (
                                    <div key={item.producto_id} className="detail-item">
                                        <div className="detail-meta">
                                            <strong>{item.codigo} · {item.nombre}</strong>
                                            <span>{item.categoria || "Sin categoría"} · Stock disponible: {item.stock_actual.toFixed(2)}</span>
                                        </div>
                                        <div className="app-field">
                                            <label>Cantidad</label>
                                            <input
                                                className="qty-box"
                                                type="number"
                                                min="1"
                                                max={item.stock_actual}
                                                value={item.cantidad}
                                                onChange={(e) => actualizarCantidad(item.producto_id, e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <div className="table-subtitle">Precio</div>
                                            <div className="table-title">${Number(item.precio_unitario).toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div className="table-subtitle">Subtotal</div>
                                            <div className="table-title">${Number(item.cantidad * item.precio_unitario).toFixed(2)}</div>
                                        </div>
                                        <button className="btn btn-small btn-danger" onClick={() => eliminarProducto(item.producto_id)}>
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>
                </section>

                <aside className="summary-card">
                    <h3>Resumen y pago</h3>
                    <div className="summary-list">
                        <div className="summary-line">
                            <span>Cliente</span>
                            <strong>{clienteModo === "MOSTRADOR" ? "VENTA EN ESCRITORIO" : (clienteSeleccionado?.nombre || "Sin seleccionar")}</strong>
                        </div>
                        <div className="summary-line">
                            <span>Tipo DTE</span>
                            <strong>{tiposDte.find((item) => item.codigo === tipoDte)?.nombre || "-"}</strong>
                        </div>
                        <div className="summary-line">
                            <span>Subtotal</span>
                            <strong>${subtotal.toFixed(2)}</strong>
                        </div>
                        <div className="summary-line">
                            <span>IVA</span>
                            <strong>${iva.toFixed(2)}</strong>
                        </div>
                        <div className="summary-line total">
                            <span>Total</span>
                            <strong>${total.toFixed(2)}</strong>
                        </div>
                    </div>

                    <div className="payment-box">
                        <div className="payment-header">
                            <h4>Pago en esta venta</h4>
                            <label className="checkbox-inline">
                                <input
                                    type="checkbox"
                                    checked={pago.registrar_pago}
                                    onChange={(e) => setPago((prev) => ({ ...prev, registrar_pago: e.target.checked }))}
                                />
                                Registrar pago ahora
                            </label>
                        </div>

                        {pago.registrar_pago ? (
                            <div className="page-stack" style={{ gap: 14 }}>
                                <div className="app-field">
                                    <label>Método de pago</label>
                                    <select
                                        value={pago.metodo_pago_id}
                                        onChange={(e) => setPago((prev) => ({ ...prev, metodo_pago_id: e.target.value }))}
                                    >
                                        <option value="">Seleccione un método</option>
                                        {metodosPago.map((metodo) => (
                                            <option key={metodo.id} value={metodo.id}>
                                                {metodo.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="app-field">
                                    <label>Monto a registrar</label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        max={total}
                                        step="0.01"
                                        value={pago.monto}
                                        onChange={(e) => setPago((prev) => ({ ...prev, monto: e.target.value }))}
                                    />
                                    <span className="helper">Puedes registrar pago total o parcial.</span>
                                </div>

                                {(metodoSeleccionado?.codigo === "TARJETA" || metodoSeleccionado?.codigo === "TRANSFERENCIA" || metodoSeleccionado?.codigo === "PAYPAL") && (
                                    <div className="app-field">
                                        <label>{metodoSeleccionado?.codigo === "TARJETA" ? "Referencia / últimos dígitos" : metodoSeleccionado?.codigo === "PAYPAL" ? "ID de operación / referencia PayPal" : "Número de referencia"}</label>
                                        <input
                                            value={pago.referencia_externa}
                                            onChange={(e) => setPago((prev) => ({ ...prev, referencia_externa: e.target.value }))}
                                            placeholder="Dato requerido para este método"
                                        />
                                    </div>
                                )}

                                {(metodoSeleccionado?.codigo === "TARJETA" || metodoSeleccionado?.codigo === "PAYPAL") && (
                                    <div className="app-field">
                                        <label>Autorización</label>
                                        <input
                                            value={pago.autorizacion}
                                            onChange={(e) => setPago((prev) => ({ ...prev, autorizacion: e.target.value }))}
                                            placeholder="Código de autorización si aplica"
                                        />
                                    </div>
                                )}

                                <div className="app-field">
                                    <label>Observación del pago</label>
                                    <textarea
                                        value={pago.observacion}
                                        onChange={(e) => setPago((prev) => ({ ...prev, observacion: e.target.value }))}
                                        placeholder="Nota opcional del cobro"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="notice-card">La venta se guardará sin pago y quedará pendiente para cobrar luego desde el módulo de Pagos.</div>
                        )}
                    </div>

                    <div className="button-row vertical" style={{ marginTop: 18 }}>
                        <button className="btn btn-success" disabled={guardando} onClick={() => guardarVenta(false)}>
                            {guardando ? "Guardando..." : "Guardar venta"}
                        </button>
                        <button className="btn btn-primary" disabled={guardando} onClick={() => guardarVenta(true)}>
                            {guardando ? "Procesando..." : "Guardar e imprimir factura"}
                        </button>
                    </div>
                    <p className="helper" style={{ marginTop: 10 }}>
                        La representación gráfica se abre dentro del sistema y desde ahí podrás imprimirla o guardarla como PDF sin bloquearse por pop-ups.
                    </p>
                </aside>
            </div>

            <FacturaPreviewModal
                abierto={Boolean(previewFactura)}
                payload={previewFactura}
                onClose={() => setPreviewFactura(null)}
                titulo="Factura emitida"
            />
        </div>
    );
}

export default Facturacion;
