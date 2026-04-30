const pool = require("../config/db");
const { catalogoDteBase, tipoAPlantilla, obtenerQrConsultaUrl, normalizarAmbiente } = require("../utils/dteCatalog");

const obtenerEstadosPermitidosDocumento = async (client) => {
    const result = await client.query(
        `
        SELECT pg_get_constraintdef(c.oid) AS definicion
        FROM pg_constraint c
        INNER JOIN pg_class t ON t.oid = c.conrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'dte'
          AND t.relname = 'documento'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%estado%'
        LIMIT 1
        `
    );

    const definicion = result.rows[0]?.definicion || "";
    const encontrados = [...definicion.matchAll(/'([A-Z_]+)'/g)].map((item) => item[1]);

    if (encontrados.length > 0) {
        return [...new Set(encontrados)];
    }

    return ["PENDIENTE", "ENVIADO", "PROCESADO", "RECHAZADO", "ANULADO"];
};

const resolverEstadoCompatible = (permitidos, preferido, alternativas = []) => {
    if (permitidos.includes(preferido)) return preferido;
    for (const alternativa of alternativas) {
        if (permitidos.includes(alternativa)) return alternativa;
    }
    return null;
};

const asegurarCatalogoTiposDTE = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS dte.tipo_documento_config (
            codigo VARCHAR(10) PRIMARY KEY,
            nombre VARCHAR(120) NOT NULL,
            schema_archivo VARCHAR(120) NOT NULL,
            version_schema VARCHAR(20),
            categoria VARCHAR(30),
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            descripcion VARCHAR(255)
        )
    `);

    for (const item of catalogoDteBase) {
        await client.query(
            `
            INSERT INTO dte.tipo_documento_config
            (codigo, nombre, schema_archivo, version_schema, categoria, activo, descripcion)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (codigo)
            DO UPDATE SET
                nombre = EXCLUDED.nombre,
                schema_archivo = EXCLUDED.schema_archivo,
                version_schema = EXCLUDED.version_schema,
                categoria = EXCLUDED.categoria,
                activo = EXCLUDED.activo,
                descripcion = EXCLUDED.descripcion
            `,
            [
                item.codigo,
                item.nombre,
                item.schema_archivo,
                item.version_schema,
                item.categoria,
                true,
                `Plantilla local vinculada al archivo ${item.schema_archivo}`,
            ]
        );
    }
};

const obtenerTiposDTE = async (req, res) => {
    const client = await pool.connect();
    try {
        await asegurarCatalogoTiposDTE(client);
        const result = await client.query(`
            SELECT codigo, nombre, schema_archivo, version_schema, categoria, activo, descripcion
            FROM dte.tipo_documento_config
            WHERE activo = TRUE
            ORDER BY codigo
        `);

        return res.json({ ok: true, data: result.rows.map((item) => ({ ...item, ...(tipoAPlantilla[item.codigo] || {}) })) });
    } catch (error) {
        console.error("ERROR TIPOS DTE:", error);
        return res.status(500).json({ ok: false, mensaje: "Error al obtener los tipos DTE", error: error.message });
    } finally {
        client.release();
    }
};

const obtenerDocumentosDTE = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                d.id,
                d.venta_id,
                d.tipo_dte,
                d.numero_control,
                d.codigo_generacion,
                d.fecha_emision,
                d.total,
                d.estado,
                d.sello_recibido,
                t.nombre AS cliente,
                env.fecha_envio,
                resp.codigo_respuesta,
                resp.mensaje AS respuesta_mensaje
            FROM dte.documento d
            INNER JOIN terceros.tercero t
                ON t.id = d.receptor_id
            LEFT JOIN LATERAL (
                SELECT e.id, e.fecha_envio, e.estado
                FROM dte.envio e
                WHERE e.documento_id = d.id
                ORDER BY e.id DESC
                LIMIT 1
            ) env ON TRUE
            LEFT JOIN LATERAL (
                SELECT r.codigo_respuesta, r.mensaje, r.fecha_respuesta
                FROM dte.respuesta r
                INNER JOIN dte.envio e2
                    ON e2.id = r.envio_id
                WHERE e2.documento_id = d.id
                ORDER BY r.id DESC
                LIMIT 1
            ) resp ON TRUE
            ORDER BY d.id DESC
        `);

        res.json({ ok: true, mensaje: "Documentos DTE obtenidos correctamente", data: result.rows });
    } catch (error) {
        console.error("ERROR LISTAR DTE:", error);
        res.status(500).json({ ok: false, mensaje: "Error al obtener documentos DTE", error: error.message });
    }
};

