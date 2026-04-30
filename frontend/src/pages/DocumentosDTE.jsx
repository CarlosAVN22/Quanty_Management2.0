import { useEffect, useMemo, useState } from "react";
import {
    obtenerDocumentosDTE,
    obtenerDocumentoDTEDetalle,
    enviarDTE,
} from "../services/dteService";
import FacturaPreviewModal from "../components/FacturaPreviewModal";

const badgePorEstado = (estado) => {
    if (estado === "PROCESADO") return "success";
    if (estado === "PENDIENTE") return "warning";
    if (estado === "ENVIADO") return "info";
    if (estado === "RECHAZADO") return "danger";
    return "neutral";
};

function DocumentosDTE() {
    const [docs, setDocs] = useState([]);
    const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
    const [procesandoId, setProcesandoId] = useState(null);
    const [previewFactura, setPreviewFactura] = useState(null);
    const [cargandoPreviewId, setCargandoPreviewId] = useState(null);
    const [busqueda, setBusqueda] = useState("");

    const cargar = async () => {
        try {
            const res = await obtenerDocumentosDTE();
            setDocs(res.data || []);
        } catch (error) {
            console.error("Error al cargar DTE:", error);
            setMensaje({ tipo: "error", texto: "No se pudieron cargar los documentos DTE." });
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const handleEnviar = async (id) => {
        setMensaje({ tipo: "", texto: "" });
        setProcesandoId(id);
        try {
            const res = await enviarDTE(id);
            if (res.ok) {
                setMensaje({ tipo: "success", texto: `Documento procesado correctamente en flujo local. Estado final: ${res.data?.estado || "actualizado"}.` });
                await cargar();
            } else {
                setMensaje({ tipo: "error", texto: res.mensaje || "No se pudo procesar el DTE." });
            }
        } catch (error) {
            console.error("Error al procesar DTE:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al procesar el documento." });
        } finally {
            setProcesandoId(null);
        }
    };

    const handleVerFactura = async (id) => {
        setMensaje({ tipo: "", texto: "" });
        setCargandoPreviewId(id);
        try {
            const res = await obtenerDocumentoDTEDetalle(id);
            if (res.ok) {
                setPreviewFactura(res.data);
            } else {
                setMensaje({ tipo: "error", texto: res.mensaje || "No se pudo abrir la factura." });
            }
        } catch (error) {
            console.error("Error al abrir factura:", error);
            setMensaje({ tipo: "error", texto: "Ocurrió un error al abrir la factura." });
        } finally {
            setCargandoPreviewId(null);
        }
    };

    const resumen = useMemo(() => ({
        pendientes: docs.filter((item) => item.estado === "PENDIENTE").length,
        enviados: docs.filter((item) => item.estado === "ENVIADO").length,
        procesados: docs.filter((item) => item.estado === "PROCESADO").length,
    }), [docs]);

    const docsFiltrados = useMemo(() => {
        const filtro = busqueda.trim().toLowerCase();
        if (!filtro) return docs;

        return docs.filter((doc) => [
            doc.numero_control,
            doc.tipo_dte,
            doc.cliente,
            doc.estado,
            doc.codigo_respuesta,
        ].join(" ").toLowerCase().includes(filtro));
    }, [docs, busqueda]);

    return (
        <div className="page-stack">
            <section className="hero-card">
                <div>
                    <h2>Documentos DTE</h2>
                    <p>
                        Aquí controlas los comprobantes generados por ventas, los procesas en flujo local y abres la representación gráfica dentro del sistema para imprimirla o guardarla como PDF.
                    </p>
                </div>
                <div className="hero-actions">
                    <div className="pill">{resumen.pendientes} pendientes</div>
                    <div className="pill">{resumen.procesados} procesados</div>
                </div>
            </section>

            {mensaje.texto && <div className={`alert ${mensaje.tipo === "success" ? "success" : "error"}`}>{mensaje.texto}</div>}

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h3>Control documental</h3>
                        <p>La vista de factura ya no depende de pop-ups del navegador y el procesamiento intenta respetar los estados permitidos por tu base.</p>
                    </div>
                    <input
                        className="search-input"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por número, cliente, tipo o estado"
                    />
                </div>

                {docsFiltrados.length === 0 ? (
                    <div className="empty-state">No hay documentos DTE registrados.</div>
                ) : (
                    <div className="table-wrap">
                        <table className="app-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Documento</th>
                                    <th>Cliente</th>
                                    <th>Fechas</th>
                                    <th>Total</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docsFiltrados.map((doc) => (
                                    <tr key={doc.id}>
                                        <td>{doc.id}</td>
                                        <td>
                                            <div className="table-title">{doc.numero_control}</div>
                                            <div className="table-subtitle">Tipo DTE: {doc.tipo_dte} · Venta #{doc.venta_id}</div>
                                        </td>
                                        <td>{doc.cliente}</td>
                                        <td>
                                            <div className="table-title">Emisión: {new Date(doc.fecha_emision).toLocaleString("es-SV")}</div>
                                            <div className="table-subtitle">Envío: {doc.fecha_envio ? new Date(doc.fecha_envio).toLocaleString("es-SV") : "Pendiente"}</div>
                                        </td>
                                        <td>${Number(doc.total).toFixed(2)}</td>
                                        <td>
                                            <div className="inline-actions wrap">
                                                <span className={`badge ${badgePorEstado(doc.estado)}`}>{doc.estado}</span>
                                                {doc.codigo_respuesta && <span className="badge neutral">Resp. {doc.codigo_respuesta}</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="inline-actions wrap">
                                                <button className="btn btn-small btn-primary" onClick={() => handleVerFactura(doc.id)} disabled={cargandoPreviewId === doc.id}>
                                                    {cargandoPreviewId === doc.id ? "Abriendo..." : "Ver factura"}
                                                </button>
                                                {(doc.estado === "PENDIENTE" || doc.estado === "ENVIADO") ? (
                                                    <button className="btn btn-small btn-success" disabled={procesandoId === doc.id} onClick={() => handleEnviar(doc.id)}>
                                                        {procesandoId === doc.id ? "Procesando..." : "Procesar"}
                                                    </button>
                                                ) : (
                                                    <span className="badge success">Listo</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <FacturaPreviewModal
                abierto={Boolean(previewFactura)}
                payload={previewFactura}
                onClose={() => setPreviewFactura(null)}
                titulo="Representación gráfica del DTE"
            />
        </div>
    );
}

export default DocumentosDTE;
