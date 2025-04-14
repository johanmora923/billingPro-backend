import bcryptjs from "bcryptjs";
import Jsonwebtoken from "jsonwebtoken";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();


const { Pool } = pkg;

export const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
    max: 18, 
});

// Función para inicio de sesión
async function login(req, res) {
    console.log(req.body);
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ status: "error", message: "Debes completar todos los campos" });
    }

    try {
        // Consultar el usuario en la base de datos
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ status: "error", message: "El usuario no existe" });
        }

        const usuarioARevisar = result.rows[0];
        const loginCorrecto = await bcryptjs.compare(password, usuarioARevisar.password);

        if (!loginCorrecto) {
            return res.status(400).json({ status: "error", message: "Credenciales incorrectas" });
        }
        //revisar subcripciones
        const subs = await pool.query('SELECT * FROM subscripciones WHERE usuario_id = $1',[usuarioARevisar.id])
        // Generar token JWT
        const token = Jsonwebtoken.sign(
            { email: usuarioARevisar.email, id: usuarioARevisar.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRATION }
        );

        // Configuración de cookies
        const cookieOptions = {
            expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
            httpOnly: true, // Mayor seguridad
            secure: process.env.NODE_ENV === "production", // Solo HTTPS en producción
        };

        res.cookie("jwt", token, cookieOptions);
        return res.status(200).json({
            status: "ok",
            message: "Inicio de sesión exitoso",
            id: usuarioARevisar.id,
            name: usuarioARevisar.user,
            subs: subs.rows[0]
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "error", message: "Error en el servidor" });
    }
}

// Función para registro de usuario
async function register(req, res) {
    console.log(req.body);
    const { name, email, password, planName, init, expiry } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ status: "error", message: "Debes completar todos los campos" });
    }

    try {
        // Verificar si el usuario ya existe
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ status: "error", message: "El usuario ya existe" });
        }

        // Crear nuevo usuario
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(password, salt);

        const nuevoUsuario = await pool.query(
            'INSERT INTO users ("user", email, password) VALUES ($1, $2, $3) RETURNING *',
            [name, email, hashedPassword]
        );
        const suscription  = await pool.query('INSERT INTO subscripciones ("usuario_id", "plan", "fecha_inicio", "fecha_fin", "estado") VALUES ($1, $2, $3, $4, $5)', [nuevoUsuario.rows[0].id, planName, init, expiry, 'true'])


        return res.status(201).json({
            status: "ok",
            message: `Usuario ${nuevoUsuario.rows[0].user} registrado exitosamente`,
            user : nuevoUsuario.rows[0].user,
            id: nuevoUsuario.rows[0].id
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "error", message: "Error al registrar usuario" });
    }
}

export const methods = {
    login,
    register,
};

export default pool;