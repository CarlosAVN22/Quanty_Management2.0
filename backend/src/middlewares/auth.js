const jwt = require("jsonwebtoken");

const normalizar = (value) => String(value || "").trim().toUpperCase();

const requireUser = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        mensaje: "Debes iniciar sesión para usar este módulo.",
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      username: decoded.username,
      nombre: decoded.nombre,
      correo: decoded.correo,
      rol: normalizar(decoded.rol),
      sucursal_id: decoded.sucursal_id || null,
      ambiente: decoded.ambiente || "TEST",
    };

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      mensaje: "Sesión inválida o expirada. Inicia sesión nuevamente.",
    });
  }
};

const allowRoles = (roles = []) => {
  const permitidos = roles.map(normalizar);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        mensaje: "No se encontró un usuario autenticado.",
      });
    }

    if (!permitidos.includes(req.user.rol)) {
      return res.status(403).json({
        ok: false,
        mensaje: "No tienes permisos para entrar a este módulo.",
      });
    }

    next();
  };
};

module.exports = { requireUser, allowRoles };