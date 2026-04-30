import { useEffect, useMemo, useState } from "react";
import {
    obtenerEmpresas,
    actualizarEmpresa,
    obtenerSucursalesEmpresa,
    crearSucursalEmpresa,
    actualizarSucursalEmpresa,
} from "../services/empresaService";

const sucursalInicial = {
    id: null,
    nombre: "",
    telefono: "",
    correo: "",
    activo: true,
};

function Empresa() {
    const [empresa, setEmpresa] = useState(null);
    const [form, setForm] = useState({
        nombre: "",
        nombre_comercial: "",
        nit: "",
        nrc: "",
        telefono: "",
        correo: "",
        logo_url: "",
        activo: true,
    });
    const [sucursales, setSucursales] = useState([]);
    const [sucursalForm, setSucursalForm] = useState(sucursalInicial);
    const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
    const [guardandoSucursal, setGuardandoSucursal] = useState(false);

    const cargarSucursales = async (empresaId) => {
        if (!empresaId) {
            setSucursales([]);
            return;
        }

        try {
            const res = await obtenerSucursalesEmpresa(empresaId);
            setSucursales(res.data || []);
        } catch (error) {
            console.error("Error al cargar sucursales:", error);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar las sucursales registradas." });
        }
    };

    const cargarEmpresa = async () => {
        try {
            const res = await obtenerEmpresas();
            const empresaActual = res.data?.[0] || null;
            setEmpresa(empresaActual);

            if (empresaActual) {
                setForm({
                    nombre: empresaActual.nombre || "",
                    nombre_comercial: empresaActual.nombre_comercial || "",
                    nit: empresaActual.nit || "",
                    nrc: empresaActual.nrc || "",
                    telefono: empresaActual.telefono || "",
                    correo: empresaActual.correo || "",
                    logo_url: empresaActual.logo_url || "",
                    activo: empresaActual.activo ?? true,
                });

                await cargarSucursales(empresaActual.id);
            } else {
                setSucursales([]);
            }
        } catch (error) {
            console.error("Error al cargar empresa:", error);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar los datos de la empresa." });
        }
    };

    useEffect(() => {
        cargarEmpresa();
    }, []);

    const resumenSucursales = useMemo(() => {
        const activas = sucursales.filter((sucursal) => sucursal.activo).length;
        return {
            total: sucursales.length,
            activas,
            inactivas: Math.max(sucursales.length - activas, 0),
        };
    }, [sucursales]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSucursalChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSucursalForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const resetSucursalForm = () => {
        setSucursalForm(sucursalInicial);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: "", texto: "" });

        if (!empresa) {
            setMensaje({ tipo: "error", texto: "No hay empresa registrada para actualizar." });
            return;
        }

        try {
            const res = await actualizarEmpresa(empresa.id, form);
            if (res.ok) {
                setMensaje({ tipo: "success", texto: "Empresa actualizada correctamente." });
                cargarEmpresa();
            } else {
                setMensaje({ tipo: "error", texto: res.mensaje || "No se pudo actualizar la empresa." });
            }
        } catch (error) {
            console.error("Error al actualizar empresa:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al actualizar la empresa." });
        }
    };

    const handleGuardarSucursal = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: "", texto: "" });

        if (!empresa) {
            setMensaje({ tipo: "error", texto: "Primero debe existir una empresa para registrar sucursales." });
            return;
        }

        if (!sucursalForm.nombre.trim()) {
            setMensaje({ tipo: "error", texto: "Ingresa el nombre de la sucursal." });
            return;
        }

        setGuardandoSucursal(true);
        try {
            const payload = {
                nombre: sucursalForm.nombre,
                telefono: sucursalForm.telefono,
                correo: sucursalForm.correo,
                activo: sucursalForm.activo,
            };

            const res = sucursalForm.id
                ? await actualizarSucursalEmpresa(empresa.id, sucursalForm.id, payload)
                : await crearSucursalEmpresa(empresa.id, payload);

            if (res.ok) {
                setMensaje({
                    tipo: "success",
                    texto: sucursalForm.id
                        ? "Sucursal actualizada correctamente. En el login solo saldrán las activas."
                        : "Sucursal creada correctamente. Ya quedará disponible en el login si está activa.",
                });
                resetSucursalForm();
                await cargarSucursales(empresa.id);
            } else {
                setMensaje({ tipo: "error", texto: res.mensaje || "No se pudo guardar la sucursal." });
            }
        } catch (error) {
            console.error("Error al guardar sucursal:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al guardar la sucursal." });
        } finally {
            setGuardandoSucursal(false);
        }
    };

    const editarSucursal = (sucursal) => {
        setSucursalForm({
            id: sucursal.id,
            nombre: sucursal.nombre || "",
            telefono: sucursal.telefono || "",
            correo: sucursal.correo || "",
            activo: sucursal.activo ?? true,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Empresa</h2>
                    <p>Configura los datos administrativos del negocio y registra las sucursales que luego aparecerán en el login como opciones operativas.</p>
                </div>
                <div className="hero-actions">
                    <div className="pill">{empresa?.nit || "Sin NIT"}</div>
                    <div className="pill">{resumenSucursales.activas} sucursal(es) activas</div>
                </div>
            </section>

            {mensaje.texto && <div className={`alert ${mensaje.tipo === "success" ? "success" : "error"}`}>{mensaje.texto}</div>}

            <div className="summary-grid">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h3>Datos generales</h3>
                            <p>Actualiza la información principal de la empresa sin tocar la base manualmente.</p>
                        </div>
                    </div>

                    <form className="page-stack" onSubmit={handleSubmit}>
                        <div className="form-grid three">
                            <div className="app-field full">
                                <label>Nombre</label>
                                <input name="nombre" value={form.nombre} onChange={handleChange} />
                            </div>
                            <div className="app-field">
                                <label>Nombre comercial</label>
                                <input name="nombre_comercial" value={form.nombre_comercial} onChange={handleChange} />
                            </div>
                            <div className="app-field">
                                <label>NIT</label>
                                <input name="nit" value={form.nit} onChange={handleChange} />
                            </div>
                            <div className="app-field">
                                <label>NRC</label>
                                <input name="nrc" value={form.nrc} onChange={handleChange} />
                            </div>
                            <div className="app-field">
                                <label>Teléfono</label>
                                <input name="telefono" value={form.telefono} onChange={handleChange} />
                            </div>
                            <div className="app-field">
                                <label>Correo</label>
                                <input type="email" name="correo" value={form.correo} onChange={handleChange} />
                            </div>
                            <div className="app-field full">
                                <label>URL del logo</label>
                                <input name="logo_url" value={form.logo_url} onChange={handleChange} placeholder="https://..." />
                            </div>
                        </div>

                        <div className="check-row">
                            <label className="check-pill">
                                <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} />
                                Empresa activa
                            </label>
                        </div>

                        <div className="button-row">
                            <button type="submit" className="btn btn-primary">Guardar cambios</button>
                        </div>
                    </form>
                </section>

                <aside className="summary-card">
                    <h3>Vista previa</h3>
                    <div className="page-stack">
                        <div className="logo-preview">
                            {form.logo_url ? <img src={form.logo_url} alt="Logo empresa" /> : <span>Sin logo</span>}
                        </div>
                        <div className="summary-list">
                            <div className="summary-line"><span>Nombre</span><strong>{form.nombre || "-"}</strong></div>
                            <div className="summary-line"><span>Comercial</span><strong>{form.nombre_comercial || "-"}</strong></div>
                            <div className="summary-line"><span>NIT</span><strong>{form.nit || "-"}</strong></div>
                            <div className="summary-line"><span>Correo</span><strong>{form.correo || "-"}</strong></div>
                            <div className="summary-line total"><span>Sucursales activas</span><strong>{resumenSucursales.activas}</strong></div>
                        </div>
                    </div>
                </aside>
            </div>

            <div className="summary-grid">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h3>{sucursalForm.id ? "Editar sucursal" : "Registrar sucursal"}</h3>
                            <p>Las sucursales activas se mostrarán automáticamente en el login.</p>
                        </div>
                        {sucursalForm.id && (
                            <button type="button" className="btn btn-outline btn-small" onClick={resetSucursalForm}>Cancelar edición</button>
                        )}
                    </div>

                    <form className="page-stack" onSubmit={handleGuardarSucursal}>
                        <div className="form-grid two">
                            <div className="app-field">
                                <label>Nombre de la sucursal</label>
                                <input name="nombre" value={sucursalForm.nombre} onChange={handleSucursalChange} placeholder="Ej: Casa Matriz, Santa Ana, San Miguel" />
                            </div>
                            <div className="app-field">
                                <label>Teléfono</label>
                                <input name="telefono" value={sucursalForm.telefono} onChange={handleSucursalChange} placeholder="Opcional" />
                            </div>
                            <div className="app-field">
                                <label>Correo</label>
                                <input type="email" name="correo" value={sucursalForm.correo} onChange={handleSucursalChange} placeholder="Opcional" />
                            </div>
                            <div className="app-field">
                                <label>Estado</label>
                                <select name="activo" value={String(sucursalForm.activo)} onChange={(e) => setSucursalForm((prev) => ({ ...prev, activo: e.target.value === "true" }))}>
                                    <option value="true">Activa</option>
                                    <option value="false">Inactiva</option>
                                </select>
                            </div>
                        </div>

                        <div className="button-row">
                            <button type="submit" className="btn btn-primary" disabled={guardandoSucursal}>
                                {guardandoSucursal ? "Guardando..." : sucursalForm.id ? "Actualizar sucursal" : "Guardar sucursal"}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={resetSucursalForm}>Limpiar</button>
                        </div>
                    </form>
                </section>

                <aside className="summary-card">
                    <h3>Resumen de sucursales</h3>
                    <div className="summary-list">
                        <div className="summary-line"><span>Total registradas</span><strong>{resumenSucursales.total}</strong></div>
                        <div className="summary-line"><span>Activas</span><strong>{resumenSucursales.activas}</strong></div>
                        <div className="summary-line"><span>Inactivas</span><strong>{resumenSucursales.inactivas}</strong></div>
                    </div>
                    <p className="helper" style={{ marginTop: 16 }}>
                        Cuando una sucursal esté inactiva dejará de mostrarse en el login. Si solo tienes una activa, solo esa aparecerá para iniciar sesión.
                    </p>
                </aside>
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h3>Sucursales registradas</h3>
                        <p>Administra las sedes que la empresa tendrá disponibles para operar.</p>
                    </div>
                </div>

                <div className="table-wrap">
                    <table className="app-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Sucursal</th>
                                <th>Contacto</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sucursales.length === 0 ? (
                                <tr>
                                    <td colSpan="5">
                                        <div className="empty-state" style={{ boxShadow: "none", border: "none", padding: 24 }}>
                                            No hay sucursales registradas todavía.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sucursales.map((sucursal) => (
                                    <tr key={sucursal.id}>
                                        <td>{sucursal.id}</td>
                                        <td>
                                            <div className="table-title">{sucursal.nombre}</div>
                                            <div className="table-subtitle">Empresa #{sucursal.empresa_id}</div>
                                        </td>
                                        <td>
                                            <div>{sucursal.telefono || "Sin teléfono"}</div>
                                            <div className="table-subtitle">{sucursal.correo || "Sin correo"}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${sucursal.activo ? "success" : "warning"}`}>
                                                {sucursal.activo ? "Activa" : "Inactiva"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="inline-actions">
                                                <button type="button" className="btn btn-outline btn-small" onClick={() => editarSucursal(sucursal)}>
                                                    Editar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

export default Empresa;
