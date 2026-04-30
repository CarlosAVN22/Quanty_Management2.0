const express = require("express");
const router = express.Router();

const {
    obtenerRoles,
    obtenerUsuarios,
    crearUsuario,
    actualizarUsuario,
    cambiarEstadoUsuario,
} = require("../controllers/usuarioController");
const { requireUser, allowRoles } = require("../middlewares/auth");

router.get("/roles", requireUser, allowRoles(["ADMINISTRADOR"]), obtenerRoles);
router.get("/", requireUser, allowRoles(["ADMINISTRADOR"]), obtenerUsuarios);
router.post("/", requireUser, allowRoles(["ADMINISTRADOR"]), crearUsuario);
router.put("/:id", requireUser, allowRoles(["ADMINISTRADOR"]), actualizarUsuario);
router.patch("/:id/estado", requireUser, allowRoles(["ADMINISTRADOR"]), cambiarEstadoUsuario);

module.exports = router;