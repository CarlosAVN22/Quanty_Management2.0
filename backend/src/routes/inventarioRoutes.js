const express = require("express");
const router = express.Router();

const {
  obtenerExistencias,
  obtenerMovimientos,
  obtenerKardex,
  registrarMovimiento,
} = require("../controllers/inventarioController");

const { requireUser, allowRoles } = require("../middlewares/auth");

router.get(
  "/existencias",
  requireUser,
  allowRoles(["ADMINISTRADOR", "BODEGUERO", "CAJERO"]),
  obtenerExistencias
);

router.get(
  "/movimientos",
  requireUser,
  allowRoles(["ADMINISTRADOR", "BODEGUERO"]),
  obtenerMovimientos
);

router.get(
  "/kardex",
  requireUser,
  allowRoles(["ADMINISTRADOR", "BODEGUERO"]),
  obtenerKardex
);

router.post(
  "/movimientos",
  requireUser,
  allowRoles(["ADMINISTRADOR", "BODEGUERO"]),
  registrarMovimiento
);

module.exports = router;