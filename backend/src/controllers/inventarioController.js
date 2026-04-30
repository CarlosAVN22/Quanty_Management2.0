const pool = require("../config/db");

const asegurarBodegaPrincipal = async (client) => {
  const existente = await client.query(`
    SELECT id
    FROM inventario.bodega
    WHERE activo = TRUE
    ORDER BY id ASC
    LIMIT 1
  `);

  if (existente.rowCount > 0) return existente.rows[0].id;

  const creada = await client.query(
    `
    INSERT INTO inventario.bodega (sucursal_id, nombre, descripcion, activo)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [null, "Bodega Principal", "Bodega creada automáticamente por el sistema", true]
  );

  return creada.rows[0].id;
};

const asegurarTiposMovimiento = async (client) => {
  const tipos = [
    ["ENTRADA_MANUAL", "Entrada manual", "ENTRADA", true],
    ["SALIDA_MANUAL", "Salida manual", "SALIDA", true],
    ["AJUSTE_POSITIVO", "Ajuste positivo", "AJUSTE", true],
    ["AJUSTE_NEGATIVO", "Ajuste negativo", "AJUSTE", true],
  ];

  for (const tipo of tipos) {
    await client.query(
      `
      INSERT INTO inventario.tipo_movimiento
      (codigo, nombre, naturaleza, afecta_stock)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (codigo) DO NOTHING
      `,
      tipo
    );
  }
};

const obtenerTipoMovimientoId = async (client, codigo) => {
  const result = await client.query(
    `
    SELECT id
    FROM inventario.tipo_movimiento
    WHERE codigo = $1
    LIMIT 1
    `,
    [codigo]
  );

  if (result.rowCount === 0) {
    throw new Error(`No existe el tipo de movimiento ${codigo}`);
  }

  return result.rows[0].id;
};

const obtenerExistencias = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.id,
        e.producto_id,
        p.codigo,
        p.nombre,
        p.descripcion,
        p.precio_venta,
        p.stock_minimo,
        p.activo AS producto_activo,
        e.bodega_id,
        b.nombre AS bodega,
        b.activo AS bodega_activa,
        e.cantidad,
        e.ultima_actualizacion
      FROM inventario.existencia e
      INNER JOIN inventario.producto p ON p.id = e.producto_id
      INNER JOIN inventario.bodega b ON b.id = e.bodega_id
      ORDER BY p.id ASC
    `);

    res.json({
      ok: true,
      mensaje: "Existencias obtenidas correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener existencias",
      error: error.message,
    });
  }
};

const obtenerMovimientos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id,
        tm.codigo AS tipo_codigo,
        tm.nombre AS tipo_nombre,
        tm.naturaleza,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        p.precio_venta AS precio_producto_actual,
        b.nombre AS bodega_nombre,
        u.username AS usuario,
        m.observacion,
        m.cantidad,
        m.costo_unitario AS precio_unitario,
        (m.cantidad * m.costo_unitario) AS precio_total,
        m.fecha
      FROM inventario.movimiento m
      INNER JOIN inventario.tipo_movimiento tm ON tm.id = m.tipo_movimiento_id
      INNER JOIN inventario.producto p ON p.id = m.producto_id
      INNER JOIN inventario.bodega b ON b.id = m.bodega_id
      LEFT JOIN core.usuario u ON u.id = m.usuario_id
      ORDER BY m.id DESC
      LIMIT 100
    `);

    res.json({
      ok: true,
      mensaje: "Movimientos obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener movimientos",
      error: error.message,
    });
  }
};

const obtenerKardex = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        k.id,
        k.movimiento_id,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        p.precio_venta AS precio_producto_actual,
        b.nombre AS bodega_nombre,
        k.fecha,
        k.detalle,
        k.entrada,
        k.salida,
        k.saldo,
        k.costo_unitario AS precio_unitario,
        k.costo_total AS precio_total,
        tm.codigo AS tipo_codigo,
        tm.nombre AS tipo_nombre,
        tm.naturaleza,
        m.observacion
      FROM inventario.kardex k
      INNER JOIN inventario.producto p ON p.id = k.producto_id
      INNER JOIN inventario.bodega b ON b.id = k.bodega_id
      LEFT JOIN inventario.movimiento m ON m.id = k.movimiento_id
      LEFT JOIN inventario.tipo_movimiento tm ON tm.id = m.tipo_movimiento_id
      ORDER BY k.id DESC
      LIMIT 150
    `);

    res.json({
      ok: true,
      mensaje: "Kardex obtenido correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener kardex",
      error: error.message,
    });
  }
};

