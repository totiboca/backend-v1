const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.JWT_SECRET; // 🔴 Usa una clave segura en .env

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Acceso no autorizado." });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido o expirado." });
        }

        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
