const express = require("express");
const router = express.Router();

const {
  obtenerVentas,
  crearVenta,
} = require("../controllers/ventaController");

const { requireUser, allowRoles } = require("../middlewares/auth");

router.get(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  obtenerVentas
);

router.post(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  crearVenta
);

module.exports = router;