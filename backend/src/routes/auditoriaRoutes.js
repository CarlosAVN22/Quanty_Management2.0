const express = require("express");
const router = express.Router();

const { obtenerLogs } = require("../controllers/auditoriaController");
const { requireUser, allowRoles } = require("../middlewares/auth");

router.get(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  obtenerLogs
);

module.exports = router;