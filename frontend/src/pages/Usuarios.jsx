import { useEffect, useMemo, useState } from "react";
import {
    obtenerRoles,
    obtenerUsuarios,
    crearUsuario,
    actualizarUsuario,
    cambiarEstadoUsuario,
} from "../services/usuarioService";

const formularioInicial = {
    username: "",
    password: "",
    nombre_completo: "",
    correo: "",
    rol_id: "",
    activo: true,
};

function Usuarios() {
    const [roles, setRoles] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [formulario, setFormulario] = useState(formularioInicial);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [usuarioEditandoId, setUsuarioEditandoId] = useState(null);
    const [busqueda, setBusqueda] = useState("");
    const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

    const cargarTodo = async () => {
        try {
            const [rolesRes, usuariosRes] = await Promise.all([
                obtenerRoles(),
                obtenerUsuarios(),
            ]);

            const listaRoles = rolesRes.data || [];
            setRoles(listaRoles);
            setUsuarios(usuariosRes.data || []);

            if (!modoEdicion) {
                setFormulario((prev) => ({
                    ...prev,
                    rol_id: prev.rol_id || String(listaRoles[0]?.id || ""),
                }));
            }
        } catch (error) {
            console.error("Error al cargar usuarios:", error);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar usuarios y roles." });
        }
    };

    useEffect(() => {
        cargarTodo();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormulario((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const limpiarFormulario = () => {
        setFormulario({
            ...formularioInicial,
            rol_id: String(roles[0]?.id || ""),
        });
        setModoEdicion(false);
        setUsuarioEditandoId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: "", texto: "" });

        const payload = {
            ...formulario,
            rol_id: Number(formulario.rol_id),
            activo: Boolean(formulario.activo),
        };

        try {
            const respuesta = modoEdicion
                ? await actualizarUsuario(usuarioEditandoId, payload)
                : await crearUsuario(payload);

            if (respuesta.ok) {
                setMensaje({ tipo: "success", texto: modoEdicion ? "Usuario actualizado correctamente." : "Usuario creado correctamente." });
                limpiarFormulario();
                cargarTodo();
            } else {
                setMensaje({ tipo: "error", texto: respuesta.mensaje || "No se pudo guardar el usuario." });
            }
        } catch (error) {
            console.error("Error al guardar usuario:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al guardar el usuario." });
        }
    };

    const cargarEdicion = (usuario) => {
        setModoEdicion(true);
        setUsuarioEditandoId(usuario.id);
        setFormulario({
            username: usuario.username || "",
            password: usuario.password || "",
            nombre_completo: usuario.nombre_completo || "",
            correo: usuario.correo || "",
            rol_id: String(usuario.rol_id || ""),
            activo: Boolean(usuario.activo),
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const toggleEstado = async (id) => {
        try {
            const res = await cambiarEstadoUsuario(id);
            if (res.ok) {
                setMensaje({ tipo: "success", texto: "Estado del usuario actualizado correctamente." });
                cargarTodo();
            } else {
                setMensaje({ tipo: "error", texto: res.mensaje || "No se pudo cambiar el estado." });
            }
        } catch (error) {
            console.error("Error al cambiar estado:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al cambiar el estado del usuario." });
        }
    };

    const usuariosFiltrados = useMemo(() => {
        const filtro = busqueda.trim().toLowerCase();
        if (!filtro) return usuarios;

        return usuarios.filter((usuario) =>
            [usuario.username, usuario.nombre_completo, usuario.correo, usuario.rol_nombre]
                .join(" ")
                .toLowerCase()
                .includes(filtro)
        );
    }, [usuarios, busqueda]);

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Usuarios</h2>
                    <p>Administra cuentas internas, asigna roles y activa o desactiva accesos desde una sola pantalla.</p>
                </div>
                <div className="hero-actions">
                    <div className="pill">{usuarios.length} usuario(s)</div>
                    <div className="pill">{roles.length} rol(es)</div>
                </div>
            </section>

            {mensaje.texto && <div className={`alert ${mensaje.tipo === "success" ? "success" : "error"}`}>{mensaje.texto}</div>}

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h3>{modoEdicion ? "Editar usuario" : "Nuevo usuario"}</h3>
                        <p>Formulario en limpio para administrar usuarios del sistema.</p>
                    </div>
                </div>

                <form className="page-stack" onSubmit={handleSubmit}>
                    <div className="form-grid three">
                        <div className="app-field">
                            <label>Usuario</label>
                            <input name="username" value={formulario.username} onChange={handleChange} required />
                        </div>
                        <div className="app-field">
                            <label>Contraseña</label>
                            <input name="password" value={formulario.password} onChange={handleChange} required />
                        </div>
                        <div className="app-field">
                            <label>Rol</label>
                            <select name="rol_id" value={formulario.rol_id} onChange={handleChange} required>
                                <option value="">Seleccione un rol</option>
                                {roles.map((rol) => (
                                    <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="app-field full">
                            <label>Nombre completo</label>
                            <input name="nombre_completo" value={formulario.nombre_completo} onChange={handleChange} />
                        </div>
                        <div className="app-field full">
                            <label>Correo</label>
                            <input type="email" name="correo" value={formulario.correo} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="check-row">
                        <label className="check-pill">
                            <input type="checkbox" name="activo" checked={formulario.activo} onChange={handleChange} />
                            Usuario activo
                        </label>
                    </div>

                    <div className="button-row">
                        <button type="submit" className="btn btn-primary">
                            {modoEdicion ? "Actualizar usuario" : "Guardar usuario"}
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
                        <h3>Listado de usuarios</h3>
                        <p className="muted">Busca por usuario, nombre, correo o rol.</p>
                    </div>
                    <input className="search-input" placeholder="Buscar usuario" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>

                {usuariosFiltrados.length === 0 ? (
                    <div className="empty-state">No hay usuarios para mostrar.</div>
                ) : (
                    <div className="table-wrap">
                        <table className="app-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Usuario</th>
                                    <th>Nombre</th>
                                    <th>Rol</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuariosFiltrados.map((usuario) => (
                                    <tr key={usuario.id}>
                                        <td>{usuario.id}</td>
                                        <td>
                                            <div className="table-title">{usuario.username}</div>
                                            <div className="table-subtitle">{usuario.correo || "Sin correo"}</div>
                                        </td>
                                        <td>{usuario.nombre_completo || "-"}</td>
                                        <td><span className="badge info">{usuario.rol_nombre}</span></td>
                                        <td><span className={`badge ${usuario.activo ? "success" : "danger"}`}>{usuario.activo ? "Activo" : "Inactivo"}</span></td>
                                        <td>
                                            <div className="inline-actions">
                                                <button className="btn btn-small btn-outline" onClick={() => cargarEdicion(usuario)}>
                                                    Editar
                                                </button>
                                                <button className={`btn btn-small ${usuario.activo ? "btn-danger" : "btn-success"}`} onClick={() => toggleEstado(usuario.id)}>
                                                    {usuario.activo ? "Desactivar" : "Activar"}
                                                </button>
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

export default Usuarios;
