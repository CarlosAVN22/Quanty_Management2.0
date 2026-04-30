const {
  tipoAPlantilla,
  normalizarAmbiente,
  obtenerQrConsultaUrl,
  construirResumenOperativo,
} = require("../utils/dteCatalog");

const pool = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");

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
    [null, "Bodega Principal", "Bodega creada automáticamente por ventas", true]
  );

  return creada.rows[0].id;
};

const asegurarTipoMovimientoVenta = async (client) => {
  await client.query(
    `
    INSERT INTO inventario.tipo_movimiento
    (codigo, nombre, naturaleza, afecta_stock, descripcion)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (codigo) DO NOTHING
    `,
    ["VENTA", "Salida por venta", "SALIDA", true, "Salida automática generada por facturación"]
  );

  const result = await client.query(`
    SELECT id
    FROM inventario.tipo_movimiento
    WHERE codigo = 'VENTA'
    LIMIT 1
  `);

  return result.rows[0].id;
};

const asegurarTipoClienteId = async (client) => {
  await client.query(
    `
    INSERT INTO terceros.tipo_tercero (nombre, descripcion)
    VALUES ('CLIENTE', 'Persona o empresa que compra productos')
    ON CONFLICT (nombre) DO NOTHING
    `
  );

  const result = await client.query(`
    SELECT id
    FROM terceros.tipo_tercero
    WHERE nombre = 'CLIENTE'
    LIMIT 1
  `);

  return result.rows[0].id;
};

const asegurarConsumidorFinal = async (client) => {
  const tipoClienteId = await asegurarTipoClienteId(client);

  const existente = await client.query(
    `
    SELECT id, nombre, documento, activo
    FROM terceros.tercero
    WHERE documento = 'CF-VENTA-ESCRITORIO'
    LIMIT 1
    `
  );

  if (existente.rowCount > 0) {
    if (!existente.rows[0].activo) {
      const activado = await client.query(
        `
        UPDATE terceros.tercero
        SET activo = TRUE
        WHERE id = $1
        RETURNING id, nombre, documento, activo
        `,
        [existente.rows[0].id]
      );

      return activado.rows[0];
    }

    return existente.rows[0];
  }

  const creado = await client.query(
    `
    INSERT INTO terceros.tercero
    (
      tipo_tercero_id,
      nombre,
      nombre_comercial,
      documento,
      nit,
      nrc,
      telefono,
      correo,
      activo
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id, nombre, documento, activo
    `,
    [
      tipoClienteId,
      "CONSUMIDOR FINAL",
      "Venta de escritorio",
      "CF-VENTA-ESCRITORIO",
      null,
      null,
      null,
      null,
      true,
    ]
  );

  return creado.rows[0];
};

const resolverSucursalVenta = async (client, sucursalId) => {
  if (sucursalId) {
    const sucursalRes = await client.query(
      `
      SELECT id, nombre, empresa_id, activo
      FROM core.sucursal
      WHERE id = $1
      LIMIT 1
      `,
      [Number(sucursalId)]
    );

    if (sucursalRes.rowCount === 0) throw new Error("La sucursal no existe.");
    if (!sucursalRes.rows[0].activo) throw new Error("La sucursal está inactiva.");

    return sucursalRes.rows[0];
  }

  const activa = await client.query(`
    SELECT id, nombre, empresa_id, activo
    FROM core.sucursal
    WHERE activo = TRUE
    ORDER BY id ASC
    LIMIT 1
  `);

  return activa.rows[0] || null;
};

const asegurarMetodosBase = async (client) => {
  const metodos = [
    ["EFECTIVO", "Efectivo", false, true, "Pago en efectivo"],
    ["TARJETA", "Tarjeta", true, true, "Pago con tarjeta"],
    ["TRANSFERENCIA", "Transferencia", true, true, "Pago por transferencia bancaria"],
    ["PAYPAL", "PayPal", true, true, "Pago por PayPal"],
  ];

  for (const metodo of metodos) {
    await client.query(
      `
      INSERT INTO pagos.metodo_pago
      (codigo, nombre, requiere_referencia, activo, descripcion)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (codigo) DO NOTHING
      `,
      metodo
    );
  }
};

