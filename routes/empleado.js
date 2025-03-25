const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");


const SECRET_KEY = process.env.JWT_SECRET;  // Asumiendo que usas un pool de conexión para tu base de datos

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

    // Insertar el nuevo usuario en la base de datos con rol "Operador"
    await pool.query(
      "INSERT INTO usuarios ( usuario, clave, rol) VALUES ( ?, ?, 'Operador')",
      [usuario, hash, "Operador"]
    );

    res.json({ msg: "Usuario empleado creado correctamente" });
  } catch (error) {
    console.error("Error en el registro de empleado:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { usuario, clave } = req.body;

    // Validar datos mínimos
    if (!usuario || !clave) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    // Buscar el usuario en la base de datos
    const [rows] = await pool.query("SELECT * FROM usuarios WHERE usuario = ?", [usuario]);
    if (rows.length === 0) {
      // No existe ese usuario
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = rows[0]; // { id, usuario, clave, rol, ... }

    // Verificar la contraseña (clave) usando bcryptjs
    const match = await bcryptjs.compare(clave, user.clave);
    if (!match) {
      // La contraseña no coincide
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Si todo es correcto, generamos un token JWT
    // Reemplaza "supersecretkey" por una variable de entorno en producción
    const token = jwt.sign(
      { id: user.id, rol: user.rol },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    // Devolvemos el token y el rol
    res.json({
      token,
      rol: user.rol
    });
  } catch (error) {
    console.error("Error en el login:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
}); 


// Configuración de multer para guardar el archivo temporalmente en "uploads/"
const upload = multer({ dest: "uploads/" });

// Endpoint para cargar CSV con 5 columnas
router.post("/cargar-csv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se encontró el archivo en la solicitud" });
  }

  if (path.extname(req.file.originalname).toLowerCase() !== ".csv") {
    return res.status(400).json({ error: "Tipo de archivo no permitido" });
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv({ 
      separator: ';', // Si usas ';'
      headers: ["ID_RUTA", "lleva", "trae", "fecha_remito", "n_remito", "fecha_carga"]
    }))
    .on("data", (data) => {
      results.push(data);
    })
    .on("end", async () => {
      try {
        let count = 0; // Contador de filas importadas
        for (const row of results) {
          const ID_RUTA = parseInt(row.ID_RUTA);
          const valorLleva = row.lleva && row.lleva.trim() !== "" ? parseInt(row.lleva) : 0;
          const valorTrae = row.trae && row.trae.trim() !== "" ? parseInt(row.trae) : 0;
          const fechaRemito = row.fecha_remito ? new Date(row.fecha_remito) : null;
          const numeroRemito = row.n_remito && row.n_remito.trim() !== "",
          const fechaCarga = row.fecha_carga ? new Date(row.fecha_carga) : null
        ? parseInt(row.n_remito, 10)
        : 0;  

        // Si parseInt da NaN, lo forzamos a 0
          if (isNaN(numeroRemito)) {
            numeroRemito = 0;
           }

          await pool.query(
            "INSERT INTO movimientos (ID_RUTA, lleva, trae, fecha_remito, n_remito, fecha_carga) VALUES (?, ?, ?, ?, ?, ?)",
            [ID_RUTA, valorLleva, valorTrae, fechaRemito, numeroRemito,fechaCarga]
          );
          count++;
        }

        fs.unlinkSync(req.file.path);

        // Insertar el registro en la tabla de historial de subidas
        await pool.query(
          "INSERT INTO upload_history (nombreArchivo, cantidad, estado) VALUES (?, ?, ?)",
          [req.file.originalname, count, "OK"]
        );

        res.json({ msg: `Datos importados correctamente, se importaron ${count} registros` });
      } catch (error) {
        console.error("Error al procesar el CSV:", error);

        // En caso de error, también registramos en el historial
        await pool.query(
          "INSERT INTO upload_history (nombreArchivo, cantidad, estado) VALUES (?, ?, ?)",
          [req.file.originalname, 0, "Fallo"]
        );

        res.status(500).json({ error: "Error al procesar el CSV", details: error.message });
      }
    });
});

router.get("/upload-history", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM upload_history ORDER BY fecha DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener el historial:", error);
    res.status(500).json({ error: "Error al obtener el historial" });
  }
});





