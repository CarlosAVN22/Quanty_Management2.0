const pool = require("../config/db");

const obtenerRoles = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM core.rol ORDER BY id ASC");
        res.json({
            ok: true,
            mensaje: "Lista de roles obtenida correctamente",
            data: result.rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            ok: false,
            mensaje: "Error al obtener los roles",
            error: error.message,
        });
    }
};

module.exports = {
    obtenerRoles,
};