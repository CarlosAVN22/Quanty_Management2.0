const express = require("express");
const router = express.Router();

const {
  obtenerCorrelativos,
  crearCorrelativo,
  actualizarCorrelativo,
  obtenerSiguienteCorrelativo,
} = require("../controllers/correlativoController");

const { requireUser, allowRoles } = require("../middlewares/auth");

router.get("/", requireUser, allowRoles(["ADMINISTRADOR"]), obtenerCorrelativos);
router.post("/", requireUser, allowRoles(["ADMINISTRADOR"]), crearCorrelativo);
router.put("/:id", requireUser, allowRoles(["ADMINISTRADOR"]), actualizarCorrelativo);
router.post("/:id/siguiente", requireUser, allowRoles(["ADMINISTRADOR"]), obtenerSiguienteCorrelativo);

module.exports = router;