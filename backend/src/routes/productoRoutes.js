const express = require("express");
const router = express.Router();

const {
  obtenerReferenciasProducto,
  obtenerProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} = require("../controllers/productoController");

const { requireUser, allowRoles } = require("../middlewares/auth");

router.get(
  "/referencias",
  requireUser,
  allowRoles(["ADMINISTRADOR", "BODEGUERO", "CAJERO"]),
  obtenerReferenciasProducto
);

router.get(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR", "BODEGUERO", "CAJERO"]),
  obtenerProductos
);

router.post(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR", "BODEGUERO"]),
  crearProducto
);

router.put(
  "/:id",
  requireUser,
  allowRoles(["ADMINISTRADOR", "BODEGUERO"]),
  actualizarProducto
);

router.delete(
  "/:id",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  eliminarProducto
);

module.exports = router;