const obtenerDocumentoDTEDetalle = async (req, res) => {
    try {
        const { id } = req.params;

        const documentoRes = await pool.query(
            `
            SELECT
                d.id,
                d.venta_id,
                d.tipo_dte,
                d.numero_control,
                d.codigo_generacion,
                d.fecha_emision,
                d.total,
                d.estado,
                d.sello_recibido,
                d.json_dte,
                v.fecha AS venta_fecha,
                v.subtotal,
                v.iva,
                v.descuento,
                v.total AS venta_total,
                v.estado AS venta_estado,
                v.observacion,
                c.id AS cliente_id,
                c.nombre AS cliente_nombre,
                c.nombre_comercial AS cliente_nombre_comercial,
                c.documento AS cliente_documento,
                c.nit AS cliente_nit,
                c.nrc AS cliente_nrc,
                c.telefono AS cliente_telefono,
                c.correo AS cliente_correo,
                e.id AS empresa_id,
                e.nombre AS empresa_nombre,
                e.nombre_comercial AS empresa_nombre_comercial,
                e.nit AS empresa_nit,
                e.nrc AS empresa_nrc,
                e.telefono AS empresa_telefono,
                e.correo AS empresa_correo,
                e.logo_url AS empresa_logo_url
            FROM dte.documento d
            INNER JOIN ventas.venta v
                ON v.id = d.venta_id
            INNER JOIN terceros.tercero c
                ON c.id = d.receptor_id
            INNER JOIN core.empresa e
                ON e.id = d.emisor_id
            WHERE d.id = $1
            LIMIT 1
            `,
            [id]
        );

        if (documentoRes.rowCount === 0) {
            return res.status(404).json({ ok: false, mensaje: "Documento DTE no encontrado" });
        }

        const detalleRes = await pool.query(
            `
            SELECT
                vd.id,
                vd.producto_id,
                p.codigo AS producto_codigo,
                p.nombre AS producto_nombre,
                vd.cantidad,
                vd.precio_unitario,
                vd.descuento,
                vd.subtotal
            FROM ventas.venta_detalle vd
            INNER JOIN inventario.producto p
                ON p.id = vd.producto_id
            WHERE vd.venta_id = $1
            ORDER BY vd.id ASC
            `,
            [documentoRes.rows[0].venta_id]
        );

        const pagosRes = await pool.query(
            `
            SELECT
                pg.id,
                pg.fecha,
                pg.monto,
                pg.moneda,
                pg.referencia_externa,
                pg.autorizacion,
                pg.estado,
                pg.observacion,
                mp.codigo AS metodo_codigo,
                mp.nombre AS metodo_nombre
            FROM pagos.pago pg
            INNER JOIN pagos.metodo_pago mp
                ON mp.id = pg.metodo_pago_id
            WHERE pg.venta_id = $1
            ORDER BY pg.id ASC
            `,
            [documentoRes.rows[0].venta_id]
        );

        const enviosRes = await pool.query(
            `
            SELECT
                e.id,
                e.estado,
                e.observacion,
                e.fecha_envio,
                r.codigo_respuesta,
                r.mensaje,
                r.fecha_respuesta,
                r.json_respuesta
            FROM dte.envio e
            LEFT JOIN LATERAL (
                SELECT rr.codigo_respuesta, rr.mensaje, rr.fecha_respuesta, rr.json_respuesta
                FROM dte.respuesta rr
                WHERE rr.envio_id = e.id
                ORDER BY rr.id DESC
                LIMIT 1
            ) r ON TRUE
            WHERE e.documento_id = $1
            ORDER BY e.id DESC
            `,
            [id]
        );

        const plantilla = tipoAPlantilla[documentoRes.rows[0].tipo_dte] || null;
        const ambiente = normalizarAmbiente(documentoRes.rows[0]?.json_dte?.identificacion?.ambienteNombre);
        const qrConsultaUrl = documentoRes.rows[0]?.json_dte?.qr?.consultaUrl || obtenerQrConsultaUrl({
            ambiente,
            codigoGeneracion: documentoRes.rows[0].codigo_generacion,
            fechaEmision: documentoRes.rows[0].fecha_emision,
            numeroControl: documentoRes.rows[0].numero_control,
        });

        res.json({
            ok: true,
            mensaje: "Detalle del documento obtenido correctamente",
            data: {
                documento: documentoRes.rows[0],
                detalle: detalleRes.rows,
                pagos: pagosRes.rows,
                envios: enviosRes.rows,
                plantilla,
                qr_consulta_url: qrConsultaUrl,
                ambiente,
            },
        });
    } catch (error) {
        console.error("ERROR DETALLE DTE:", error);
        res.status(500).json({ ok: false, mensaje: "Error al obtener el detalle del documento", error: error.message });
    }
};

