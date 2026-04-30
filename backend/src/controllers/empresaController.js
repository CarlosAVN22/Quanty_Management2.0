const pool = require("../config/db");

const limpiar = (v) => String(v || "").trim();

const validarCorreo = (correo) => {
  if (!correo) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
};

const validarTelefono = (telefono) => {
  if (!telefono) return true;
  return /^[0-9+\-\s]{7,20}$/.test(telefono);
};

const obtenerEmpresas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, nombre_comercial, nit, nrc, telefono, correo, logo_url, direccion_id, activo
      FROM core.empresa
      ORDER BY id ASC
    `);

    res.json({ ok: true, mensaje: "Empresas obtenidas correctamente", data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: "Error al obtener empresas", error: error.message });
  }
};

const crearEmpresa = async (req, res) => {
  const client = await pool.connect();

  try {
    const { nombre, nombre_comercial, nit, nrc, telefono, correo, logo_url, direccion_id, activo = true } = req.body;

    if (!limpiar(nombre)) return res.status(400).json({ ok: false, mensaje: "El nombre de la empresa es obligatorio." });
    if (!limpiar(nit)) return res.status(400).json({ ok: false, mensaje: "El NIT de la empresa es obligatorio." });
    if (!validarCorreo(correo)) return res.status(400).json({ ok: false, mensaje: "El correo no tiene formato válido." });
    if (!validarTelefono(telefono)) return res.status(400).json({ ok: false, mensaje: "El teléfono no tiene formato válido." });

    const result = await client.query(
      `
      INSERT INTO core.empresa
      (nombre, nombre_comercial, nit, nrc, telefono, correo, logo_url, direccion_id, activo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        limpiar(nombre),
        limpiar(nombre_comercial) || null,
        limpiar(nit),
        limpiar(nrc) || null,
        limpiar(telefono) || null,
        limpiar(correo) || null,
        limpiar(logo_url) || null,
        direccion_id || null,
        Boolean(activo),
      ]
    );

    res.json({ ok: true, mensaje: "Empresa creada correctamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.code === "23505" ? "Ya existe una empresa con ese NIT." : error.message,
    });
  } finally {
    client.release();
  }
};

const actualizarEmpresa = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { nombre, nombre_comercial, nit, nrc, telefono, correo, logo_url, direccion_id, activo = true } = req.body;

    if (!limpiar(nombre)) return res.status(400).json({ ok: false, mensaje: "El nombre de la empresa es obligatorio." });
    if (!limpiar(nit)) return res.status(400).json({ ok: false, mensaje: "El NIT de la empresa es obligatorio." });
    if (!validarCorreo(correo)) return res.status(400).json({ ok: false, mensaje: "El correo no tiene formato válido." });
    if (!validarTelefono(telefono)) return res.status(400).json({ ok: false, mensaje: "El teléfono no tiene formato válido." });

    const result = await client.query(
      `
      UPDATE core.empresa
      SET nombre=$1, nombre_comercial=$2, nit=$3, nrc=$4, telefono=$5, correo=$6,
          logo_url=$7, direccion_id=$8, activo=$9
      WHERE id=$10
      RETURNING *
      `,
      [
        limpiar(nombre),
        limpiar(nombre_comercial) || null,
        limpiar(nit),
        limpiar(nrc) || null,
        limpiar(telefono) || null,
        limpiar(correo) || null,
        limpiar(logo_url) || null,
        direccion_id || null,
        Boolean(activo),
        Number(id),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Empresa no encontrada." });
    }

    res.json({ ok: true, mensaje: "Empresa actualizada correctamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.code === "23505" ? "Ya existe otra empresa con ese NIT." : error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerSucursales = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, e.nombre AS empresa_nombre
      FROM core.sucursal s
      INNER JOIN core.empresa e ON e.id = s.empresa_id
      ORDER BY s.id ASC
    `);

    res.json({ ok: true, mensaje: "Sucursales obtenidas correctamente", data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: "Error al obtener sucursales", error: error.message });
  }
};

const obtenerSucursalesPorEmpresa = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT id, empresa_id, nombre, telefono, correo, direccion_id, activo
      FROM core.sucursal
      WHERE empresa_id = $1
      ORDER BY id ASC
      `,
      [Number(id)]
    );

    res.json({ ok: true, mensaje: "Sucursales obtenidas correctamente", data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: "Error al obtener sucursales", error: error.message });
  }
};

