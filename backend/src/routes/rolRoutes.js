const express = require("express");
const router = express.Router();

const { obtenerRoles } = require("../controllers/rolController");
const { requireUser, allowRoles } = require("../middlewares/auth");

router.get(
  "/",
  requireUser,
  allowRoles(["ADMINISTRADOR"]),
  obtenerRoles
);

module.exports = router;