// require('dotenv').config();
// const mysql = require("mysql2/promise");

// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
  
// });

// pool.getConnection((err, connection) => {
//   if (err) {
//     console.error("❌ Error de conexión a MySQL:", err);
//     return;
//   }
//   console.log("✅ Conectado a la base de datos MySQL");
//   connection.release();
// });

// module.exports = pool;


require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,      // "nozomi.proxy.rlwy.net"
  port: process.env.DB_PORT,      // "42061"
  user: process.env.DB_USER,      // "root"
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    rejectUnauthorized: false
  }
});

// Verificamos la conexión en un bloque async
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Conectado a la base de datos MySQL");
    connection.release();
  } catch (err) {
    console.error("❌ Error de conexión a MySQL:", err);
  }
})();

module.exports = pool;



