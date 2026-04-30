const express = require("express");
const router = express.Router();

const {
  obtenerClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} = require("../controllers/clienteController");

const { requireUser, allowRoles } = require("../middlewares/auth");

router.get(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  obtenerClientes
);

router.post(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  crearCliente
);

router.put(
  "/:id",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  actualizarCliente
);

router.delete(
  "/:id",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  eliminarCliente
);

module.exports = router;