const crearSucursal = async (req, res) => {
  const client = await pool.connect();

  try {
    const { empresa_id, nombre, telefono, correo, direccion_id, activo = true } = req.body;

    if (!empresa_id) return res.status(400).json({ ok: false, mensaje: "Debe indicar la empresa." });
    if (!limpiar(nombre)) return res.status(400).json({ ok: false, mensaje: "El nombre de la sucursal es obligatorio." });
    if (!validarCorreo(correo)) return res.status(400).json({ ok: false, mensaje: "El correo no tiene formato válido." });
    if (!validarTelefono(telefono)) return res.status(400).json({ ok: false, mensaje: "El teléfono no tiene formato válido." });

    const empresa = await client.query(
      `SELECT id FROM core.empresa WHERE id=$1 AND activo=TRUE`,
      [Number(empresa_id)]
    );

    if (empresa.rowCount === 0) {
      return res.status(400).json({ ok: false, mensaje: "La empresa no existe o está inactiva." });
    }

    const result = await client.query(
      `
      INSERT INTO core.sucursal
      (empresa_id, nombre, telefono, correo, direccion_id, activo)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        Number(empresa_id),
        limpiar(nombre),
        limpiar(telefono) || null,
        limpiar(correo) || null,
        direccion_id || null,
        Boolean(activo),
      ]
    );

    res.json({ ok: true, mensaje: "Sucursal creada correctamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  } finally {
    client.release();
  }
};

const actualizarSucursal = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { empresa_id, nombre, telefono, correo, direccion_id, activo = true } = req.body;

    if (!empresa_id) return res.status(400).json({ ok: false, mensaje: "Debe indicar la empresa." });
    if (!limpiar(nombre)) return res.status(400).json({ ok: false, mensaje: "El nombre de la sucursal es obligatorio." });
    if (!validarCorreo(correo)) return res.status(400).json({ ok: false, mensaje: "El correo no tiene formato válido." });
    if (!validarTelefono(telefono)) return res.status(400).json({ ok: false, mensaje: "El teléfono no tiene formato válido." });

    const result = await client.query(
      `
      UPDATE core.sucursal
      SET empresa_id=$1, nombre=$2, telefono=$3, correo=$4, direccion_id=$5, activo=$6
      WHERE id=$7
      RETURNING *
      `,
      [
        Number(empresa_id),
        limpiar(nombre),
        limpiar(telefono) || null,
        limpiar(correo) || null,
        direccion_id || null,
        Boolean(activo),
        Number(id),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, mensaje: "Sucursal no encontrada." });
    }

    res.json({ ok: true, mensaje: "Sucursal actualizada correctamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ ok: false, mensaje: error.message });
  } finally {
    client.release();
  }
};

const obtenerPuntosEmision = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pe.*, s.nombre AS sucursal_nombre
      FROM core.punto_emision pe
      INNER JOIN core.sucursal s ON s.id = pe.sucursal_id
      ORDER BY pe.id ASC
    `);

    res.json({ ok: true, mensaje: "Puntos de emisión obtenidos correctamente", data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: "Error al obtener puntos de emisión", error: error.message });
  }
};

const crearPuntoEmision = async (req, res) => {
  const client = await pool.connect();

  try {
    const { sucursal_id, codigo, descripcion, activo = true } = req.body;

    if (!sucursal_id) return res.status(400).json({ ok: false, mensaje: "Debe indicar la sucursal." });
    if (!limpiar(codigo)) return res.status(400).json({ ok: false, mensaje: "El código del punto de emisión es obligatorio." });

    const sucursal = await client.query(
      `SELECT id FROM core.sucursal WHERE id=$1 AND activo=TRUE`,
      [Number(sucursal_id)]
    );

    if (sucursal.rowCount === 0) {
      return res.status(400).json({ ok: false, mensaje: "La sucursal no existe o está inactiva." });
    }

    const result = await client.query(
      `
      INSERT INTO core.punto_emision
      (sucursal_id, codigo, descripcion, activo)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [
        Number(sucursal_id),
        limpiar(codigo).toUpperCase(),
        limpiar(descripcion) || null,
        Boolean(activo),
      ]
    );

    res.json({ ok: true, mensaje: "Punto de emisión creado correctamente", data: result.rows[0] });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.code === "23505" ? "Ya existe ese código para la sucursal." : error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerEmpresas,
  crearEmpresa,
  actualizarEmpresa,
  obtenerSucursales,
  obtenerSucursalesPorEmpresa,
  crearSucursal,
  actualizarSucursal,
  obtenerPuntosEmision,
  crearPuntoEmision,
};