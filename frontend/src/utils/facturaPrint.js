const formatearDinero = (valor) => Number(valor || 0).toFixed(2);

const escapar = (texto) => String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const nombreTipoDte = (codigo) => {
    const mapa = {
        "01": "Factura",
        "03": "Comprobante de crédito fiscal",
        "04": "Nota de remisión",
        "05": "Nota de crédito",
        "06": "Nota de débito",
        "07": "Comprobante de retención",
        "08": "Comprobante de liquidación",
        "09": "Documento contable de liquidación",
        "11": "Factura de exportación",
        "14": "Factura de sujeto excluido",
        "15": "Comprobante de donación",
    };

    return mapa[codigo] || `Documento ${codigo}`;
};

const labelsResumen = {
    totalGravada: "Total gravadas",
    totalDescu: "Total descuento",
    totalExenta: "Total exentas",
    totalNoSuj: "Total no sujetas",
    subTotal: "Sub total",
    totalIva: "IVA",
    ivaPerci1: "IVA percibido",
    ivaRete1: "IVA retenido",
    totalPagar: "Total a pagar",
};

export const construirHtmlFactura = (payload, qrDataUrl = "") => {
    const documento = payload?.documento || {};
    const detalle = payload?.detalle || [];
    const pagos = payload?.pagos || [];
    const envios = payload?.envios || [];
    const primerPago = pagos[0];
    const plantilla = payload?.plantilla || {};
    const resumen = documento?.json_dte?.resumen || {};
    const camposResumen = plantilla?.resumen_campos || ["subTotal", "totalPagar"];
    const qrUrl = payload?.qr_consulta_url || documento?.json_dte?.qr?.consultaUrl || "";

    const empresa = {
        nombre: documento.empresa_nombre_comercial || documento.empresa_nombre,
        razon: documento.empresa_nombre,
        nit: documento.empresa_nit,
        nrc: documento.empresa_nrc,
        telefono: documento.empresa_telefono,
        correo: documento.empresa_correo,
        logo: documento.empresa_logo_url,
        sucursal: documento?.json_dte?.identificacion?.sucursal || "-",
    };

    const cliente = {
        nombre: documento.cliente_nombre_comercial || documento.cliente_nombre,
        razon: documento.cliente_nombre,
        documento: documento.cliente_documento,
        nit: documento.cliente_nit,
        nrc: documento.cliente_nrc,
        telefono: documento.cliente_telefono,
        correo: documento.cliente_correo,
    };

    const filas = detalle.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <strong>${escapar(item.producto_nombre)}</strong><br>
                <span class="muted">${escapar(item.producto_codigo || "")}</span>
            </td>
            <td>${Number(item.cantidad || 0).toFixed(2)}</td>
            <td>$${formatearDinero(item.precio_unitario)}</td>
            <td>$${formatearDinero(item.subtotal)}</td>
        </tr>
    `).join("");

    const pagosHtml = pagos.length === 0
        ? `<div class="notice">Venta sin pago registrado al momento de emitir el documento.</div>`
        : pagos.map((pago) => `
            <div class="pay-row">
                <div>
                    <strong>${escapar(pago.metodo_nombre || pago.metodo_codigo || "Pago")}</strong>
                    <div class="muted">${escapar(pago.referencia_externa || pago.autorizacion || pago.estado || "")}</div>
                </div>
                <div class="pay-amount">$${formatearDinero(pago.monto)}</div>
            </div>
        `).join("");

    const lineaProceso = envios.length === 0
        ? `<div class="notice">Documento aún no enviado en el flujo local.</div>`
        : envios.map((envio) => `
            <div class="process-row">
                <div>
                    <strong>${escapar(envio.estado || "Sin estado")}</strong>
                    <div class="muted">${envio.fecha_envio ? new Date(envio.fecha_envio).toLocaleString("es-SV") : "Sin fecha"}</div>
                </div>
                <div class="process-meta">${escapar(envio.codigo_respuesta || envio.mensaje || "")}</div>
            </div>
        `).join("");

    const resumenHtml = camposResumen.map((campo) => `
        <div class="sum-row ${campo === "totalPagar" ? "total" : ""}">
            <span>${labelsResumen[campo] || campo}</span>
            <strong>$${formatearDinero(resumen[campo])}</strong>
        </div>
    `).join("");

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapar(documento.numero_control || "Factura")}</title>
<style>
    :root {
        --primary: #1a3f6f;
        --accent: #214e85;
        --border: #d7deea;
        --soft: #f5f7fb;
        --text: #172033;
        --muted: #60708b;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #eef2f8; color: var(--text); }
    .page { max-width: 980px; margin: 24px auto; background:white; border:1px solid var(--border); border-radius: 22px; overflow:hidden; box-shadow:0 16px 40px rgba(23,32,51,.08); }
    .header { padding: 28px; display:grid; grid-template-columns: 1.2fr 1fr; gap:22px; border-bottom:1px solid var(--border); }
    .company { display:flex; gap:16px; }
    .logo { width:96px; height:96px; border-radius:18px; border:1px solid var(--border); background: var(--soft); overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--muted); text-align:center; padding:8px; }
    .logo img { width:100%; height:100%; object-fit:contain; }
    .company h2 { margin:0 0 8px; font-size:24px; color:var(--primary); }
    .company p, .meta p { margin:4px 0; }
    .meta { background: var(--soft); border:1px solid var(--border); border-radius:18px; padding:18px; }
    .badge { display:inline-flex; align-items:center; padding:7px 12px; border-radius:999px; background:#e7eef8; color:var(--primary); font-weight:700; font-size:12px; margin-bottom:12px; }
    .grid { padding: 22px 28px; display:grid; grid-template-columns:1fr 1fr; gap:18px; border-bottom:1px solid var(--border); }
    .box { border:1px solid var(--border); border-radius:18px; padding:18px; background:#fff; }
    .box h3, .summary-card h3 { margin:0 0 12px; font-size:16px; color:var(--primary); }
    .muted { color: var(--muted); font-size: 12px; }
    .table-wrap { padding: 0 28px 22px; }
    table { width:100%; border-collapse:collapse; }
    th, td { padding: 12px 10px; border-bottom:1px solid var(--border); text-align:left; vertical-align:top; }
    th { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color: var(--muted); }
    .summary { padding: 0 28px 28px; display:grid; grid-template-columns: 1.05fr .95fr; gap:18px; }
    .summary-card { border:1px solid var(--border); border-radius:18px; padding:18px; background:#fff; }
    .sum-row, .pay-row, .process-row { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px dashed #dce4f2; }
    .sum-row:last-child, .pay-row:last-child, .process-row:last-child { border-bottom:none; }
    .sum-row.total { font-size:20px; font-weight:800; color:var(--primary); }
    .pay-amount, .process-meta { font-weight:800; }
    .notice { padding:14px; background:#f8fafc; border:1px dashed var(--border); border-radius:14px; color:var(--muted); }
    .footer { padding: 0 28px 28px; color: var(--muted); font-size: 12px; }
    .legend { margin-top: 10px; font-size: 12px; color: var(--muted); }
    .ribbon { background: linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%); color: white; padding: 12px 28px; font-weight: 700; font-size: 13px; letter-spacing: .02em; }
    .qr-box { display:flex; align-items:center; gap:16px; margin-top:18px; padding-top:18px; border-top:1px solid var(--border); }
    .qr-box img { width:120px; height:120px; border:1px solid var(--border); border-radius:12px; }
    .tiny { word-break: break-all; font-size: 11px; color: var(--muted); }
    @media print {
        body { background:white; }
        .page { margin:0; border:none; box-shadow:none; border-radius:0; max-width:none; }
    }
</style>
</head>
<body>
    <div class="page">
        <div class="ribbon">Representación gráfica local del DTE · Quanty Management</div>
        <div class="header">
            <div class="company">
                <div class="logo">${empresa.logo ? `<img src="${escapar(empresa.logo)}" alt="Logo empresa">` : "Logo<br>empresa"}</div>
                <div>
                    <h2>${escapar(empresa.nombre || "Empresa")}</h2>
                    <p><strong>Razón social:</strong> ${escapar(empresa.razon || empresa.nombre || "-")}</p>
                    <p><strong>NIT:</strong> ${escapar(empresa.nit || "-")} · <strong>NRC:</strong> ${escapar(empresa.nrc || "-")}</p>
                    <p><strong>Sucursal:</strong> ${escapar(empresa.sucursal || "-")}</p>
                    <p><strong>Tel:</strong> ${escapar(empresa.telefono || "-")} · <strong>Correo:</strong> ${escapar(empresa.correo || "-")}</p>
                </div>
            </div>
            <div class="meta">
                <div class="badge">${escapar(nombreTipoDte(documento.tipo_dte))}</div>
                <p><strong>Número de control:</strong> ${escapar(documento.numero_control || "-")}</p>
                <p><strong>Código de generación:</strong> ${escapar(documento.codigo_generacion || "-")}</p>
                <p><strong>Fecha emisión:</strong> ${new Date(documento.fecha_emision || documento.venta_fecha || Date.now()).toLocaleString("es-SV")}</p>
                <p><strong>Estado DTE:</strong> ${escapar(documento.estado || "-")}</p>
                <p><strong>Ambiente:</strong> ${escapar(documento?.json_dte?.identificacion?.ambienteNombre || payload?.ambiente || "TEST")}</p>
                ${documento.sello_recibido ? `<p><strong>Sello:</strong> ${escapar(documento.sello_recibido)}</p>` : ""}
            </div>
        </div>

        <div class="grid">
            <div class="box">
                <h3>Receptor / Cliente</h3>
                <p><strong>${escapar(cliente.nombre || "Consumidor final")}</strong></p>
                <p><strong>Razón social:</strong> ${escapar(cliente.razon || cliente.nombre || "-")}</p>
                <p><strong>Documento:</strong> ${escapar(cliente.documento || "-")}</p>
                <p><strong>NIT:</strong> ${escapar(cliente.nit || "-")} · <strong>NRC:</strong> ${escapar(cliente.nrc || "-")}</p>
                <p><strong>Tel:</strong> ${escapar(cliente.telefono || "-")} · <strong>Correo:</strong> ${escapar(cliente.correo || "-")}</p>
            </div>
            <div class="box">
                <h3>Datos complementarios</h3>
                <p><strong>Tipo DTE:</strong> ${escapar(documento.tipo_dte || "-")} · ${escapar(nombreTipoDte(documento.tipo_dte))}</p>
                <p><strong>JSON:</strong> ${escapar(plantilla.schema_archivo || documento?.json_dte?.identificacion?.plantillaJson || "-")}</p>
                <p><strong>Venta:</strong> #${escapar(documento.venta_id || "-")}</p>
                <p><strong>Observación:</strong> ${escapar(documento.observacion || "Sin observación")}</p>
                <p><strong>Pago principal:</strong> ${escapar(primerPago?.metodo_nombre || "Pendiente")}</p>
            </div>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas || `<tr><td colspan="5">Sin detalle de productos.</td></tr>`}
                </tbody>
            </table>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Pagos registrados</h3>
                ${pagosHtml}
                <div style="height:16px"></div>
                <h3>Proceso del documento</h3>
                ${lineaProceso}
                <div class="qr-box">
                    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR DTE">` : `<div class="notice">QR no disponible</div>`}
                    <div>
                        <strong>Consulta DTE / QR</strong>
                        <div class="muted">Se genera con el ambiente local del documento.</div>
                        <div class="tiny">${escapar(qrUrl)}</div>
                    </div>
                </div>
            </div>
            <div class="summary-card">
                ${resumenHtml}
            </div>
        </div>

        <div class="footer">
            Esta es una representación gráfica local del DTE generada por Quanty Management para pruebas, impresión interna y preparación de integración futura con Hacienda.
        </div>
    </div>
</body>
</html>`;
};
