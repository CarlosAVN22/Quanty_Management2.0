const pool = require("../config/db");

const limpiar = (v) => String(v || "").trim();

const obtenerCorrelativos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.empresa_id,
        e.nombre AS empresa,
        c.sucursal_id,
        s.nombre AS sucursal,
        c.punto_emision_id,
        pe.codigo AS punto_emision,
        c.tipo_dte,
        c.serie,
        c.ultimo_numero,
        c.activo,
        c.fecha_creacion
      FROM dte.correlativo_documento c
      INNER JOIN core.empresa e ON e.id = c.empresa_id
      INNER JOIN core.sucursal s ON s.id = c.sucursal_id
      INNER JOIN core.punto_emision pe ON pe.id = c.punto_emision_id
      ORDER BY c.id ASC
    `);

    res.json({
      ok: true,
      mensaje: "Correlativos obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener correlativos",
      error: error.message,
    });
  }
};

const crearCorrelativo = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      empresa_id,
      sucursal_id,
      punto_emision_id,
      tipo_dte,
      serie,
      ultimo_numero = 0,
      activo = true,
    } = req.body;

    if (!empresa_id) throw new Error("Debe indicar la empresa.");
    if (!sucursal_id) throw new Error("Debe indicar la sucursal.");
    if (!punto_emision_id) throw new Error("Debe indicar el punto de emisión.");
    if (!limpiar(tipo_dte)) throw new Error("Debe indicar el tipo DTE.");
    if (!limpiar(serie)) throw new Error("Debe indicar la serie.");

    const result = await client.query(
      `
      INSERT INTO dte.correlativo_documento
      (
        empresa_id,
        sucursal_id,
        punto_emision_id,
        tipo_dte,
        serie,
        ultimo_numero,
        activo
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        empresa_id,
        sucursal_id,
        punto_emision_id,
        limpiar(tipo_dte),
        limpiar(serie).toUpperCase(),
        Number(ultimo_numero),
        Boolean(activo),
      ]
    );

    res.json({
      ok: true,
      mensaje: "Correlativo creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje:
        error.code === "23505"
          ? "Ya existe un correlativo para esa empresa, sucursal, punto, tipo DTE y serie."
          : error.message,
    });
  } finally {
    client.release();
  }
};

const actualizarCorrelativo = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      tipo_dte,
      serie,
      ultimo_numero,
      activo = true,
    } = req.body;

    if (!limpiar(tipo_dte)) throw new Error("Debe indicar el tipo DTE.");
    if (!limpiar(serie)) throw new Error("Debe indicar la serie.");

    const result = await client.query(
      `
      UPDATE dte.correlativo_documento
      SET
        tipo_dte = $1,
        serie = $2,
        ultimo_numero = $3,
        activo = $4
      WHERE id = $5
      RETURNING *
      `,
      [
        limpiar(tipo_dte),
        limpiar(serie).toUpperCase(),
        Number(ultimo_numero || 0),
        Boolean(activo),
        Number(id),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Correlativo no encontrado.",
      });
    }

    res.json({
      ok: true,
      mensaje: "Correlativo actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      mensaje: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerSiguienteCorrelativo = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const actual = await client.query(
      `
      SELECT *
      FROM dte.correlativo_documento
      WHERE id = $1 AND activo = TRUE
      FOR UPDATE
      `,
      [Number(id)]
    );

    if (actual.rowCount === 0) {
      throw new Error("Correlativo no encontrado o inactivo.");
    }

    const correlativo = actual.rows[0];
    const siguiente = Number(correlativo.ultimo_numero) + 1;

    const actualizado = await client.query(
      `
      UPDATE dte.correlativo_documento
      SET ultimo_numero = $1
      WHERE id = $2
      RETURNING *
      `,
      [siguiente, Number(id)]
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      mensaje: "Siguiente correlativo generado correctamente",
      data: {
        ...actualizado.rows[0],
        numero_formateado: String(siguiente).padStart(15, "0"),
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
  obtenerCorrelativos,
  crearCorrelativo,
  actualizarCorrelativo,
  obtenerSiguienteCorrelativo,
};