// Endpoint para cargar un movimiento manualmente
// Nota: Usamos el middleware authenticateToken para que solo usuarios autenticados puedan hacerlo
router.post("/cargar-bandejas", authenticateToken, async (req, res) => {
  // Extraemos los campos del body
  const { id_ruta, lleva, trae, fecha_remito, n_remito } = req.body;

  // Validamos que los campos requeridos estén presentes
  if (!id_ruta || !lleva || !trae || !fecha_remito) {
    return res.status(400).json({ error: "Faltan campos requeridos (id_ruta, lleva, trae, fecha_remito)" });
  }

  // Si el campo remito no está vacío, se verifica que no exista ya en la tabla
  if (n_remito && n_remito.toString().trim() !== "") {
    const [existing] = await pool.query(
      "SELECT * FROM movimientos WHERE n_remito = ?",
      [n_remito]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "Ya hay un movimiento cargado con ese número de remito" });
    }
  }

  try {
    // Convertimos los valores numéricos y la fecha
    const ID_RUTA = parseInt(id_ruta);
    const valorLleva = parseInt(lleva);
    const valorTrae = parseInt(trae);
    const fechaRemitoString = `${fecha_remito}T12:00:00`;
    const fechaRemito = new Date(fechaRemitoString);
    // Si n_remito viene vacío, se guarda como null
    const numeroRemito = n_remito && n_remito.toString().trim() !== "" ? parseInt(n_remito) : null;

       // Asignar la fecha y hora actuales para la carga
       // Obtener la fecha de hoy en formato YYYY-MM-DD
const today = new Date();
const yyyy = today.getFullYear();
const mm = ("0" + (today.getMonth() + 1)).slice(-2);
const dd = ("0" + today.getDate()).slice(-2);
const fechaCargaString = `${yyyy}-${mm}-${dd}T12:00:00`;
const fechaCarga = new Date(fechaCargaString);



    // Insertamos el movimiento en la tabla "movimientos"
    const [result] = await pool.query(
      "INSERT INTO movimientos (ID_RUTA, lleva, trae, fecha_remito, n_remito, fecha_carga) VALUES (?, ?, ?, ?, ?, ?)",
      [ID_RUTA, valorLleva, valorTrae, fechaRemito, numeroRemito, fechaCarga]
    );

    // Respuesta con el mensaje y el id insertado
    return res.status(201).json({ msg: "Movimiento creado correctamente", id: result.insertId });
  } catch (error) {
    console.error("Error al insertar movimiento manual:", error);
    return res.status(500).json({ error: "Error en el servidor", details: error.message });
  }
});

router.get("/buscar-cliente", async (req, res) => {
  try {
    // Por ejemplo, recibimos la ruta como query param
    const { ruta } = req.query;

    // Haces una consulta a tu DB para buscar el cliente asociado a esa ruta
    // Ajusta según tu tabla y tus columnas
    const [rows] = await pool.query(
      "SELECT nombre_ruta FROM RUTAS WHERE id_ruta = ?",
      [ruta]
    );

    if (rows.length === 0) {
      return res.json({ cliente: "" });
    }

    // Asumiendo que el nombre del cliente está en la columna 'nombre'
    return res.json({ cliente: rows[0].nombre_ruta });
  } catch (error) {
    console.error("Error en buscar-cliente:", error);
    res.status(500).json({ error: "Error al buscar cliente" });
  }
});

router.get("/saldos", async (req, res) => {
  const { 
    ruta, 
    nombre, 
    ciudad, 
    cv, 
    fletero, 
    mes, 
    sortBy, 
    order, 
    fechaInicio,   // <-- Nuevo
    fechaFin       // <-- Nuevo
  } = req.query;

  let sql = `
    SELECT
      r.id_ruta,
      r.nombre_ruta AS nombre_ruta,
      r.ciudad,
      r.canal,
      r.id_fletero,
      f.nombre as Logistico,
      SUM(m.lleva) AS totalCarga,
      SUM(m.trae) AS totalDevolucion,
      (SUM(m.lleva) - SUM(m.trae)) AS saldoTotal
    FROM RUTAS r
    JOIN fletero f ON r.id_fletero = f.id_fletero
    JOIN movimientos m ON m.id_ruta = r.id_ruta
    WHERE 1=1
  `;
  const params = [];

  // Filtros existentes
  if (ruta) {
    if (ruta.includes(",")) {
      const rutasArray = ruta.split(",").map(item => item.trim()).filter(item => item !== "");
      if (rutasArray.length > 0) {
        const placeholders = rutasArray.map(() => "?").join(", ");
        sql += ` AND r.id_ruta IN (${placeholders})`;
        params.push(...rutasArray);
      }
    } else {
      sql += " AND r.id_ruta = ?";
      params.push(ruta);
    }
  }

  if (ciudad) {
    sql += " AND r.ciudad LIKE ?";
    params.push(`%${ciudad}%`);
  }
  if (fletero) {
    sql += " AND f.nombre LIKE ?";
    params.push(`%${fletero}%`);
  }
  if (cv) {
    sql += " AND r.punto_entrega LIKE ?";
    params.push(`%${cv}%`);
  }
  if (nombre) {
    sql += " AND r.nombre_ruta LIKE ?";
    params.push(`%${nombre}%`);
  }
  if (mes) {
    // Filtrar por mes: el valor debe estar en formato "YYYY-MM"
    sql += " AND DATE_FORMAT(m.fecha_remito, '%Y-%m') = ?";
    params.push(mes);
  }

  // Filtro de rango de fechas (fecha_remito) si ambos parámetros están presentes
  if (fechaInicio && fechaFin) {
    sql += " AND DATE(m.fecha_remito) BETWEEN ? AND ?";
    params.push(fechaInicio, fechaFin);
  }

  // Agrupación y orden
  sql += " GROUP BY r.id_ruta";

  if (sortBy) {
    let validColumns = [
      "id_ruta", "nombre_ruta", "ciudad", "cv", "fletero",
      "totalCarga", "totalDevolucion", "saldoTotal"
    ];
    if (validColumns.includes(sortBy)) {
      let direction = (order && order.toLowerCase() === "desc") ? "DESC" : "ASC";
      sql += ` ORDER BY ${sortBy} ${direction}`;
    }
  }

  try {
    console.log(sql, params);
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener saldos" });
  }
});


