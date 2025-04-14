import pool from "../controllers/authentication.controllers.js";

async function addClient(req, res) {
    try {
        const name = req.body.name;
        const email = req.body.email;   
        const phone = req.body.phone;
        const address = req.body.address;
        const user_id = req.params.id;

        console.log(req.body)

        // Validar campos requeridos
        if (!name || !phone) {
        return res.status(400).json({ message: "Name and email are required." });
        }

        // Insertar cliente en la base de datos
        const client = await pool.query(
        "INSERT INTO clientes (nombre, email, telefono, direccion, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [name, email, phone, address, user_id]
        );

        // Respuesta exitosa
        res.status(201).json(client.rows[0]);
    } catch (error) {
        console.error("Error adding client:", error.message);
        res.status(500).json({ message: "An unexpected error occurred while adding the client." });
    }
    }

async function getClients(req, res) {
    try {
        // Obtener todos los clientes de la base de datos
        const id = req.params.id
        const clients = await pool.query("SELECT * FROM clientes WHERE user_id = $1", [id]);
        // Respuesta exitosa
        res.status(200).json(clients.rows);
        console.log(clients.rows);
    } catch (error) {
        console.error("Error getting clients:", error.message);
        res.status(500).json({ message: "An unexpected error occurred while fetching clients." });
    }
    }

async function deleteClient(req, res) {
        try {
            const { id } = req.params;

            // Eliminar cliente de la base de datos
            await pool.query("DELETE FROM clientes WHERE id = $1", [id]);

            // Respuesta exitosa
            res.status(200).json({ message: "Client deleted successfully." });
        } catch (error) {
            console.error("Error deleting client:", error.message);
            res.status(500).json({ message: "An unexpected error occurred while deleting the client." });
        }
    }


    export const methods = {
    addClient,
    getClients,
    deleteClient,
};
