const express = require("express");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth");
const router = express.Router();

// **Obtener saldo de bandejas del cliente autenticado**
router.get("/saldo", authenticateToken, async (req, res) => {
    const id_cliente = req.user.id_cliente; // Obtenemos el id_cliente desde el token

    try {
        const [[result]] = await pool.query(`
            SELECT 
                (SELECT COALESCE(SUM(m.lleva), 0) FROM movimientos m
                 JOIN RUTAS r ON m.ID_RUTA = r.id_ruta WHERE r.id_cliente = ?) 
                -
                (SELECT COALESCE(SUM(m.trae), 0) FROM movimientos m
                 JOIN RUTAS r ON m.ID_RUTA = r.id_ruta WHERE r.id_cliente = ?) 
                AS saldo;
        `, [id_cliente, id_cliente]);

        console.log("Saldo calculado:", result.saldo);
        res.json({ saldo: result.saldo });

    } catch (err) {
        console.error("Error al obtener saldo:", err);
        return res.status(500).json({ error: "Error en el servidor." });
    }
});

router.get("/movimientos", authenticateToken, async (req, res) => {
    const { id_cliente, tipo } = req.user; // Obtenemos el tipo desde el token

    try {
        let query;
        let params;

        if (tipo === "Cliente") {
            query = `
              SELECT r.id_ruta, r.nombre_ruta, r.id_cliente AS id_cliente_ruta, r.id_fletero AS id_fletero_ruta,
                     DATE_FORMAT(m.fecha_remito, '%Y-%m-%d') AS fecha,
                     m.lleva, m.trae
              FROM movimientos m
              JOIN RUTAS r ON m.ID_RUTA = r.id_ruta
              WHERE r.id_cliente = ?
              ORDER BY r.id_ruta, m.fecha_remito;
            `;
            params = [id_cliente];
          } else if (tipo === "Operador Logistico") {
            query = `
              SELECT r.id_ruta, r.nombre_ruta, r.id_cliente AS id_cliente_ruta, r.id_fletero AS id_fletero_ruta,
                     DATE_FORMAT(m.fecha_remito, '%Y-%m-%d') AS fecha,
                     m.lleva, m.trae
              FROM movimientos m
              JOIN RUTAS r ON m.ID_RUTA = r.id_ruta
              WHERE r.id_fletero = ?
              ORDER BY r.id_ruta, m.fecha_remito;
            `;
            params = [id_cliente];
          } else if (tipo === "Ambos") {
            query = `
              SELECT r.id_ruta, r.nombre_ruta, r.id_cliente AS id_cliente_ruta, r.id_fletero AS id_fletero_ruta,
                     DATE_FORMAT(m.fecha_remito, '%Y-%m-%d') AS fecha,
                     m.lleva, m.trae
              FROM movimientos m
              JOIN RUTAS r ON m.ID_RUTA = r.id_ruta
              WHERE r.id_cliente = ? OR r.id_fletero = ?
              ORDER BY r.id_ruta, m.fecha_remito;
            `;
            params = [id_cliente, id_cliente];
          } else {
            return res.status(400).json({ error: "Tipo de usuario no válido." });
          }
      
          const [results] = await pool.query(query, params);
        
    // Agrupo los movimientos por id_ruta
    const movimientosPorRuta = {};
    results.forEach((mov) => {
      if (!movimientosPorRuta[mov.id_ruta]) {
        movimientosPorRuta[mov.id_ruta] = {
          nombre_ruta: mov.nombre_ruta,
          datos: []
        };
      }
      movimientosPorRuta[mov.id_ruta].datos.push({
        fecha: mov.fecha,
        lleva: mov.lleva,
        trae: mov.trae,
        saldo_dia: mov.lleva - mov.trae,
        id_cliente_ruta: mov.id_cliente_ruta,
        id_fletero_ruta: mov.id_fletero_ruta
      });
    });

    res.json({ movimientos: movimientosPorRuta });
  } catch (error) {
    console.error("Error al obtener movimientos:", error);
    res.status(500).json({ error: "Error en el servidor." });
  }
});

module.exports = router;