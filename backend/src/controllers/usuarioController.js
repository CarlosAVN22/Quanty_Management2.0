const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const asegurarRolesBase = async (client) => {
  const roles = [
    { nombre: "ADMINISTRADOR", descripcion: "Acceso total al sistema" },
    { nombre: "CAJERO", descripcion: "Gestión de ventas y facturación" },
    { nombre: "BODEGUERO", descripcion: "Gestión de inventario" },
  ];

  for (const rol of roles) {
    await client.query(
      `
      INSERT INTO core.rol (nombre, descripcion)
      VALUES ($1, $2)
      ON CONFLICT (nombre) DO NOTHING
      `,
      [rol.nombre, rol.descripcion]
    );
  }
};

const validarCorreo = (correo) => {
  if (!correo) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
};

const validarPassword = (password) => {
  if (!password) return false;
  return String(password).length >= 8;
};

const obtenerRoles = async (req, res) => {
  const client = await pool.connect();

  try {
    await asegurarRolesBase(client);

    const result = await client.query(`
      SELECT id, nombre, descripcion
      FROM core.rol
      ORDER BY id ASC
    `);

    res.json({
      ok: true,
      mensaje: "Roles obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener roles",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerUsuarios = async (req, res) => {
  const client = await pool.connect();

  try {
    await asegurarRolesBase(client);

    const result = await client.query(`
      SELECT
        u.id,
        u.username,
        u.nombre_completo,
        u.correo,
        u.rol_id,
        r.nombre AS rol_nombre,
        u.activo,
        u.fecha_creacion
      FROM core.usuario u
      INNER JOIN core.rol r ON r.id = u.rol_id
      ORDER BY u.id ASC
    `);

    res.json({
      ok: true,
      mensaje: "Usuarios obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al obtener usuarios",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const crearUsuario = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      username,
      password,
      nombre_completo,
      correo,
      rol_id,
      activo = true,
    } = req.body;

    if (!username || !String(username).trim()) {
      return res.status(400).json({
        ok: false,
        mensaje: "El username es obligatorio.",
      });
    }

    if (!validarPassword(password)) {
      return res.status(400).json({
        ok: false,
        mensaje: "La contraseña debe tener al menos 8 caracteres.",
      });
    }

    if (!rol_id) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe seleccionar un rol.",
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El correo no tiene un formato válido.",
      });
    }

    await asegurarRolesBase(client);

    const rolExiste = await client.query(
      `SELECT id FROM core.rol WHERE id = $1 LIMIT 1`,
      [rol_id]
    );

    if (rolExiste.rowCount === 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "El rol seleccionado no existe.",
      });
    }

    const passwordHash = await bcrypt.hash(String(password).trim(), 12);

    const result = await client.query(
      `
      INSERT INTO core.usuario
      (
        username,
        password,
        nombre_completo,
        correo,
        rol_id,
        activo
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, nombre_completo, correo, rol_id, activo, fecha_creacion
      `,
      [
        String(username).trim(),
        passwordHash,
        nombre_completo || null,
        correo || null,
        rol_id,
        Boolean(activo),
      ]
    );

    res.json({
      ok: true,
      mensaje: "Usuario creado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({
        ok: false,
        mensaje: "Ya existe un usuario con ese username.",
      });
    }

    res.status(500).json({
      ok: false,
      mensaje: "Error al crear usuario",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const actualizarUsuario = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      username,
      password,
      nombre_completo,
      correo,
      rol_id,
      activo,
    } = req.body;

    if (!username || !String(username).trim()) {
      return res.status(400).json({
        ok: false,
        mensaje: "El username es obligatorio.",
      });
    }

    if (!rol_id) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe seleccionar un rol.",
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El correo no tiene un formato válido.",
      });
    }

    const usuarioActual = await client.query(
      `
      SELECT u.id, u.password, r.nombre AS rol_nombre
      FROM core.usuario u
      INNER JOIN core.rol r ON r.id = u.rol_id
      WHERE u.id = $1
      `,
      [id]
    );

    if (usuarioActual.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: "Usuario no encontrado.",
      });
    }

    let passwordFinal = usuarioActual.rows[0].password;

    if (password && String(password).trim()) {
      if (!validarPassword(password)) {
        return res.status(400).json({
          ok: false,
          mensaje: "La nueva contraseña debe tener al menos 8 caracteres.",
        });
      }

      passwordFinal = await bcrypt.hash(String(password).trim(), 12);
    }

    const result = await client.query(
      `
      UPDATE core.usuario
      SET
        username = $1,
        password = $2,
        nombre_completo = $3,
        correo = $4,
        rol_id = $5,
        activo = $6
      WHERE id = $7
      RETURNING id, username, nombre_completo, correo, rol_id, activo, fecha_creacion
      `,
      [
        String(username).trim(),
        passwordFinal,
        nombre_completo || null,
        correo || null,
        rol_id,
        Boolean(activo),
        id,
      ]
    );

    res.json({
      ok: true,
      mensaje: "Usuario actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({
        ok: false,
        mensaje: "Ya existe otro usuario con ese username.",
      });
    }

    res.status(500).json({
      ok: false,
      mensaje: "Error al actualizar usuario",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const cambiarEstadoUsuario = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const actual = await client.query(
      `
      SELECT u.id, u.activo, r.nombre AS rol_nombre
      FROM core.usuario u
      INNER JOIN core.rol r ON r.id = u.rol_id
      WHERE u.id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (actual.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        ok: false,
        mensaje: "Usuario no encontrado.",
      });
    }

    const usuario = actual.rows[0];
    const nuevoEstado = !usuario.activo;

    if (usuario.rol_nombre === "ADMINISTRADOR" && nuevoEstado === false) {
      const adminsActivos = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM core.usuario u
        INNER JOIN core.rol r ON r.id = u.rol_id
        WHERE r.nombre = 'ADMINISTRADOR'
        AND u.activo = TRUE
        AND u.id <> $1
        `,
        [id]
      );

      if (adminsActivos.rows[0].total === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          ok: false,
          mensaje: "No puedes desactivar al último administrador activo.",
        });
      }
    }

    const result = await client.query(
      `
      UPDATE core.usuario
      SET activo = $1
      WHERE id = $2
      RETURNING id, username, nombre_completo, correo, rol_id, activo, fecha_creacion
      `,
      [nuevoEstado, id]
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      mensaje: "Estado del usuario actualizado correctamente",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    res.status(500).json({
      ok: false,
      mensaje: "Error al cambiar el estado del usuario",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerRoles,
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
};