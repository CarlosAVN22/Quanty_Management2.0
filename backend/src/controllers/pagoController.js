const pool = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");

const obtenerPagos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.venta_id,
        t.nombre AS cliente_nombre,
        v.total,
        p.monto,
        p.metodo_pago_id,
        mp.codigo AS metodo_codigo,
        mp.nombre AS metodo_pago,
        p.referencia_externa AS referencia,
        p.autorizacion,
        p.estado,
        p.observacion,
        p.fecha
      FROM pagos.pago p
      INNER JOIN ventas.venta v ON v.id = p.venta_id
      INNER JOIN terceros.tercero t ON t.id = v.cliente_id
      LEFT JOIN pagos.metodo_pago mp ON mp.id = p.metodo_pago_id
      ORDER BY p.id DESC
      LIMIT 100
    `);

    res.json({
      ok: true,
      mensaje: "Pagos obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener pagos",
      error: error.message,
    });
  }
};

const obtenerMetodosPago = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, codigo, nombre, requiere_referencia, activo, descripcion
      FROM pagos.metodo_pago
      WHERE activo = TRUE
      ORDER BY id ASC
    `);

    res.json({
      ok: true,
      mensaje: "Métodos de pago obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener métodos de pago",
      error: error.message,
    });
  }
};

const obtenerVentasPendientes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id,
        t.nombre AS cliente_nombre,
        v.fecha,
        v.total,
        v.estado,
        COALESCE(SUM(CASE WHEN p.estado = 'APROBADO' THEN p.monto ELSE 0 END), 0) AS total_pagado,
        v.total - COALESCE(SUM(CASE WHEN p.estado = 'APROBADO' THEN p.monto ELSE 0 END), 0) AS saldo_pendiente
      FROM ventas.venta v
      INNER JOIN terceros.tercero t ON t.id = v.cliente_id
      LEFT JOIN pagos.pago p ON p.venta_id = v.id
      WHERE v.estado IN ('PENDIENTE', 'PARCIAL')
      GROUP BY v.id, t.nombre
      HAVING v.total - COALESCE(SUM(CASE WHEN p.estado = 'APROBADO' THEN p.monto ELSE 0 END), 0) > 0
      ORDER BY v.id DESC
    `);

    res.json({
      ok: true,
      mensaje: "Ventas pendientes obtenidas correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener ventas pendientes",
      error: error.message,
    });
  }
};

const registrarPago = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      venta_id,
      monto,
      metodo_pago_id,
      referencia,
      referencia_externa,
      autorizacion,
      observacion,
    } = req.body;

    if (!venta_id) throw new Error("Debe indicar la venta.");

    const montoNum = Number(monto);

    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      throw new Error("El monto debe ser mayor que cero.");
    }

    if (!metodo_pago_id) {
      throw new Error("Debe indicar un método de pago válido.");
    }

    await client.query("BEGIN");

    const ventaRes = await client.query(
      `
      SELECT id, total, estado
      FROM ventas.venta
      WHERE id = $1
      FOR UPDATE
      `,
      [Number(venta_id)]
    );

    if (ventaRes.rowCount === 0) {
      throw new Error("La venta no existe.");
    }

    const venta = ventaRes.rows[0];

    if (venta.estado === "ANULADA") {
      throw new Error("No se pueden registrar pagos sobre ventas anuladas.");
    }

    if (venta.estado === "PAGADA") {
      throw new Error("La venta ya está completamente pagada.");
    }

    const metodoRes = await client.query(
      `
      SELECT id, codigo, nombre, requiere_referencia, activo
      FROM pagos.metodo_pago
      WHERE id = $1
      LIMIT 1
      `,
      [Number(metodo_pago_id)]
    );

    if (metodoRes.rowCount === 0) {
      throw new Error("El método de pago no existe.");
    }

    const metodo = metodoRes.rows[0];

    if (!metodo.activo) {
      throw new Error("El método de pago está inactivo.");
    }

    const pagosRes = await client.query(
      `
      SELECT COALESCE(SUM(monto), 0) AS total_pagado
      FROM pagos.pago
      WHERE venta_id = $1
      AND estado = 'APROBADO'
      `,
      [Number(venta_id)]
    );

    const totalPagado = Number(pagosRes.rows[0].total_pagado);
    const totalVenta = Number(venta.total);
    const saldoPendiente = Number((totalVenta - totalPagado).toFixed(2));

    if (saldoPendiente <= 0) {
      throw new Error("La venta ya está completamente pagada.");
    }

    if (montoNum > saldoPendiente) {
      throw new Error(`El pago excede el saldo pendiente (${saldoPendiente}).`);
    }

    const referenciaFinal = referencia_externa || referencia || null;

    if (metodo.requiere_referencia) {
      if (!referenciaFinal || String(referenciaFinal).trim().length < 4) {
        throw new Error(`El método ${metodo.nombre} requiere referencia.`);
      }
    }

    const pagoInsert = await client.query(
      `
      INSERT INTO pagos.pago
      (
        venta_id,
        metodo_pago_id,
        monto,
        moneda,
        referencia_externa,
        autorizacion,
        estado,
        observacion
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        Number(venta_id),
        Number(metodo_pago_id),
        montoNum,
        "USD",
        referenciaFinal,
        autorizacion || null,
        "APROBADO",
        observacion || null,
      ]
    );

    const nuevoTotalPagado = Number((totalPagado + montoNum).toFixed(2));
    const nuevoSaldo = Number((totalVenta - nuevoTotalPagado).toFixed(2));
    const nuevoEstado = nuevoSaldo <= 0 ? "PAGADA" : "PARCIAL";

    await client.query(
      `
      UPDATE ventas.venta
      SET estado = $1
      WHERE id = $2
      `,
      [nuevoEstado, Number(venta_id)]
    );

    await registrarAuditoria(client, {
      usuario_id: req.user?.id || null,
      esquema: "pagos",
      tabla: "pago",
      accion: "INSERT",
      datos_nuevos: pagoInsert.rows[0],
      observacion: `Pago registrado para venta ${venta_id}`,
    });

    await client.query("COMMIT");

    res.json({
      ok: true,
      mensaje: "Pago registrado correctamente",
      data: {
        pago: pagoInsert.rows[0],
        total_pagado: nuevoTotalPagado,
        saldo_pendiente: nuevoSaldo,
        estado_venta: nuevoEstado,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerPagos,
  registrarPago,
  obtenerMetodosPago,
  obtenerVentasPendientes,
};