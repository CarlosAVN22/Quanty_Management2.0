import { useEffect, useMemo, useState } from "react";
import { obtenerClientes, crearCliente, actualizarCliente, eliminarCliente } from "../services/clienteService";
import { canAccess } from "../utils/auth";

const formularioInicial = {
    nombres: "",
    apellidos: "",
    nombre_comercial: "",
    documento: "",
    nit: "",
    nrc: "",
    telefono: "",
    correo: "",
    activo: true,
};

function Clientes() {
    const [clientes, setClientes] = useState([]);
    const [formulario, setFormulario] = useState(formularioInicial);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [clienteEditandoId, setClienteEditandoId] = useState(null);
    const [busqueda, setBusqueda] = useState("");
    const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
    const puedeCrear = canAccess("clientesCrear");
    const puedeEditar = canAccess("clientesEditar");
    const puedeEliminar = canAccess("clientesEliminar");

    const cargarClientes = async () => {
        try {
            const respuesta = await obtenerClientes();
            setClientes(respuesta.data || []);
        } catch (error) {
            console.error(error);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar los clientes." });
        }
    };

    useEffect(() => {
        cargarClientes();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormulario((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    };

    const limpiarFormulario = () => {
        setFormulario(formularioInicial);
        setModoEdicion(false);
        setClienteEditandoId(null);
    };

    const validarSoloLetras = (texto) => {
        if (!texto) return true;
        // Permite letras, acentos, ñ y espacios. Bloquea números y símbolos.
        return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(texto);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!puedeCrear && !modoEdicion) return;
        if (!puedeEditar && modoEdicion) return;
        setMensaje({ tipo: "", texto: "" });

        if (!validarSoloLetras(formulario.nombres) || !validarSoloLetras(formulario.apellidos)) {
            setMensaje({ tipo: "error", texto: "Los nombres y apellidos solo pueden contener letras. No se permiten números ni símbolos." });
            return;
        }

        try {
            // Combinamos nombres y apellidos temporalmente si el backend aún usa un solo campo 'nombre', 
            // o lo enviamos separado si el backend ya fue actualizado.
            const payload = {
                ...formulario,
                nombre: `${formulario.nombres} ${formulario.apellidos}`.trim()
            };

            const respuesta = modoEdicion
                ? await actualizarCliente(clienteEditandoId, payload)
                : await crearCliente(payload);

            if (respuesta.ok) {
                setMensaje({ tipo: "success", texto: modoEdicion ? "Cliente actualizado correctamente." : "Cliente creado correctamente." });
                limpiarFormulario();
                cargarClientes();
            } else {
                setMensaje({ tipo: "error", texto: respuesta.mensaje || "No se pudo guardar el cliente." });
            }
        } catch (error) {
            console.error(error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al guardar el cliente." });
        }
    };

    const handleEditar = (cliente) => {
        if (!puedeEditar) return;
        setModoEdicion(true);
        setClienteEditandoId(cliente.id);
        
        // Lógica temporal para dividir si el backend aún envía un solo string
        const partesNombre = (cliente.nombre || "").split(" ");
        const nombresTemp = partesNombre.slice(0, Math.ceil(partesNombre.length / 2)).join(" ");
        const apellidosTemp = partesNombre.slice(Math.ceil(partesNombre.length / 2)).join(" ");

        setFormulario({
            nombres: cliente.nombres || nombresTemp,
            apellidos: cliente.apellidos || apellidosTemp,
            nombre_comercial: cliente.nombre_comercial || "",
            documento: cliente.documento || "",
            nit: cliente.nit || "",
            nrc: cliente.nrc || "",
            telefono: cliente.telefono || "",
            correo: cliente.correo || "",
            activo: Boolean(cliente.activo),
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleEliminar = async (id) => {
        if (!puedeEliminar) return;
        const confirmar = window.confirm("¿Eliminar este cliente?");
        if (!confirmar) return;

        try {
            const respuesta = await eliminarCliente(id);
            if (respuesta.ok) {
                setMensaje({ tipo: "success", texto: "Cliente eliminado correctamente." });
                cargarClientes();
            } else {
                setMensaje({ tipo: "error", texto: respuesta.mensaje || "No se pudo eliminar el cliente." });
            }
        } catch (error) {
            console.error(error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al eliminar el cliente." });
        }
    };

    const clientesFiltrados = useMemo(() => {
        const filtro = busqueda.trim().toLowerCase();
        if (!filtro) return clientes;
        return clientes.filter((cliente) =>
            [cliente.id, cliente.nombre, cliente.nombre_comercial, cliente.documento, cliente.nit, cliente.telefono, cliente.correo]
                .join(" ")
                .toLowerCase()
                .includes(filtro)
        );
    }, [clientes, busqueda]);

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Clientes</h2>
                    <p>Busca clientes fácilmente por su ID, nombre o documento sin necesidad de memorizarlos.</p>
                </div>
                <div className="hero-actions"><div className="pill">{clientes.length} cliente(s)</div></div>
            </section>

            {mensaje.texto && <div className={`alert ${mensaje.tipo === "success" ? "success" : "error"}`}>{mensaje.texto}</div>}

            {puedeCrear || modoEdicion ? (
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h3>{modoEdicion ? "Editar cliente" : "Nuevo cliente"}</h3>
                            <p>Ingresa los datos. Nombres y apellidos no pueden contener números ni caracteres especiales.</p>
                        </div>
                    </div>

                    <form className="page-stack" onSubmit={handleSubmit}>
                        <div className="form-grid two">
                            <div className="app-field"><label>Nombres</label><input name="nombres" value={formulario.nombres} onChange={handleChange} required placeholder="Ej: Juan Carlos" /></div>
                            <div className="app-field"><label>Apellidos</label><input name="apellidos" value={formulario.apellidos} onChange={handleChange} required placeholder="Ej: Pérez Gómez" /></div>
                            <div className="app-field full"><label>Nombre comercial</label><input name="nombre_comercial" value={formulario.nombre_comercial} onChange={handleChange} placeholder="Empresa S.A. de C.V." /></div>
                            <div className="app-field"><label>Documento (DUI/Pasaporte)</label><input name="documento" value={formulario.documento} onChange={handleChange} /></div>
                            <div className="app-field"><label>NIT</label><input name="nit" value={formulario.nit} onChange={handleChange} /></div>
                            <div className="app-field"><label>NRC</label><input name="nrc" value={formulario.nrc} onChange={handleChange} /></div>
                            <div className="app-field"><label>Teléfono</label><input name="telefono" value={formulario.telefono} onChange={handleChange} /></div>
                            <div className="app-field full"><label>Correo</label><input type="email" name="correo" value={formulario.correo} onChange={handleChange} /></div>
                        </div>

                        <div className="check-row"><label className="check-pill"><input type="checkbox" name="activo" checked={formulario.activo} onChange={handleChange} />Cliente activo</label></div>

                        <div className="button-row">
                            <button type="submit" className="btn btn-primary">{modoEdicion ? "Actualizar cliente" : "Guardar cliente"}</button>
                            {modoEdicion && <button type="button" className="btn btn-secondary" onClick={limpiarFormulario}>Cancelar edición</button>}
                        </div>
                    </form>
                </section>
            ) : (
                <div className="alert info">Tu rol puede consultar clientes, pero no crear, editar ni eliminar registros.</div>
            )}

            <section className="panel">
                <div className="toolbar">
                    <div><h3>Listado de clientes</h3><p className="muted">Busca por ID, nombre, documento, NIT o correo.</p></div>
                    <input className="search-input" placeholder="Buscar cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>

                {clientesFiltrados.length === 0 ? (
                    <div className="empty-state">No hay clientes para mostrar.</div>
                ) : (
                    <div className="table-wrap">
                        <table className="app-table">
                            <thead><tr><th>ID</th><th>Cliente</th><th>Documento</th><th>Contacto</th><th>Estado</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {clientesFiltrados.map((cliente) => (
                                    <tr key={cliente.id}>
                                        <td><strong>#{cliente.id}</strong></td>
                                        <td><div className="table-title">{cliente.nombre}</div><div className="table-subtitle">{cliente.nombre_comercial || "Sin nombre comercial"}</div></td>
                                        <td><div>{cliente.documento || "-"}</div><div className="table-subtitle">NIT: {cliente.nit || "-"} · NRC: {cliente.nrc || "-"}</div></td>
                                        <td><div>{cliente.telefono || "-"}</div><div className="table-subtitle">{cliente.correo || "Sin correo"}</div></td>
                                        <td><span className={`badge ${cliente.activo ? "success" : "danger"}`}>{cliente.activo ? "Activo" : "Inactivo"}</span></td>
                                        <td>
                                            <div className="inline-actions wrap">
                                                {puedeEditar && <button className="btn btn-small btn-outline" onClick={() => handleEditar(cliente)}>Editar</button>}
                                                {puedeEliminar && <button className="btn btn-small btn-danger" onClick={() => handleEliminar(cliente.id)}>Eliminar</button>}
                                                {!puedeEditar && !puedeEliminar && <span className="badge neutral">Solo lectura</span>}
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

export default Clientes;