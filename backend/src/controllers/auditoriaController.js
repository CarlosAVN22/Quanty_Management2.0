const pool = require("../config/db");

const obtenerLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.usuario_id,
        u.username,
        l.esquema,
        l.tabla,
        l.accion,
        l.fecha,
        l.observacion,
        l.datos_anteriores,
        l.datos_nuevos
      FROM auditoria.log l
      LEFT JOIN core.usuario u ON u.id = l.usuario_id
      ORDER BY l.id DESC
      LIMIT 200
    `);

    res.json({
      ok: true,
      mensaje: "Bitácora obtenida correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener bitácora",
      error: error.message,
    });
  }
};

module.exports = { obtenerLogs };