const registrarMovimiento = async (req, res) => {
  const client = await pool.connect();

  try {
    const { producto_id, bodega_id, tipo, cantidad, observacion } = req.body;

    if (!producto_id) throw new Error("Debe seleccionar un producto.");

    if (!["ENTRADA", "SALIDA", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"].includes(tipo)) {
      throw new Error("Tipo de movimiento inválido.");
    }

    const cantidadNum = Number(cantidad);

    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      throw new Error("La cantidad debe ser mayor que cero.");
    }

    if (
      ["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"].includes(tipo) &&
      (!observacion || String(observacion).trim().length < 5)
    ) {
      throw new Error("Los ajustes requieren una observación o motivo de al menos 5 caracteres.");
    }

    await client.query("BEGIN");

    await asegurarTiposMovimiento(client);

    const bodegaFinalId = bodega_id ? Number(bodega_id) : await asegurarBodegaPrincipal(client);

    const productoResult = await client.query(
      `
      SELECT id, nombre, codigo, activo, precio_venta
      FROM inventario.producto
      WHERE id = $1
      LIMIT 1
      `,
      [Number(producto_id)]
    );

    if (productoResult.rowCount === 0) {
      throw new Error("Producto no encontrado.");
    }

    const producto = productoResult.rows[0];

    if (!producto.activo) {
      throw new Error("No se pueden registrar movimientos sobre productos inactivos.");
    }

    const precioUnitario = Number(producto.precio_venta || 0);

    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
      throw new Error("El precio del producto no es válido.");
    }

    const bodegaResult = await client.query(
      `
      SELECT id, nombre, activo
      FROM inventario.bodega
      WHERE id = $1
      LIMIT 1
      `,
      [bodegaFinalId]
    );

    if (bodegaResult.rowCount === 0) {
      throw new Error("Bodega no encontrada.");
    }

    if (!bodegaResult.rows[0].activo) {
      throw new Error("No se pueden registrar movimientos sobre bodegas inactivas.");
    }

    let existenciaResult = await client.query(
      `
      SELECT id, cantidad
      FROM inventario.existencia
      WHERE producto_id = $1 AND bodega_id = $2
      FOR UPDATE
      `,
      [Number(producto_id), bodegaFinalId]
    );

    if (existenciaResult.rowCount === 0) {
      await client.query(
        `
        INSERT INTO inventario.existencia
        (producto_id, bodega_id, cantidad, ultima_actualizacion)
        VALUES ($1, $2, 0, NOW())
        `,
        [Number(producto_id), bodegaFinalId]
      );

      existenciaResult = await client.query(
        `
        SELECT id, cantidad
        FROM inventario.existencia
        WHERE producto_id = $1 AND bodega_id = $2
        FOR UPDATE
        `,
        [Number(producto_id), bodegaFinalId]
      );
    }

    const existencia = existenciaResult.rows[0];
    const saldoAnterior = Number(existencia.cantidad);

    let entrada = 0;
    let salida = 0;
    let saldoNuevo = saldoAnterior;
    let codigoTipo = "";

    if (tipo === "ENTRADA") {
      entrada = cantidadNum;
      saldoNuevo = saldoAnterior + cantidadNum;
      codigoTipo = "ENTRADA_MANUAL";
    }

    if (tipo === "SALIDA") {
      salida = cantidadNum;
      saldoNuevo = saldoAnterior - cantidadNum;
      codigoTipo = "SALIDA_MANUAL";
    }

    if (tipo === "AJUSTE_POSITIVO") {
      entrada = cantidadNum;
      saldoNuevo = saldoAnterior + cantidadNum;
      codigoTipo = "AJUSTE_POSITIVO";
    }

    if (tipo === "AJUSTE_NEGATIVO") {
      salida = cantidadNum;
      saldoNuevo = saldoAnterior - cantidadNum;
      codigoTipo = "AJUSTE_NEGATIVO";
    }

    if (saldoNuevo < 0) {
      throw new Error("No hay suficiente stock. El movimiento dejaría inventario negativo.");
    }

    const tipoMovimientoId = await obtenerTipoMovimientoId(client, codigoTipo);

    const movimientoResult = await client.query(
      `
      INSERT INTO inventario.movimiento
      (
        tipo_movimiento_id,
        producto_id,
        bodega_id,
        tercero_id,
        usuario_id,
        referencia_documento,
        observacion,
        cantidad,
        costo_unitario
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        tipoMovimientoId,
        Number(producto_id),
        bodegaFinalId,
        null,
        req.user?.id || null,
        null,
        observacion || null,
        cantidadNum,
        precioUnitario,
      ]
    );

    await client.query(
      `
      UPDATE inventario.existencia
      SET cantidad = $1, ultima_actualizacion = NOW()
      WHERE id = $2
      `,
      [saldoNuevo, existencia.id]
    );

    await client.query(
      `
      INSERT INTO inventario.kardex
      (
        movimiento_id,
        producto_id,
        bodega_id,
        fecha,
        detalle,
        entrada,
        salida,
        saldo,
        costo_unitario,
        costo_total
      )
      VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9)
      `,
      [
        movimientoResult.rows[0].id,
        Number(producto_id),
        bodegaFinalId,
        `${tipo} - ${producto.codigo} ${producto.nombre}`,
        entrada,
        salida,
        saldoNuevo,
        precioUnitario,
        Number((cantidadNum * precioUnitario).toFixed(2)),
      ]
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      mensaje: "Movimiento registrado correctamente.",
      data: {
        movimiento: movimientoResult.rows[0],
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        precio_unitario: precioUnitario,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    res.status(400).json({
      ok: false,
      mensaje: error.message || "Error al registrar movimiento.",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerExistencias,
  obtenerMovimientos,
  obtenerKardex,
  registrarMovimiento,
};
