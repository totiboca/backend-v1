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

// // **Obtener movimientos del cliente autenticado**
// router.get("/movimientos", authenticateToken, async (req, res) => {
//     const id_cliente = req.user.id_cliente;

//     try {
//         const [results] = await pool.query(`
//             SELECT r.id_ruta, 
//                    DATE_FORMAT(m.fecha_remito, '%Y-%m-%d') AS fecha, 
//                    m.lleva, 
//                    m.trae
//             FROM movimientos m
//             JOIN rutas r ON m.ID_RUTA = r.id_ruta
//             WHERE r.id_cliente = ?
//             ORDER BY r.id_ruta, m.fecha_remito;
//         `, [id_cliente]);

//         // Organizar los movimientos por ID de ruta
//         const movimientosPorRuta = {};
//         results.forEach((mov) => {
//             if (!movimientosPorRuta[mov.id_ruta]) {
//                 movimientosPorRuta[mov.id_ruta] = [];
//             }
//             movimientosPorRuta[mov.id_ruta].push({
//                 fecha: mov.fecha,
//                 lleva: mov.lleva,
//                 trae: mov.trae,
//                 saldo_dia: mov.lleva - mov.trae,
//             });
//         });

//         res.json({ movimientos: movimientosPorRuta });

//     } catch (err) {
//         console.error("Error al obtener movimientos:", err);
//         return res.status(500).json({ error: "Error en el servidor." });
//     }
// });
router.get("/movimientos", authenticateToken, async (req, res) => {
    const { id_cliente, tipo } = req.user; // Obtenemos el tipo desde el token

    try {
        let query;
        let params;

        if (tipo === "Cliente") {
            // Si es Cliente, obtenemos solo sus movimientos
            query = `
                SELECT r.id_ruta, DATE_FORMAT(m.fecha_remito, '%Y-%m-%d') AS fecha, m.lleva, m.trae
                FROM movimientos m
                JOIN RUTAS r ON m.ID_RUTA = r.id_ruta
                WHERE r.id_cliente = ?
                ORDER BY r.id_ruta, m.fecha_remito;
            `;
            params = [id_cliente];

        } else if (tipo === "Operador Logistico") {
            // Si es Operador Logístico, obtenemos las rutas donde es fletero
            query = `
                SELECT r.id_ruta, DATE_FORMAT(m.fecha_remito, '%Y-%m-%d') AS fecha, m.lleva, m.trae
                FROM movimientos m
                JOIN RUTAS r ON m.ID_RUTA = r.id_ruta
                WHERE r.id_fletero = ?
                ORDER BY r.id_ruta, m.fecha_remito;
            `;
            params = [id_cliente];

        } else if (tipo === "Ambos") {
            // Si es Ambos, obtenemos los movimientos tanto como cliente y fletero
            query = `
                SELECT r.id_ruta, DATE_FORMAT(m.fecha_remito, '%Y-%m-%d') AS fecha, m.lleva, m.trae
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

        const movimientosPorRuta = {};
        results.forEach((mov) => {
            if (!movimientosPorRuta[mov.id_ruta]) {
                movimientosPorRuta[mov.id_ruta] = [];
            }
            movimientosPorRuta[mov.id_ruta].push({
                fecha: mov.fecha,
                lleva: mov.lleva,
                trae: mov.trae,
                saldo_dia: mov.lleva - mov.trae,
            });
        });

        res.json({ movimientos: movimientosPorRuta });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor." });
    }
});








module.exports = router;
