require("dotenv").config();
const express = require("express");
const cors = require("cors");
const clientesRoutes = require("./routes/clientes");
const path = require('path');
const empleadoRoutes = require("./routes/empleado");
const app = express();
// Middleware para parsear JSON

const movimientosRoutes = require("./routes/movimientos");
app.use("/movimientos", movimientosRoutes);





app.use(cors()); 
// app.use(cors({
//     origin: [
//       "http://localhost:3000",
//       "https://prueba-bandejas-production-2691.up.railway.app/",
//       "https://prueba-bandejas-prod-1.up.railway.app",
//       "https://prueba-bandejas-prod-1.up.railway.app/api",
//       "prueba-bandejas-production.up.railway.app",
//               // Si pruebas en local
//       "https://empleado-bandejas-production.up.railway.app", // O la URL de tu frontend en producción
//       "https://frontend-clientes-production.up.railway.app"
//          // Si tienes otro frontend
//     ],
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     credentials: true
//   }));
// 

app.use(express.json());
// Rutas de empleado, usando un prefijo (por ejemplo, "/api/empleado")
app.use("/api/empleado", empleadoRoutes);


const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientesRoutes);


// // Ruta a la carpeta de tu build- activar para servidor
// app.use(express.static(path.join(__dirname, '../frontend/build')));

// // Para manejar rutas tipo SPA (React Router):
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
// });


const PORT = process.env.PORT || 5000;
app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
        console.log(`Ruta activa: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    }
});


app.use(express.static(path.join(__dirname, "build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});



app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
