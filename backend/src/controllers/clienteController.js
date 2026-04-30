const pool = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");
const limpiar = (valor) => String(valor || "").trim();

const validarCorreo = (correo) => {
  if (!correo) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
};

const validarTelefono = (telefono) => {
  if (!telefono) return true;
  return /^[0-9+\-\s]{7,20}$/.test(telefono);
};

const validarTextoMinimo = (valor, minimo) => {
  return limpiar(valor).length >= minimo;
};

const asegurarTipoCliente = async (client) => {
  await client.query(`
    INSERT INTO terceros.tipo_tercero (nombre, descripcion)
    VALUES ('CLIENTE', 'Persona o empresa que compra productos')
    ON CONFLICT (nombre) DO NOTHING
  `);

  const result = await client.query(`
    SELECT id
    FROM terceros.tipo_tercero
    WHERE nombre = 'CLIENTE'
    LIMIT 1
  `);

  return result.rows[0].id;
};

const obtenerClientes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.tipo_tercero_id,
        tt.nombre AS tipo_tercero,
        t.nombre,
        t.nombre_comercial,
        t.documento,
        t.nit,
        t.nrc,
        t.telefono,
        t.correo,
        t.direccion_id,
        t.activo,
        t.fecha_creacion
      FROM terceros.tercero t
      INNER JOIN terceros.tipo_tercero tt ON tt.id = t.tipo_tercero_id
      WHERE tt.nombre = 'CLIENTE'
      ORDER BY t.id ASC
    `);

    res.json({
      ok: true,
      mensaje: "Clientes obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener clientes",
      error: error.message,
    });
  }
};

const crearCliente = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      nombre,
      nombre_comercial,
      documento,
      nit,
      nrc,
      telefono,
      correo,
      direccion_id,
      activo = true,
    } = req.body;

    if (!validarTextoMinimo(nombre, 2)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El nombre del cliente es obligatorio.",
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El correo no tiene un formato válido.",
      });
    }

    if (!validarTelefono(telefono)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El teléfono no tiene un formato válido.",
      });
    }

    const tipoClienteId = await asegurarTipoCliente(client);

    const result = await client.query(
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
        direccion_id,
        activo
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        tipoClienteId,
        limpiar(nombre),
        limpiar(nombre_comercial) || null,
        limpiar(documento) || null,
        limpiar(nit) || null,
        limpiar(nrc) || null,
        limpiar(telefono) || null,
        limpiar(correo) || null,
        direccion_id || null,
        Boolean(activo),
      ]
    );

    await registrarAuditoria(client, {
  usuario_id: req.user?.id || null,
  esquema: "terceros",
  tabla: "tercero",
  accion: "INSERT",
  datos_nuevos: result.rows[0],
  observacion: "Cliente creado",
});

    res.json({
      ok: true,
      mensaje: "Cliente creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({
        ok: false,
        mensaje: "Ya existe un cliente con ese documento o correo.",
      });
    }

    res.status(500).json({
      ok: false,
      mensaje: "Error al crear cliente",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const actualizarCliente = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      nombre,
      nombre_comercial,
      documento,
      nit,
      nrc,
      telefono,
      correo,
      direccion_id,
      activo = true,
    } = req.body;

    if (!validarTextoMinimo(nombre, 2)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El nombre del cliente es obligatorio.",
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El correo no tiene un formato válido.",
      });
    }

    if (!validarTelefono(telefono)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El teléfono no tiene un formato válido.",
      });
    }

    const result = await client.query(
      `
      UPDATE terceros.tercero
      SET
        nombre = $1,
        nombre_comercial = $2,
        documento = $3,
        nit = $4,
        nrc = $5,
        telefono = $6,
        correo = $7,
        direccion_id = $8,
        activo = $9
      WHERE id = $10
      RETURNING *
      `,
      [
        limpiar(nombre),
        limpiar(nombre_comercial) || null,
        limpiar(documento) || null,
        limpiar(nit) || null,
        limpiar(nrc) || null,
        limpiar(telefono) || null,
        limpiar(correo) || null,
        direccion_id || null,
        Boolean(activo),
        Number(id),
      ]
    );
    await registrarAuditoria(client, {
  usuario_id: req.user?.id || null,
  esquema: "terceros",
  tabla: "tercero",
  accion: "UPDATE",
  datos_nuevos: result.rows[0],
  observacion: "Cliente actualizado",
});

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Cliente no encontrado.",
      });
    }

    res.json({
      ok: true,
      mensaje: "Cliente actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({
        ok: false,
        mensaje: "Ya existe otro cliente con ese documento o correo.",
      });
    }

    res.status(500).json({
      ok: false,
      mensaje: "Error al actualizar cliente",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const eliminarCliente = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const existe = await client.query(
      `SELECT id FROM terceros.tercero WHERE id = $1 LIMIT 1`,
      [Number(id)]
    );

    if (existe.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Cliente no encontrado.",
      });
    }

    const result = await client.query(
      `
      UPDATE terceros.tercero
      SET activo = FALSE
      WHERE id = $1
      RETURNING *
      `,
      [Number(id)]
    );

    await registrarAuditoria(client, {
  usuario_id: req.user?.id || null,
  esquema: "terceros",
  tabla: "tercero",
  accion: "INACTIVAR",
  datos_nuevos: result.rows[0],
  observacion: "Cliente inactivado",
});

    res.json({
      ok: true,
      mensaje: "Cliente inactivado correctamente. No se eliminó para conservar historial.",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al inactivar cliente",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
};