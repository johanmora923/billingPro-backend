import pool from '../controllers/authentication.controllers.js';

// Método para obtener todos los productos (filtros opcionales por categoría y estado)
const getProducts = async (req, res) => {
    const user_id = req.params.id; // Obtén el user_id desde los parámetros de la ruta
    try {
        const { category, status } = req.query; // Obtener filtros desde query string
        let query = "SELECT * FROM productos WHERE user_id = $1"; // Base de la consulta
        const queryParams = [user_id]; // Primer parámetro para user_id

        // Agregar filtros dinámicamente
        if (category) {
            queryParams.push(category);
            query += ` AND categoria = $${queryParams.length}`;
        }
        if (status) {
            queryParams.push(status);
            query += ` AND estado = $${queryParams.length}`;
        }

        query += " ORDER BY id ASC"; // Ordenar por ID
        const result = await pool.query(query, queryParams);
        res.status(200).json(result.rows); // Devuelve los productos filtrados
    } catch (error) {
        console.error("Error fetching products:", error.message);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
};


// Método para agregar un nuevo producto (código de barras opcional)
const addProduct = async (req, res) => {
    try {
        const { name, purchasePrice, sellingPrice, stock, discount, details, category, unitMeasure, barcode, status, user_id } = req.body;

        // Validación de datos requeridos
        if (!name || !purchasePrice || !sellingPrice || !stock || !category || !user_id ) {
            return res
                .status(400)
                .json({ message: "Fields required: name, purchasePrice, sellingPrice, stock, category, user_id" });
        }

        // Validar que el código de barras sea único si se proporciona
        if (barcode) {
            const barcodeCheck = await pool.query("SELECT * FROM productos WHERE codigo_barra = $1", [barcode]);
            if (barcodeCheck.rowCount > 0) {
                return res.status(400).json({ message: "Barcode must be unique." });
            }
        }

        // Inserción del producto
        const result = await pool.query(
            "INSERT INTO productos (nombre, precio_compra, precio_venta, existencias, descuento, detalles, categoria, unidad_medida, codigo_barra, estado, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
            [name, purchasePrice, sellingPrice, stock, discount || 0, details || "", category, unitMeasure, barcode || null, status || "activo", user_id]
        );

        res.status(201).json(result.rows[0]); // Devuelve el producto recién creado
    } catch (error) {
        console.error("Error adding product:", error.message);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
};

// Método para actualizar existencias y estado del producto
const updateStock = async (req, res) => {
    const { id } = req.params;
    const { stock } = req.body;

    if (!stock || stock <= 0) {
        return res.status(400).json({ message: "Stock must be a positive number." });
    }

    try {
        const result = await pool.query(
        "UPDATE productos SET existencias = $1 WHERE id = $2 RETURNING *",
        [stock, id]
        );

        if (result.rowCount === 0) {
        return res.status(404).json({ message: "Product not found." });
        }

        res.status(200).json(result.rows[0]); // Devuelve el producto actualizado
    } catch (error) {
        console.error("Error updating stock:", error.message);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
};

// Método para actualizar un producto
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params; // Obtener el ID del producto desde los parámetros
        const {
            name,
            category,
            stock,
            barcode,
            purchasePrice,
            sellingPrice,
            discount,
            details,
        } = req.body; // Obtener datos del cuerpo de la solicitud
    
        // Validar que el ID esté presente
        if (!id) {
            return res.status(400).json({ message: "Product ID is required." });
        }
    
        // Crear una lista dinámica de campos a actualizar
        const updates = [];
        const values = [];
    
        if (name) {
            updates.push("nombre = $1");
            values.push(name);
        }
        if (category) {
            updates.push("categoria = $2");
            values.push(category);
        }
        if (stock) {
            updates.push("existencias = $3");
            values.push(stock);
        }
        if (barcode) {
            updates.push("codigo_barra = $5");
            values.push(barcode);
        }
        if (purchasePrice) {
            updates.push("precio_compra = $6");
            values.push(purchasePrice);
        }
        if (sellingPrice) {
            updates.push("precio_venta = $7");
            values.push(sellingPrice);
        }
        if (discount) {
            updates.push("descuento = $8");
            values.push(discount);
        }
        if (details) {
            updates.push("detalles = $9");
            values.push(details);
        }
    
        // Validar que hay al menos un campo para actualizar
        if (updates.length === 0) {
            return res.status(400).json({ message: "No fields provided to update." });
        }
    
        // Construir la consulta SQL dinámica
        const query = `
            UPDATE productos
            SET ${updates.join(", ")} 
            WHERE id = $${values.length + 1}
            RETURNING *;
        `;
        values.push(id); // Añadir el ID como el último valor
    
        // Ejecutar la consulta en la base de datos
        const result = await pool.query(query, values);
    
        // Validar si se encontró el producto
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Product not found." });
        }
    
        // Devolver el producto actualizado
        res.status(200).json(result.rows[0]);
        } catch (error) {
        console.error("Error updating product:", error.message);
        res.status(500).json({ message: "An unexpected error occurred." });
        }
};

async function deletepproduct(req, res) {
        try {
            const { id } = req.params;

            // Eliminar cliente de la base de datos
            await pool.query("DELETE FROM productos WHERE id = $1", [id]);

            // Respuesta exitosa
            res.status(200).json({ message: "Client deleted successfully." });
        } catch (error) {
            console.error("Error deleting client:", error.message);
            res.status(500).json({ message: "An unexpected error occurred while deleting the client." });
        }
    }



// Exportación de los métodos
export const methods = {
    getProducts,
    addProduct,
    updateStock,
    updateProduct,
    deletepproduct
};
