require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const ejecutar = async () => {
  const client = await pool.connect();

  try {
    const usuarios = await client.query(`
      SELECT id, username, password
      FROM core.usuario
    `);

    for (const usuario of usuarios.rows) {
      const passwordActual = String(usuario.password || "");

      if (passwordActual.startsWith("$2a$") || passwordActual.startsWith("$2b$")) {
        console.log(`Usuario ${usuario.username} ya tiene password hasheado`);
        continue;
      }

      const hash = await bcrypt.hash(passwordActual, 12);

      await client.query(
        `UPDATE core.usuario SET password = $1 WHERE id = $2`,
        [hash, usuario.id]
      );

      console.log(`Password hasheado para usuario: ${usuario.username}`);
    }

    console.log("Proceso terminado.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    client.release();
    process.exit();
  }
};

ejecutar();