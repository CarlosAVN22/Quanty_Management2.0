const express = require("express");
const router = express.Router();

const {
  obtenerEmpresas,
  crearEmpresa,
  actualizarEmpresa,
  obtenerSucursales,
  obtenerSucursalesPorEmpresa,
  crearSucursal,
  actualizarSucursal,
  obtenerPuntosEmision,
  crearPuntoEmision,
} = require("../controllers/empresaController");

const { requireUser, allowRoles } = require("../middlewares/auth");

router.get(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  obtenerEmpresas
);

router.post(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  crearEmpresa
);

router.put(
  "/:id",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  actualizarEmpresa
);

router.get(
  "/:id/sucursales",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  obtenerSucursalesPorEmpresa
);

router.get(
  "/sucursales/lista",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  obtenerSucursales
);

router.post(
  "/sucursales",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  crearSucursal
);

router.put(
  "/sucursales/:id",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  actualizarSucursal
);

router.get(
  "/puntos-emision/lista",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  obtenerPuntosEmision
);

router.post(
  "/puntos-emision",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  crearPuntoEmision
);

module.exports = router;