const enviarDTE = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query("BEGIN");

        const estadosPermitidos = await obtenerEstadosPermitidosDocumento(client);
        const estadoEnviado = resolverEstadoCompatible(estadosPermitidos, "ENVIADO", ["PENDIENTE"]);
        const estadoProcesado = resolverEstadoCompatible(estadosPermitidos, "PROCESADO", ["ACEPTADO", estadoEnviado || "ENVIADO", "PENDIENTE"]);

        const dteRes = await client.query(`SELECT * FROM dte.documento WHERE id = $1 LIMIT 1`, [id]);
        if (dteRes.rowCount === 0) {
            throw new Error("El documento DTE no existe");
        }

        const dte = dteRes.rows[0];
        if (["ANULADO"].includes(dte.estado)) {
            throw new Error("No se puede enviar un DTE anulado");
        }
        if ([estadoProcesado, "ACEPTADO"].filter(Boolean).includes(dte.estado)) {
            throw new Error("El DTE ya fue procesado anteriormente");
        }

        if (estadoEnviado && dte.estado !== estadoEnviado) {
            await client.query(`UPDATE dte.documento SET estado = $1 WHERE id = $2`, [estadoEnviado, id]);
        }

        const envioRes = await client.query(
            `
            INSERT INTO dte.envio (documento_id, estado, observacion, fecha_envio)
            VALUES ($1, $2, $3, NOW())
            RETURNING *
            `,
            [id, estadoEnviado || dte.estado || "ENVIADO", "Envío local simulado a Hacienda"]
        );

        const respuestaHacienda = {
            estado: estadoProcesado || estadoEnviado || dte.estado,
            codigoGeneracion: dte.codigo_generacion,
            sello: `SELLO-${dte.id}-${Date.now()}`,
            fechaProcesamiento: new Date().toISOString(),
            mensaje: "Documento procesado correctamente en ambiente local",
        };

        await client.query(
            `
            INSERT INTO dte.respuesta (envio_id, codigo_respuesta, mensaje, fecha_respuesta, json_respuesta)
            VALUES ($1, $2, $3, NOW(), $4)
            `,
            [envioRes.rows[0].id, "00", respuestaHacienda.mensaje, respuestaHacienda]
        );

        await client.query(
            `UPDATE dte.documento SET estado = $1, sello_recibido = $2 WHERE id = $3`,
            [estadoProcesado || estadoEnviado || dte.estado, respuestaHacienda.sello, id]
        );

        await client.query("COMMIT");

        res.json({
            ok: true,
            mensaje: "DTE procesado correctamente en flujo local",
            data: {
                id: dte.id,
                estado: estadoProcesado || estadoEnviado || dte.estado,
                codigo_generacion: dte.codigo_generacion,
                sello: respuestaHacienda.sello,
                estados_permitidos: estadosPermitidos,
            },
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("ERROR ENVIAR DTE:", error);
        res.status(500).json({ ok: false, mensaje: error.message || "No se pudo procesar el DTE" });
    } finally {
        client.release();
    }
};

module.exports = {
    obtenerTiposDTE,
    obtenerDocumentosDTE,
    obtenerDocumentoDTEDetalle,
    enviarDTE,
};