router.get("/movimientos/:id", async (req, res) => {
  const { id } = req.params;
  // Extraemos los query params
  const { fechaInicio, fechaFin } = req.query;

  // Construimos la base de la consulta
  let sql = `
    SELECT fecha_remito, lleva, trae
    FROM movimientos
    WHERE id_ruta = ?
  `;
  const params = [id];

  // Si vienen las fechas, filtramos
  if (fechaInicio && fechaFin) {
    sql += " AND DATE(fecha_remito) BETWEEN ? AND ?";
    params.push(fechaInicio, fechaFin);
  } else if (fechaInicio) {
    sql += " AND DATE(fecha_remito) >= ?";
    params.push(fechaInicio);
  } else if (fechaFin) {
    sql += " AND DATE(fecha_remito) <= ?";
    params.push(fechaFin);
  }
  

  // Ordenamos por fecha_remito
  sql += " ORDER BY fecha_remito ASC";

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener movimientos" });
  }
});


// Totales por ciudad: agrupar por r.ciudad
router.get("/saldos-ciudad", async (req, res) => {
  const {sortBy,order} = req.query;
  let sql = `
    SELECT
      r.ciudad,
      SUM(m.lleva) AS totalCarga,
      SUM(m.trae) AS totalDevolucion,
      (SUM(m.lleva) - SUM(m.trae)) AS saldoTotal
    FROM RUTAS r
    JOIN movimientos m ON m.id_ruta = r.id_ruta
    GROUP BY r.ciudad
    ORDER BY saldoTotal DESC
  `;
  if (sortBy) {
    let validColumns = ["id_ruta", "nombre_ruta", "ciudad", "cv","fletero", "totalCarga", "totalDevolucion", "saldoTotal"];
    if (validColumns.includes(sortBy)) {
      let direction = (order && order.toLowerCase() === "desc") ? "DESC" : "ASC";
      sql += ` ORDER BY ${sortBy} ${direction}`;
    }
  }
  try {
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener saldos por ciudad:", error);
    res.status(500).json({ error: "Error al obtener saldos por ciudad" });
  }
});

