require("dotenv").config();
const express = require("express");
const cors = require("cors");
const clientesRoutes = require("./routes/clientes");
// borrar despues cons pool
const pool = require('../config/db');

const app = express();
app.use(cors());
app.use(express.json());
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientesRoutes);

const PORT = process.env.PORT || 5000;
app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
        console.log(`Ruta activa: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});
// borrar despues de la prueba
app.get('/', (req, res) => {
    res.send('¡Hola, estoy funcionando en Railway!');
  });

  app.get('/test-db', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT NOW() AS fecha');
      res.json({ ok: true, fecha: rows[0].fecha });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
// 

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
