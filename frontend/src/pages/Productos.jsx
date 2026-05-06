import { useEffect, useMemo, useState } from "react";
import {
    obtenerProductos,
    obtenerReferenciasProducto,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
} from "../services/productoService";

const formularioInicial = {
    codigo: "",
    nombre: "",
    descripcion: "",
    categoria_id: "",
    unidad_medida_id: "",
    precio_venta: "",
    stock_minimo: "",
    aplica_iva: true,
    activo: true,
};

function Productos() {
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [formulario, setFormulario] = useState(formularioInicial);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [productoEditandoId, setProductoEditandoId] = useState(null);
    const [busqueda, setBusqueda] = useState("");
    const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

    const cargarDatos = async () => {
        try {
            const [productosRes, referenciasRes] = await Promise.all([
                obtenerProductos(),
                obtenerReferenciasProducto(),
            ]);

            setProductos(productosRes.data || []);
            setCategorias(referenciasRes.data?.categorias || []);
            setUnidades(referenciasRes.data?.unidades || []);
        } catch (error) {
            console.error("Error al cargar productos:", error);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar productos y referencias." });
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const limpiarFormulario = () => {
        setFormulario(formularioInicial);
        setModoEdicion(false);
        setProductoEditandoId(null);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormulario((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: "", texto: "" });

        // Validación estricta de Comboboxes
        if (!formulario.categoria_id || formulario.categoria_id === "") {
            setMensaje({ tipo: "error", texto: "Debes seleccionar una categoría válida." });
            return;
        }

        if (!formulario.unidad_medida_id || formulario.unidad_medida_id === "") {
            setMensaje({ tipo: "error", texto: "Debes seleccionar una unidad de medida válida." });
            return;
        }

        const payload = {
            ...formulario,
            categoria_id: Number(formulario.categoria_id),
            unidad_medida_id: Number(formulario.unidad_medida_id),
            precio_venta: Number(formulario.precio_venta || 0),
            stock_minimo: Number(formulario.stock_minimo || 0),
        };

        try {
            const respuesta = modoEdicion
                ? await actualizarProducto(productoEditandoId, payload)
                : await crearProducto(payload);

            if (respuesta.ok) {
                setMensaje({
                    tipo: "success",
                    texto: modoEdicion ? "Producto actualizado correctamente." : "Producto creado correctamente.",
                });
                limpiarFormulario();
                await cargarDatos();
            } else {
                setMensaje({ tipo: "error", texto: respuesta.mensaje || "No se pudo guardar el producto." });
            }
        } catch (error) {
            console.error("Error al guardar producto:", error);
            setMensaje({ tipo: "error", texto: error?.message || "Ocurrió un error al guardar el producto." });
        }
    };

    const handleEditar = (producto) => {
        setModoEdicion(true);
        setProductoEditandoId(producto.id);
        setFormulario({
            codigo: producto.codigo || "",
            nombre: producto.nombre || "",
            descripcion: producto.descripcion || "",
            categoria_id: String(producto.categoria_id ?? ""),
            unidad_medida_id: String(producto.unidad_medida_id ?? ""),
            precio_venta: producto.precio_venta || "",
            stock_minimo: producto.stock_minimo || "",
            aplica_iva: Boolean(producto.aplica_iva),
            activo: Boolean(producto.activo),
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleEliminar = async (id) => {
        const confirmar = window.confirm("¿Eliminar este producto de la base de datos?");
        if (!confirmar) return;

        try {
            const respuesta = await eliminarProducto(id);
            if (respuesta.ok) {
                setMensaje({ tipo: "success", texto: respuesta.mensaje || "Producto eliminado correctamente." });
                await cargarDatos();
                if (productoEditandoId === id) limpiarFormulario();
            } else {
                setMensaje({ tipo: "error", texto: respuesta.mensaje || "No se pudo eliminar." });
            }
        } catch (error) {
            console.error("Error al eliminar producto:", error);
            setMensaje({ tipo: "error", texto: error?.message || "Ocurrió un error al eliminar el producto." });
        }
    };

    const productosFiltrados = useMemo(() => {
        const filtro = busqueda.trim().toLowerCase();
        if (!filtro) return productos;

        return productos.filter((producto) =>
            [
                producto.codigo,
                producto.nombre,
                producto.descripcion,
                producto.categoria_nombre,
                producto.unidad_nombre,
            ]
                .join(" ")
                .toLowerCase()
                .includes(filtro)
        );
    }, [productos, busqueda]);

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Catálogo de productos</h2>
                    <p>
                        Registra tus productos con precio de venta. Asegúrate de seleccionar correctamente las categorías y unidades.
                    </p>
                </div>
                <div className="hero-actions">
                    <div className="pill">{productos.length} producto(s)</div>
                    <div className="pill">{categorias.length} categoría(s)</div>
                </div>
            </section>

            {mensaje.texto && <div className={`alert ${mensaje.tipo === "success" ? "success" : "error"}`}>{mensaje.texto}</div>}

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h3>{modoEdicion ? "Editar producto" : "Nuevo producto"}</h3>
                        <p>Completa todos los campos obligatorios para guardar en la base de datos.</p>
                    </div>
                </div>

                <form className="page-stack" onSubmit={handleSubmit}>
                    <div className="form-grid three">
                        <div className="app-field">
                            <label>Código</label>
                            <input
                                name="codigo"
                                value={formulario.codigo}
                                onChange={(e) => setFormulario((prev) => ({ ...prev, codigo: String(e.target.value).toUpperCase() }))}
                                placeholder="Compatible con pistola / lector"
                                required
                            />
                        </div>
                        <div className="app-field full">
                            <label>Nombre</label>
                            <input name="nombre" value={formulario.nombre} onChange={handleChange} required />
                        </div>
                        <div className="app-field full">
                            <label>Descripción</label>
                            <textarea name="descripcion" value={formulario.descripcion} onChange={handleChange} />
                        </div>
                        <div className="app-field">
                            <label>Categoría</label>
                            <select name="categoria_id" value={formulario.categoria_id} onChange={handleChange} required>
                                <option value="" disabled>-- Seleccione una categoría --</option>
                                {categorias.map((categoria) => (
                                    <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="app-field">
                            <label>Unidad de medida</label>
                            <select name="unidad_medida_id" value={formulario.unidad_medida_id} onChange={handleChange} required>
                                <option value="" disabled>-- Seleccione una unidad --</option>
                                {unidades.map((unidad) => (
                                    <option key={unidad.id} value={unidad.id}>{unidad.nombre} ({unidad.codigo})</option>
                                ))}
                            </select>
                        </div>
                        <div className="app-field">
                            <label>Precio de venta</label>
                            <input name="precio_venta" type="number" min="0.01" step="0.01" value={formulario.precio_venta} onChange={handleChange} required />
                        </div>
                        <div className="app-field">
                            <label>Stock mínimo</label>
                            <input name="stock_minimo" type="number" min="0" step="0.01" value={formulario.stock_minimo} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="check-row">
                        <label className="check-pill">
                            <input type="checkbox" name="aplica_iva" checked={formulario.aplica_iva} onChange={handleChange} />
                            Aplica IVA
                        </label>
                        <label className="check-pill">
                            <input type="checkbox" name="activo" checked={formulario.activo} onChange={handleChange} />
                            Producto activo
                        </label>
                    </div>

                    <div className="button-row">
                        <button type="submit" className="btn btn-primary">
                            {modoEdicion ? "Actualizar producto" : "Guardar producto"}
                        </button>
                        {modoEdicion && (
                            <button type="button" className="btn btn-secondary" onClick={limpiarFormulario}>
                                Cancelar edición
                            </button>
                        )}
                    </div>
                </form>
            </section>

            <section className="panel">
                <div className="toolbar">
                    <div>
                        <h3>Listado de productos</h3>
                        <p className="muted">Consulta rápida del catálogo con categoría, unidad, precio y stock actual.</p>
                    </div>
                    <input
                        className="search-input"
                        placeholder="Buscar por código, nombre o categoría"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                {productosFiltrados.length === 0 ? (
                    <div className="empty-state">No hay productos para mostrar.</div>
                ) : (
                    <div className="table-wrap">
                        <table className="app-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Producto</th>
                                    <th>Categoría</th>
                                    <th>Unidad</th>
                                    <th>Precio</th>
                                    <th>Stock actual</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productosFiltrados.map((producto) => {
                                    const stock = Number(producto.stock_actual || 0);
                                    const minimo = Number(producto.stock_minimo || 0);
                                    const badgeClase = stock <= 0 ? "danger" : stock <= minimo ? "warning" : "success";
                                    const badgeTexto = stock <= 0 ? "Sin stock" : stock <= minimo ? "Stock bajo" : "Disponible";

                                    return (
                                        <tr key={producto.id}>
                                            <td>{producto.id}</td>
                                            <td>
                                                <div className="table-title">{producto.codigo} · {producto.nombre}</div>
                                                <div className="table-subtitle">{producto.descripcion || "Sin descripción"}</div>
                                            </td>
                                            <td>{producto.categoria_nombre || "-"}</td>
                                            <td>{producto.unidad_nombre || "-"}</td>
                                            <td>${Number(producto.precio_venta).toFixed(2)}</td>
                                            <td>{stock.toFixed(2)}</td>
                                            <td>
                                                <div className="inline-actions">
                                                    <span className={`badge ${badgeClase}`}>{badgeTexto}</span>
                                                    <span className={`badge ${producto.activo ? "info" : "danger"}`}>{producto.activo ? "Activo" : "Inactivo"}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="inline-actions">
                                                    <button className="btn btn-small btn-outline" onClick={() => handleEditar(producto)}>Editar</button>
                                                    <button className="btn btn-small btn-danger" onClick={() => handleEliminar(producto.id)}>Eliminar</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

export default Productos;