// Totales por mes: agrupar por mes (formateado como YYYY-MM)
router.get("/saldos-mes", async (req, res) => {
  const { ruta, sortBy, order } = req.query;

  // Campos básicos (agrupando solo por mes)
  let selectFields = `
    DATE_FORMAT(m.fecha_remito, '%Y-%m') AS mes,
    SUM(m.lleva) AS totalCarga,
    SUM(m.trae) AS totalDevolucion,
    (SUM(m.lleva) - SUM(m.trae)) AS saldoTotal
  `;

  let groupByClause = `GROUP BY mes`; // Por defecto, solo agrupa por mes

  // Si hay un filtro de ruta, también queremos mostrar el nombre de la ruta
  if (ruta) {
    // Agregamos el campo r.nombre_ruta al SELECT
    selectFields += `, r.nombre_ruta AS rutaNombre`;
    // Y agrupamos por mes y nombre_ruta
    groupByClause = `GROUP BY mes, r.nombre_ruta`;
  }

  // Construimos la base del query
  let sql = `
    SELECT
      ${selectFields}
    FROM movimientos m
    LEFT JOIN RUTAS r ON m.id_ruta = r.id_ruta
    WHERE 1=1
  `;
  const params = [];

  // Filtro por ruta (incluyendo la lógica de varias rutas separadas por comas)
  if (ruta) {
    if (ruta.includes(",")) {
      const rutasArray = ruta.split(",").map(item => item.trim()).filter(item => item !== "");
      if (rutasArray.length > 0) {
        const placeholders = rutasArray.map(() => "?").join(", ");
        sql += ` AND m.id_ruta IN (${placeholders})`;
        params.push(...rutasArray);
      }
    } else {
      sql += " AND m.id_ruta = ?";
      params.push(ruta);
    }
  }

  // Agregamos el GROUP BY (y el ORDER BY por mes)
  sql += ` ${groupByClause} ORDER BY mes ASC`;

  // Si quieres usar sortBy y order, puedes ajustarlo (ojo que ahora el GROUP BY ya está puesto)
  // Ojo: si usas ORDER BY mes ASC y luego ORDER BY sortBy, quedaría duplicado. Ajusta según tu caso.
  if (sortBy) {
    let validColumns = ["id_ruta", "nombre_ruta", "ciudad", "cv", "fletero", "totalCarga", "totalDevolucion", "saldoTotal"];
    if (validColumns.includes(sortBy)) {
      let direction = (order && order.toLowerCase() === "desc") ? "DESC" : "ASC";
      // Para no sobreescribir la ordenación por mes, podrías concatenar
      sql += `, ${sortBy} ${direction}`;
    }
  }

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener saldos por mes:", error);
    res.status(500).json({ error: "Error al obtener saldos por mes" });
  }
});

router.put("/movimientos/:id", async (req, res) => {
  const { id } = req.params;
  const { fecha_remito, lleva, trae, n_remito,fecha_carga } = req.body;

  // Puedes agregar validaciones: por ejemplo, que fecha_remito y lleva/trae sean válidos.
  if (!fecha_remito || typeof lleva === "undefined" || typeof trae === "undefined") {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    const sql = `
      UPDATE movimientos 
      SET fecha_remito = ?, 
          lleva = ?, 
          trae = ?, 
          n_remito = ?,
          fecha_carga = ?
      WHERE id_movimiento = ?
    `;
    const params = [new Date(fecha_remito), lleva, trae, n_remito, fecha_carga || null, id];
    const [result] = await pool.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }

    res.json({ msg: "Movimiento actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar movimiento:", error);
    res.status(500).json({ error: "Error al actualizar movimiento" });
  }
});

router.delete("/movimientos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM movimientos WHERE id_movimiento = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }
    res.json({ msg: "Movimiento eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar movimiento:", error);
    res.status(500).json({ error: "Error al eliminar movimiento", details: error.message });
  }
});
router.get("/movimientos", async (req, res) => {
  // Incluimos los nuevos filtros: fechaRemitoInicio y fechaRemitoFin
  const { ruta, fechaInicio, fechaFin, fechaRemitoInicio, fechaRemitoFin, fletero, puntoEntrega,remito } = req.query;

  let sql = `
    SELECT
      m.id_movimiento,
      m.fecha_remito,
      m.fecha_carga,
      m.lleva,
      m.trae,
      m.n_remito,
      m.id_ruta,
      r.nombre_ruta AS nombre_cliente
    FROM movimientos m
    JOIN RUTAS r ON m.id_ruta = r.id_ruta
    JOIN cliente c ON r.id_cliente = c.id_cliente
    JOIN fletero f ON r.id_fletero = f.id_fletero
    WHERE 1=1
  `;
  const params = [];

  // Filtro por ruta
  if (ruta) {
    sql += " AND r.id_ruta = ?";
    params.push(ruta);
  }

  // Filtro por rango de fecha de carga
  if (fechaInicio && fechaFin) {
    sql += " AND DATE(m.fecha_carga) BETWEEN ? AND ?";
    params.push(fechaInicio, fechaFin);
  }

  // Filtro por rango de fecha de remito
  if (fechaRemitoInicio && fechaRemitoFin) {
    sql += " AND DATE(m.fecha_remito) BETWEEN ? AND ?";
    params.push(fechaRemitoInicio, fechaRemitoFin);
  }

  // Filtro por fletero
  if (fletero) {
    sql += " AND f.nombre LIKE ?";
    params.push(`%${fletero}%`);
  }

  // Filtro por punto de entrega
  if (puntoEntrega) {
    sql += " AND r.punto_entrega = ?";
    params.push(puntoEntrega);
  }

  if (remito) {
    sql += " AND m.n_remito = ?";
    params.push(remito);
  }


  sql += " ORDER BY m.fecha_remito ASC";

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener movimientos:", error);
    res.status(500).json({ error: "Error al obtener movimientos" });
  }
});


module.exports = router;






