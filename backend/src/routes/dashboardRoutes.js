const express = require("express");
const router = express.Router();

const { obtenerResumenDashboard } = require("../controllers/dashboardController");
const { requireUser } = require("../middlewares/auth");

router.get("/", requireUser, obtenerResumenDashboard);

module.exports = router;