const obtenerVentas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id,
        v.cliente_id,
        t.nombre AS cliente_nombre,
        s.nombre AS sucursal_nombre,
        v.fecha,
        v.subtotal,
        v.iva,
        v.descuento,
        v.total,
        v.estado,
        COALESCE(d.numero_control, '-') AS numero_control,
        COALESCE(d.tipo_dte, '-') AS tipo_dte,
        COALESCE(d.estado, '-') AS dte_estado,
        COALESCE(d.json_dte->'identificacion'->>'ambienteNombre', 'TEST') AS ambiente_dte,
        COALESCE(p.total_pagado, 0) AS total_pagado,
        (v.total - COALESCE(p.total_pagado, 0)) AS saldo_pendiente
      FROM ventas.venta v
      INNER JOIN terceros.tercero t ON t.id = v.cliente_id
      LEFT JOIN core.sucursal s ON s.id = v.sucursal_id
      LEFT JOIN dte.documento d ON d.venta_id = v.id
      LEFT JOIN (
        SELECT venta_id, SUM(monto) AS total_pagado
        FROM pagos.pago
        WHERE estado = 'APROBADO'
        GROUP BY venta_id
      ) p ON p.venta_id = v.id
      ORDER BY v.id DESC
    `);

    res.json({
      ok: true,
      mensaje: "Ventas obtenidas correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener ventas",
      error: error.message,
    });
  }
};

const crearVenta = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      cliente_id,
      modo_venta = "REGISTRADO",
      sucursal_id,
      punto_emision_id,
      bodega_id,
      productos,
      observacion,
      tipo_dte,
      ambiente,
      pago,
    } = req.body;

    const modoVenta = String(modo_venta || "REGISTRADO").toUpperCase();

    if (!["ESCRITORIO", "REGISTRADO"].includes(modoVenta)) {
      throw new Error("El modo de venta no es válido.");
    }

    if (modoVenta === "REGISTRADO" && !cliente_id) {
      throw new Error("Debe seleccionar un cliente.");
    }

    if (!Array.isArray(productos) || productos.length === 0) {
      throw new Error("Debe agregar al menos un producto.");
    }

    await client.query("BEGIN");

    const usuarioActualId = req.user?.id || null;

    let cliente;

    if (modoVenta === "ESCRITORIO") {
      cliente = await asegurarConsumidorFinal(client);
    } else {
      const clienteRes = await client.query(
        `
        SELECT id, nombre, documento, activo
        FROM terceros.tercero
        WHERE id = $1
        LIMIT 1
        `,
        [Number(cliente_id)]
      );

      if (clienteRes.rowCount === 0) {
        throw new Error("El cliente no existe.");
      }

      cliente = clienteRes.rows[0];

      if (!cliente.activo) {
        throw new Error("No se puede vender a un cliente inactivo.");
      }
    }

    const empresaRes = await client.query(`
      SELECT id, nombre, nombre_comercial, nit, nrc, telefono, correo, logo_url
      FROM core.empresa
      WHERE activo = TRUE
      ORDER BY id ASC
      LIMIT 1
    `);

    if (empresaRes.rowCount === 0) {
      throw new Error("No hay una empresa activa configurada.");
    }

    const empresa = empresaRes.rows[0];
    const sucursalSeleccionada = await resolverSucursalVenta(client, sucursal_id);

    if (punto_emision_id) {
      const puntoRes = await client.query(
        `
        SELECT id, sucursal_id, activo
        FROM core.punto_emision
        WHERE id = $1
        LIMIT 1
        `,
        [Number(punto_emision_id)]
      );

      if (puntoRes.rowCount === 0) throw new Error("El punto de emisión no existe.");
      if (!puntoRes.rows[0].activo) throw new Error("El punto de emisión está inactivo.");

      if (
        sucursalSeleccionada &&
        Number(puntoRes.rows[0].sucursal_id) !== Number(sucursalSeleccionada.id)
      ) {
        throw new Error("El punto de emisión no pertenece a la sucursal seleccionada.");
      }
    }

    const bodegaId = bodega_id ? Number(bodega_id) : await asegurarBodegaPrincipal(client);

    const bodegaRes = await client.query(
      `
      SELECT id, sucursal_id, activo
      FROM inventario.bodega
      WHERE id = $1
      LIMIT 1
      `,
      [bodegaId]
    );

    if (bodegaRes.rowCount === 0) throw new Error("La bodega no existe.");
    if (!bodegaRes.rows[0].activo) throw new Error("La bodega está inactiva.");

    if (
      sucursalSeleccionada &&
      bodegaRes.rows[0].sucursal_id &&
      Number(bodegaRes.rows[0].sucursal_id) !== Number(sucursalSeleccionada.id)
    ) {
      throw new Error("La bodega no pertenece a la sucursal seleccionada.");
    }

    const tipoMovimientoVentaId = await asegurarTipoMovimientoVenta(client);
    await asegurarMetodosBase(client);

    const productosConsolidados = new Map();

    for (const item of productos) {
      const productoId = Number(item.producto_id);
      const cantidad = Number(item.cantidad);
      const precioUnitario = Number(item.precio_unitario || 0);

      if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error("Todos los productos deben tener una cantidad válida mayor que cero.");
      }

      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        throw new Error("El precio unitario no puede ser negativo.");
      }

      if (productosConsolidados.has(productoId)) {
        const anterior = productosConsolidados.get(productoId);
        anterior.cantidad += cantidad;
      } else {
        productosConsolidados.set(productoId, {
          producto_id: productoId,
          cantidad,
          precio_unitario: precioUnitario,
          aplica_iva: item.aplica_iva,
        });
      }
    }

    let subtotal = 0;
    let iva = 0;
    const detalleProcesado = [];

    for (const item of productosConsolidados.values()) {
      const productoRes = await client.query(
        `
        SELECT id, codigo, nombre, precio_venta, aplica_iva, activo
        FROM inventario.producto
        WHERE id = $1
        LIMIT 1
        `,
        [item.producto_id]
      );

      if (productoRes.rowCount === 0) {
        throw new Error(`El producto ${item.producto_id} no existe.`);
      }

      const producto = productoRes.rows[0];

      if (!producto.activo) {
        throw new Error(`El producto ${producto.nombre} está inactivo y no puede venderse.`);
      }

      let existenciaRes = await client.query(
        `
        SELECT id, cantidad
        FROM inventario.existencia
        WHERE producto_id = $1 AND bodega_id = $2
        FOR UPDATE
        `,
        [item.producto_id, bodegaId]
      );

      if (existenciaRes.rowCount === 0) {
        await client.query(
          `
          INSERT INTO inventario.existencia
          (producto_id, bodega_id, cantidad, ultima_actualizacion)
          VALUES ($1, $2, 0, NOW())
          `,
          [item.producto_id, bodegaId]
        );

        existenciaRes = await client.query(
          `
          SELECT id, cantidad
          FROM inventario.existencia
          WHERE producto_id = $1 AND bodega_id = $2
          FOR UPDATE
          `,
          [item.producto_id, bodegaId]
        );
      }

      const existencia = existenciaRes.rows[0];
      const stockActual = Number(existencia.cantidad);
      const cantidad = Number(item.cantidad);

      if (stockActual < cantidad) {
        throw new Error(
          `Stock insuficiente para ${producto.nombre}. Disponible: ${stockActual}, solicitado: ${cantidad}.`
        );
      }

      const precioFinal =
        Number(item.precio_unitario) > 0
          ? Number(item.precio_unitario)
          : Number(producto.precio_venta);

      if (!Number.isFinite(precioFinal) || precioFinal <= 0) {
        throw new Error(`El producto ${producto.nombre} no tiene un precio válido.`);
      }

      const aplicaIva = item.aplica_iva ?? producto.aplica_iva;
      const subtotalLinea = Number((cantidad * precioFinal).toFixed(2));
      const ivaLinea = aplicaIva ? Number((subtotalLinea * 0.13).toFixed(2)) : 0;

      subtotal = Number((subtotal + subtotalLinea).toFixed(2));
      iva = Number((iva + ivaLinea).toFixed(2));

      detalleProcesado.push({
        producto_id: producto.id,
        existencia_id: existencia.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad,
        precio_unitario: precioFinal,
        subtotal: subtotalLinea,
        iva_linea: ivaLinea,
        aplica_iva: Boolean(aplicaIva),
        stock_anterior: stockActual,
        stock_nuevo: Number((stockActual - cantidad).toFixed(2)),
      });
    }

    const total = Number((subtotal + iva).toFixed(2));

    const ventaResult = await client.query(
      `
      INSERT INTO ventas.venta
      (
        cliente_id,
        sucursal_id,
        punto_emision_id,
        usuario_id,
        fecha,
        subtotal,
        iva,
        descuento,
        total,
        estado,
        observacion
      )
      VALUES ($1,$2,$3,$4,NOW(),$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        cliente.id,
        sucursalSeleccionada?.id || null,
        punto_emision_id || null,
        usuarioActualId,
        subtotal,
        iva,
        0,
        total,
        "PENDIENTE",
        observacion || null,
      ]
    );

    const venta = ventaResult.rows[0];

    for (const item of detalleProcesado) {
      await client.query(
        `
        INSERT INTO ventas.venta_detalle
        (venta_id, producto_id, bodega_id, cantidad, precio_unitario, descuento, subtotal)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          venta.id,
          item.producto_id,
          bodegaId,
          item.cantidad,
          item.precio_unitario,
          0,
          item.subtotal,
        ]
      );

      await client.query(
        `
        UPDATE inventario.existencia
        SET cantidad = $1, ultima_actualizacion = NOW()
        WHERE id = $2
        `,
        [item.stock_nuevo, item.existencia_id]
      );

      const movimientoRes = await client.query(
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
          costo_unitario,
          fecha
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        RETURNING id
        `,
        [
          tipoMovimientoVentaId,
          item.producto_id,
          bodegaId,
          cliente.id,
          usuarioActualId,
          `VENTA-${venta.id}`,
          observacion || `Salida automática por venta ${venta.id}`,
          item.cantidad,
          item.precio_unitario,
        ]
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
          movimientoRes.rows[0].id,
          item.producto_id,
          bodegaId,
          `Salida por venta ${venta.id} - ${item.codigo} ${item.nombre}`,
          0,
          item.cantidad,
          item.stock_nuevo,
          item.precio_unitario,
          Number((item.cantidad * item.precio_unitario).toFixed(2)),
        ]
      );
    }

    const tipoDteFinal = tipo_dte || "01";
    const plantillaDte = tipoAPlantilla[tipoDteFinal] || null;
    const numeroControl = `DTE-${tipoDteFinal}-${String(venta.id).padStart(8, "0")}`;
    const fechaIso = new Date().toISOString();
    const ambienteDte = normalizarAmbiente(ambiente);

    const resumenOperativo = construirResumenOperativo({
      tipoDte: tipoDteFinal,
      detalle: detalleProcesado,
      descuentoTotal: 0,
    });

    const qrConsultaUrl = obtenerQrConsultaUrl({
      ambiente: ambienteDte,
      codigoGeneracion: null,
      fechaEmision: fechaIso,
      numeroControl,
    });

    const jsonDte = {
      identificacion: {
        version: 1,
        ambiente: ambienteDte === "PRODUCCION" ? "01" : "00",
        ambienteNombre: ambienteDte,
        tipoDte: tipoDteFinal,
        plantillaJson: plantillaDte?.schema_archivo || null,
        numeroControl,
        codigoGeneracion: null,
        fechaEmision: fechaIso,
        sucursal: sucursalSeleccionada?.nombre || null,
        modoVenta,
      },
      plantilla: plantillaDte,
      emisor: {
        nombre: empresa.nombre,
        nombreComercial: empresa.nombre_comercial,
        nit: empresa.nit,
        nrc: empresa.nrc,
        sucursal: sucursalSeleccionada?.nombre || null,
      },
      receptor: {
        id: cliente.id,
        nombre: cliente.nombre,
        documento: cliente.documento,
      },
      resumen: {
        ...resumenOperativo,
        montoTotalOperacion: total,
        totalNoGravado: 0,
        totalLetras: `Son $${total.toFixed(2)} USD`,
      },
      qr: {
        consultaUrl: qrConsultaUrl,
        ambiente: ambienteDte,
      },
      cuerpoDocumento: detalleProcesado.map((item, index) => ({
        numItem: index + 1,
        producto_id: item.producto_id,
        descripcion: item.nombre,
        cantidad: item.cantidad,
        precioUnitario: item.precio_unitario,
        subtotal: item.subtotal,
        aplicaIva: item.aplica_iva,
      })),
    };

    const dteRes = await client.query(
      `
      INSERT INTO dte.documento
      (
        venta_id,
        tipo_dte,
        numero_control,
        emisor_id,
        receptor_id,
        total,
        json_dte
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        venta.id,
        tipoDteFinal,
        numeroControl,
        empresa.id,
        cliente.id,
        total,
        jsonDte,
      ]
    );

    let pagoRegistrado = null;
    let estadoVenta = "PENDIENTE";

    if (pago && pago.metodo_pago_id) {
      const metodoRes = await client.query(
        `
        SELECT id, codigo, nombre, requiere_referencia, activo
        FROM pagos.metodo_pago
        WHERE id = $1
        LIMIT 1
        `,
        [Number(pago.metodo_pago_id)]
      );

      if (metodoRes.rowCount === 0) {
        throw new Error("El método de pago seleccionado no existe.");
      }

      const metodo = metodoRes.rows[0];

      if (!metodo.activo) {
        throw new Error("El método de pago está inactivo.");
      }

      const montoPago = Number(pago.monto || total);

      if (!Number.isFinite(montoPago) || montoPago <= 0) {
        throw new Error("El monto del pago no es válido.");
      }

      if (montoPago > total) {
        throw new Error("El pago no puede ser mayor al total de la venta.");
      }

      if (metodo.requiere_referencia && !String(pago.referencia_externa || "").trim()) {
        throw new Error(`El método ${metodo.nombre} requiere referencia.`);
      }

      const pagoRes = await client.query(
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
          venta.id,
          metodo.id,
          montoPago,
          "USD",
          pago.referencia_externa || null,
          pago.autorizacion || null,
          "APROBADO",
          pago.observacion || null,
        ]
      );

      pagoRegistrado = {
        ...pagoRes.rows[0],
        metodo_codigo: metodo.codigo,
        metodo_nombre: metodo.nombre,
      };

      estadoVenta = montoPago >= total ? "PAGADA" : "PARCIAL";

      await client.query(
        `
        UPDATE ventas.venta
        SET estado = $1
        WHERE id = $2
        `,
        [estadoVenta, venta.id]
      );

      venta.estado = estadoVenta;
    }

    await registrarAuditoria(client, {
      usuario_id: usuarioActualId,
      esquema: "ventas",
      tabla: "venta",
      accion: "INSERT",
      datos_nuevos: venta,
      observacion: `Venta creada con total ${total} en modo ${modoVenta}`,
    });

    await client.query("COMMIT");

    res.json({
      ok: true,
      mensaje:
        modoVenta === "ESCRITORIO"
          ? "Venta de escritorio registrada correctamente"
          : "Venta registrada correctamente",
      data: {
        venta,
        cliente,
        dte: dteRes.rows[0],
        pago: pagoRegistrado,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    res.status(400).json({
      ok: false,
      mensaje: error.message || "No se pudo registrar la venta",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerVentas,
  crearVenta,
};