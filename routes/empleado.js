const express = require("express");
const router = express.Router();
const bcryptjs = require("bcryptjs");
const pool = require("../config/db"); // Asumiendo que usas un pool de conexión para tu base de datos

// Endpoint para registrar un empleado
router.post("/registro", async (req, res) => {
  try {
    const { usuario, clave } = req.body;

    // Validar que se hayan enviado los datos mínimos
    if (!usuario || !clave) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    // Verificar si el usuario ya existe
    const [usuariosExistentes] = await pool.query("SELECT * FROM usuarios WHERE usuario = ?", [usuario]);
    if (usuariosExistentes.length > 0) {
      return res.status(400).json({ error: "El usuario ya existe" });
    }

    // Hashear la contraseña usando bcryptjs
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(clave, salt);

    // Insertar el nuevo usuario en la base de datos con rol "empleado"
    await pool.query(
      "INSERT INTO usuarios (id_cliente, usuario, clave, rol) VALUES (0, ?, ?, 'Operador')",
      [usuario, hash, "Operador"]
    );

    res.json({ msg: "Usuario empleado creado correctamente" });
  } catch (error) {
    console.error("Error en el registro de empleado:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

module.exports = router;
