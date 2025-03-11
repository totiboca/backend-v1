require("dotenv").config();
const express = require("express");
const cors = require("cors");
const clientesRoutes = require("./routes/clientes");

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


app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
