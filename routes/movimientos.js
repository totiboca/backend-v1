const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db"); // Asegúrate de que esta ruta apunte a tu configuración del pool de conexión

// Configuración de multer para almacenar archivos temporalmente en la carpeta "uploads/"
const upload = multer({ dest: "uploads/" });

// Endpoint para importar CSV de movimientos
router.post("/import_csv", upload.single("file"), (req, res) => {
  // Paso 1: Verificar que se haya enviado un archivo
  if (!req.file) {
    return res.status(400).json({ error: "No se encontró el archivo en la solicitud" });
  }

  // Paso 2: Verificar que el archivo tenga extensión CSV
  if (path.extname(req.file.originalname).toLowerCase() !== ".csv") {
    return res.status(400).json({ error: "Tipo de archivo no permitido" });
  }

  const results = [];
  // Usamos csv-parser y especificamos los headers manualmente, ya que el archivo tendrá 5 columnas sin encabezado
  fs.createReadStream(req.file.path)
    .pipe(csv({ headers: ['id_ruta', 'lleva', 'trae', 'fecha_remito', 'n_remito', 'fecha_carga'] }))
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      try {
        let count = 0;
        // Iteramos por cada fila del CSV
        for (const row of results) {
          // Convertimos y asignamos los valores:
          // - Convertimos la primera columna a entero para "id_ruta"
          const id_ruta = parseInt(row.id_ruta);
          // La segunda y tercera columna se toman como texto para "lleva" y "trae"
          const lleva = row.lleva;
          const trae = row.trae;
          // Convertimos la cuarta columna a un objeto Date (se espera el formato YYYY-MM-DD)
          const fecha_remito = new Date(row.fecha_remito);
          // La quinta columna se asigna a "n_remito"; si está vacía, se asigna null
          const n_remito = row.n_remito && row.n_remito.trim() !== '' ? row.n_remito : null;
          const fecha_carga = new Date(row.fecha_carga);

          // Insertamos cada registro en la tabla "movimientos"
          await pool.query(
            "INSERT INTO movimientos (id_ruta, lleva, trae, fecha_remito, n_remito, fecha_carga) VALUES (?, ?, ?, ?, ?, ?)",
            [id_ruta, lleva, trae, fecha_remito, n_remito, fecha_carga]
          );
          count++; // Incrementamos el contador de registros insertados
        }
        // Eliminamos el archivo temporal una vez procesado
        fs.unlinkSync(req.file.path);
        // Devolvemos la cantidad de registros importados
        res.status(201).json({ msg: `Datos importados correctamente, se importaron ${count} registros` });
      } catch (error) {
        console.error("Error al procesar el CSV:", error);
        res.status(500).json({ error: "Error al procesar el CSV", details: error.message });
      }
    });
});

module.exports = router;
