const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const rolRoutes = require("./routes/rolRoutes");
const empresaRoutes = require("./routes/empresaRoutes");
const productoRoutes = require("./routes/productoRoutes");
const clienteRoutes = require("./routes/clienteRoutes");
const ventaRoutes = require("./routes/ventaRoutes");
const dteRoutes = require("./routes/dteRoutes");
const inventarioRoutes = require("./routes/inventarioRoutes");
const pagoRoutes = require("./routes/pagoRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const correlativoRoutes = require("./routes/correlativoRoutes");
const auditoriaRoutes = require("./routes/auditoriaRoutes");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    ok: false,
    mensaje: "Demasiados intentos de inicio de sesión. Intenta más tarde.",
  },
});

app.get("/", (req, res) => {
  res.json({ mensaje: "Backend de Quanty Management funcionando" });
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      ok: true,
      mensaje: "Conexión a PostgreSQL correcta",
      fechaServidor: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: "Error al conectar con PostgreSQL",
      error: error.message,
    });
  }
});

app.use("/auth", loginLimiter, authRoutes);
app.use("/roles", rolRoutes);
app.use("/empresas", empresaRoutes);
app.use("/productos", productoRoutes);
app.use("/clientes", clienteRoutes);
app.use("/ventas", ventaRoutes);
app.use("/dte", dteRoutes);
app.use("/inventario", inventarioRoutes);
app.use("/pagos", pagoRoutes);
app.use("/usuarios", usuarioRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/correlativos", correlativoRoutes);
app.use("/auditoria", auditoriaRoutes);

module.exports = app;