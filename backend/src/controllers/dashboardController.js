const pool = require("../config/db");

const obtenerResumenDashboard = async (req, res) => {
    try {
        const [
            ventasHoyTotalRes,
            ventasHoyCantidadRes,
            dteEnviadosRes,
            dtePendientesRes,
            ivaGeneradoRes,
            ultimasVentasRes,
            stockCriticoRes,
            pagosMetodoRes,
            clientesRes,
            productosRes,
        ] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM(total),0) AS total FROM ventas.venta WHERE DATE(fecha) = CURRENT_DATE`),
            pool.query(`SELECT COUNT(*) AS cantidad FROM ventas.venta WHERE DATE(fecha) = CURRENT_DATE`),
            pool.query(`SELECT COUNT(*) AS cantidad FROM dte.documento WHERE estado IN ('ENVIADO','PROCESADO','ACEPTADO')`),
            pool.query(`SELECT COUNT(*) AS cantidad FROM dte.documento WHERE estado = 'PENDIENTE'`),
            pool.query(`SELECT COALESCE(SUM(iva),0) AS total FROM ventas.venta WHERE DATE(fecha) = CURRENT_DATE`),
            pool.query(`
                SELECT v.id, v.fecha, v.total, v.estado,
                       t.nombre AS cliente,
                       COALESCE(d.numero_control, '-') AS numero_control,
                       COALESCE(d.tipo_dte, '-') AS tipo_dte,
                       COALESCE(d.estado, '-') AS estado_mh,
                       COALESCE(mp.nombre, 'Sin pago') AS metodo_pago
                FROM ventas.venta v
                INNER JOIN terceros.tercero t ON t.id = v.cliente_id
                LEFT JOIN dte.documento d ON d.venta_id = v.id
                LEFT JOIN LATERAL (
                    SELECT mp.nombre
                    FROM pagos.pago p
                    INNER JOIN pagos.metodo_pago mp ON mp.id = p.metodo_pago_id
                    WHERE p.venta_id = v.id
                    ORDER BY p.id DESC LIMIT 1
                ) mp ON TRUE
                ORDER BY v.fecha DESC
                LIMIT 8
            `),
            pool.query(`
                SELECT p.id, p.nombre, COALESCE(e.cantidad, 0) AS stock_actual, p.stock_minimo
                FROM inventario.producto p
                LEFT JOIN inventario.existencia e ON e.producto_id = p.id
                WHERE COALESCE(e.cantidad, 0) <= GREATEST(p.stock_minimo, 10)
                ORDER BY COALESCE(e.cantidad, 0) ASC, p.nombre ASC
                LIMIT 5
            `),
            pool.query(`
                SELECT mp.codigo, mp.nombre, COALESCE(SUM(p.monto),0) AS total
                FROM pagos.metodo_pago mp
                LEFT JOIN pagos.pago p ON p.metodo_pago_id = mp.id AND p.estado = 'APROBADO' AND DATE(p.fecha) = CURRENT_DATE
                GROUP BY mp.codigo, mp.nombre
                ORDER BY total DESC, mp.nombre ASC
            `),
            pool.query(`SELECT COUNT(*) AS cantidad FROM terceros.tercero WHERE tipo_tercero_id = 1`),
            pool.query(`SELECT COUNT(*) AS cantidad FROM inventario.producto`),
        ]);

        res.json({
            ok: true,
            data: {
                indicadores: {
                    ventas_hoy_total: Number(ventasHoyTotalRes.rows[0].total || 0),
                    ventas_hoy_cantidad: Number(ventasHoyCantidadRes.rows[0].cantidad || 0),
                    dte_enviados: Number(dteEnviadosRes.rows[0].cantidad || 0),
                    dte_pendientes: Number(dtePendientesRes.rows[0].cantidad || 0),
                    iva_generado: Number(ivaGeneradoRes.rows[0].total || 0),
                    clientes_total: Number(clientesRes.rows[0].cantidad || 0),
                    productos_total: Number(productosRes.rows[0].cantidad || 0),
                },
                ultimas_ventas: ultimasVentasRes.rows,
                stock_critico: stockCriticoRes.rows,
                pagos_por_metodo: pagosMetodoRes.rows.map((item) => ({ ...item, total: Number(item.total || 0) })),
            },
        });
    } catch (error) {
        console.error("ERROR DASHBOARD:", error);
        res.status(500).json({ ok: false, mensaje: "Error al obtener resumen del dashboard", error: error.message });
    }
};

module.exports = { obtenerResumenDashboard };
