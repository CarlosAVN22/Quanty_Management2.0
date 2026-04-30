const express = require("express");
const router = express.Router();

const {
  obtenerPagos,
  registrarPago,
  obtenerMetodosPago,
  obtenerVentasPendientes,
} = require("../controllers/pagoController");

const { requireUser, allowRoles } = require("../middlewares/auth");

// 🔹 Métodos de pago (para combos en frontend)
router.get(
  "/metodos",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  obtenerMetodosPago
);

// 🔹 Ventas pendientes (para seleccionar en pagos)
router.get(
  "/ventas",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  obtenerVentasPendientes
);

// 🔹 Listado de pagos
router.get(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  obtenerPagos
);

// 🔹 Registrar pago
router.post(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR", "CAJERO"]),
  registrarPago
);

module.exports = router;