const express = require("express");
const router = express.Router();

const {
    obtenerDocumentosDTE,
    obtenerDocumentoDTEDetalle,
    enviarDTE,
    obtenerTiposDTE,
} = require("../controllers/dteController");
const { requireUser, allowRoles } = require("../middlewares/auth");

router.get("/tipos", requireUser, obtenerTiposDTE);
router.get("/", requireUser, allowRoles(["ADMINISTRADOR", "CAJERO"]), obtenerDocumentosDTE);
router.get("/:id", requireUser, allowRoles(["ADMINISTRADOR", "CAJERO"]), obtenerDocumentoDTEDetalle);
router.post("/:id/enviar", requireUser, allowRoles(["ADMINISTRADOR", "CAJERO"]), enviarDTE);

module.exports = router;