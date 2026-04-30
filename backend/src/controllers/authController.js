const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { normalizarAmbiente } = require("../utils/dteCatalog");

const asegurarRolesBase = async (client) => {
  const roles = [
    { nombre: "ADMINISTRADOR", descripcion: "Acceso total al sistema" },
    { nombre: "CAJERO", descripcion: "Gestión de ventas y cobros" },
    { nombre: "BODEGUERO", descripcion: "Gestión de inventario y kardex" },
  ];

  for (const rol of roles) {
    await client.query(
      `INSERT INTO core.rol (nombre, descripcion)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO NOTHING`,
      [rol.nombre, rol.descripcion]
    );
  }
};

const obtenerEmpresaActiva = async (client) => {
  const result = await client.query(
    `SELECT id, nombre, nombre_comercial
     FROM core.empresa
     WHERE activo = TRUE
     ORDER BY id ASC
     LIMIT 1`
  );

  return result.rows[0] || null;
};

const obtenerSucursalesActivas = async (client, empresaId) => {
  if (!empresaId) return [];

  const result = await client.query(
    `SELECT id, empresa_id, nombre, telefono, correo, activo
     FROM core.sucursal
     WHERE empresa_id = $1 AND activo = TRUE
     ORDER BY id ASC`,
    [empresaId]
  );

  return result.rows;
};

const obtenerContextoLogin = async (req, res) => {
  const client = await pool.connect();

  try {
    await asegurarRolesBase(client);

    const empresa = await obtenerEmpresaActiva(client);
    const sucursales = await obtenerSucursalesActivas(client, empresa?.id);

    return res.json({
      ok: true,
      data: {
        empresa,
        sucursales,
        ambientes: [
          { codigo: "TEST", nombre: "Ambiente de prueba" },
          { codigo: "PRODUCCION", nombre: "Ambiente productivo" },
        ],
        ambiente_default: "TEST",
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo cargar el contexto del login.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const client = await pool.connect();

  try {
    const { username, password, sucursal_id, ambiente } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: "Usuario y contraseña son obligatorios.",
      });
    }

    const result = await client.query(
      `SELECT 
          u.id,
          u.username,
          u.password,
          u.nombre_completo,
          u.correo,
          u.activo,
          r.nombre AS rol
       FROM core.usuario u
       INNER JOIN core.rol r ON r.id = u.rol_id
       WHERE LOWER(u.username) = LOWER($1)
       LIMIT 1`,
      [String(username).trim()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        ok: false,
        mensaje: "Credenciales inválidas.",
      });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(403).json({
        ok: false,
        mensaje: "El usuario está inactivo.",
      });
    }

    const passwordCorrecta = await bcrypt.compare(String(password), String(user.password));

    if (!passwordCorrecta) {
      return res.status(401).json({
        ok: false,
        mensaje: "Credenciales inválidas.",
      });
    }

    let sucursal = null;

    if (sucursal_id) {
      const sucursalRes = await client.query(
        `SELECT id, nombre
         FROM core.sucursal
         WHERE id = $1 AND activo = TRUE
         LIMIT 1`,
        [Number(sucursal_id)]
      );

      sucursal = sucursalRes.rows[0] || null;
    }

    const payload = {
      id: user.id,
      username: user.username,
      nombre: user.nombre_completo || user.username,
      correo: user.correo,
      rol: user.rol,
      sucursal_id: sucursal?.id || null,
      ambiente: normalizarAmbiente(ambiente),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    });

    return res.json({
      ok: true,
      mensaje: "Inicio de sesión correcto.",
      data: {
        ...payload,
        sucursal_nombre: sucursal?.nombre || null,
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      mensaje: "Error al iniciar sesión.",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  login,
  obtenerContextoLogin,
  asegurarRolesBase,
};