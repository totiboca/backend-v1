const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const router = express.Router();
const authenticateToken = require("../middleware/auth"); 


const SECRET_KEY = "clave_secreta_super_segura"; // 🔴 Usa una clave segura en .env

// **Registro de usuario**
router.post("/registro", async (req, res) => {
    const { usuario, clave, id_cliente } = req.body;

    if (!usuario || !clave || !id_cliente) {
        return res.status(400).json({ error: "Usuario, contraseña e ID Cliente son requeridos." });
    }

    try {
        const [usuarioExistente] = await pool.query("SELECT * FROM usuarios WHERE usuario = ?", [usuario]);
        if (usuarioExistente.length > 0) {
            return res.status(400).json({ error: "El usuario ya existe." });
        }

        const [clienteExistente] = await pool.query("SELECT * FROM cliente WHERE id_cliente = ?", [id_cliente]);
        if (clienteExistente.length === 0) {
            return res.status(400).json({ error: "El ID Cliente no existe." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(clave, salt);

        await pool.query("INSERT INTO usuarios (usuario, clave, id_cliente) VALUES (?, ?, ?)", [usuario, hashedPassword, id_cliente]);

        res.status(201).json({ mensaje: "Usuario registrado exitosamente." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor." });
    }
});

// **Inicio de sesión**
router.post("/login", async (req, res) => {
    const { usuario, clave } = req.body;

    if (!usuario || !clave) {
        return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
    }

    try {
        const [result] = await pool.query("SELECT * FROM usuarios WHERE usuario = ?", [usuario]);

        if (result.length === 0) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
        }

        const usuarioDB = result[0];
        const claveCorrecta = await bcrypt.compare(clave, usuarioDB.clave);

        if (!claveCorrecta) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
        }

    //     const token = jwt.sign({ usuario: usuarioDB.usuario, id_cliente: usuarioDB.id_cliente }, SECRET_KEY, { expiresIn: "2h" });
   
        // Obtener el tipo del cliente
        const [cliente] = await pool.query("SELECT tipo FROM cliente WHERE id_cliente = ?", [usuarioDB.id_cliente]);

        if (cliente.length === 0) {
            return res.status(401).json({ error: "Cliente no encontrado." });
        }
 
        const tipoUsuario = cliente[0].tipo;
 
        const tokenPayload = {
            usuario: usuarioDB.usuario,
            id_cliente: usuarioDB.id_cliente,
            tipo: tipoUsuario, // Guardamos el tipo de usuario
        };
 
        const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: "2h" });


// HASTA ACA LO NUEVO   

        res.json({ mensaje: "Inicio de sesión exitoso", token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor." });
    }
});


// **Obtener perfil del usuario autenticado con el nombre del cliente**
router.get("/perfil", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Acceso no autorizado." });
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        const id_cliente = decoded.id_cliente;

        // Consultamos la base de datos para obtener el nombre del cliente
        const [cliente] = await pool.query("SELECT nombre,tipo FROM cliente WHERE id_cliente = ?", [id_cliente]);

        if (cliente.length === 0) {
            return res.status(404).json({ error: "Cliente no encontrado." });
        }

        res.json({
            usuario: decoded.usuario,
            id_cliente: id_cliente,
            nombre: cliente[0].nombre, // Agregamos el nombre del cliente
            tipo: cliente[0].tipo
        });

    } catch (error) {
        console.error(error);
        res.status(401).json({ error: "Token inválido o expirado." });
    }
});



//FORMULARIO PARA CAMBIAR CLAVE//
router.post("/cambiar-clave", authenticateToken, async (req, res) => {
    const { claveActual, claveNueva } = req.body;
    const id_cliente = req.user.id_cliente;

    try {
        const [usuario] = await pool.query("SELECT * FROM usuarios WHERE id_cliente = ?", [id_cliente]);

        if (usuario.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        const claveCorrecta = await bcrypt.compare(claveActual, usuario[0].clave);
        if (!claveCorrecta) {
            return res.status(401).json({ error: "Clave actual incorrecta." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(claveNueva, salt);

        await pool.query("UPDATE usuarios SET clave = ? WHERE id_cliente = ?", [hashedPassword, id_cliente]);

        res.json({ mensaje: "Clave actualizada correctamente." });

    } catch (error) {
        console.error("Error al cambiar clave:", error);
        res.status(500).json({ error: "Error en el servidor." });
    }
});


module.exports = router;

