import Jsonwebtoken from "jsonwebtoken";
import dotenv from "dotenv";
import { pool } from '../controllers/authentication.controllers.js';

dotenv.config();

// Middleware para rutas protegidas (solo accesibles para administradores)
async function onliAdmin(req, res, next) {
    const logueado = await revisarCookie(req);
    if (logueado) return next();
    return res.redirect("/");
}

// Middleware para rutas públicas (solo accesibles si no está logueado)
async function onliPulic(req, res, next) {
    const logueado = await revisarCookie(req);
    if (!logueado) return next();
    return res.redirect("/admin");
}

// Función para verificar la cookie JWT
async function revisarCookie(req) {
    try {
        // Extraer la cookie
        const cookieJWT = req.headers.cookie?.split("; ").find(cookie => cookie.startsWith("jwt="))?.slice(4);
        if (!cookieJWT) return false;

        // Verificar el token JWT
        const decodificada = Jsonwebtoken.verify(cookieJWT, process.env.JWT_SECRET);
        console.log("Token decodificado:", decodificada);

        // Buscar al usuario en la base de datos
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [decodificada.email]);
        if (result.rows.length === 0) {
            return false; // Usuario no encontrado
        }

        // Usuario verificado
        return true;
    } catch (error) {
        console.error("Error al revisar la cookie:", error);
        return false;
    }
}

export const methods = {
    onliAdmin,
    onliPulic,
};
