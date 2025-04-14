import pool from "./authentication.controllers.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path"; 
import { error } from "console";

async function getInvoices(req, res) {
    const user_id = req.params.id
    try{
        if(!user_id){
            res.status(400).json({message: "not found id user", error})
        }
        const facturas = await pool.query(`
            SELECT
                f.estado,
                f.metodo_pago,
                f.id AS factura_id,
                f.user_id,
                f.cliente_id,
                c.nombre AS cliente_nombre, 
                f.total,
                f.fecha,
                f.pdf_path,
                eh.logo_path,
                eh.titulo,
                eh.nombre_empresa,
                eh.direccion,
                eh.telefono,
                eh.mensaje_pie,
                fp.producto_id,
                p.nombre AS producto_nombre, 
                fp.cantidad,
                fp.precio_unitario,
                fp.subtotal,
                fp.descuento,
                fp.codigo
            FROM
                facturas f
            LEFT JOIN clientes c ON f.cliente_id = c.id 
            LEFT JOIN detalle_factura fp ON f.id = fp.factura_id 
            LEFT JOIN productos p ON fp.producto_id = p.id 
            LEFT JOIN encabezados_facturas eh ON f.user_id = eh.user_id 
            WHERE
                f.user_id = $1
            ORDER BY
                f.fecha DESC;`,
            [user_id])
        res.status(200).json(facturas.rows)
    }
    catch(error){
        console.error("Error al obtener las facturas:", error.message);
        res.status(500).json({ message: "Error al obtener las facturas." });
    }

}




async function updateStock(req, res) {
    const client = await pool.connect(); // Obtener conexión del pool para manejar la transacción

    try {
        const { productos } = req.body;

        // Verifica que los productos sean válidos
        if (!productos || productos.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron productos para actualizar el stock." });
        }

        await client.query("BEGIN"); // Inicia la transacción

        for (const producto of productos) {
            const { id, cantidad } = producto;

            // Validación de datos
            if (!id || cantidad === undefined) {
                throw new Error(`Datos incompletos para producto: ${JSON.stringify(producto)}`);
            }

            console.log("Producto ID:", id, "Cantidad:", cantidad);

            const result = await client.query(
                "UPDATE productos SET existencias = existencias - $1 WHERE id = $2 AND existencias >= $3",
                [cantidad, id, cantidad]
            );

            if (result.rowCount === 0) {
                throw new Error(`Producto con ID ${id} no tiene suficiente stock disponible.`);
            }
        }

        await client.query("COMMIT"); // Confirmar la transacción
        res.json({ message: "Stock actualizado correctamente." });
    } catch (error) {
        await client.query("ROLLBACK"); // Revertir los cambios si hay un error
        console.error(`Error al actualizar stock: ${error.message}`);
        res.status(500).json({ message: "Hubo un problema al actualizar el stock." });
    } finally {
        client.release(); // Liberar la conexión
    }
}



async function saveInvoice(req, res) {
    const { userId, clienteId, clienteNombre, total, fecha, productos, estado, metodoPago } = req.body;
    console.log(userId, clienteId, clienteNombre, total, fecha, productos, estado, metodoPago);

    if (!userId || !clienteId || !clienteNombre || !total || !fecha || !productos || !estado) {
        return res.status(400).json({ message: "Error: Datos incompletos para guardar la factura." });
    }

    try {
        const encabezadoResult = await pool.query(
            "SELECT * FROM encabezados_facturas WHERE user_id = $1 LIMIT 1",
            [userId]
        );

        const encabezado = encabezadoResult.rows[0] || {
            logo_path: null,
            titulo: "Factura",
            nombre_empresa: "No especificado",
            direccion: "No especificado",
            telefono: "No especificado",
            mensaje_pie: "Gracias por su compra.",
        };

        const facturaResult = await pool.query(
            "INSERT INTO facturas (user_id, cliente_id, cliente_nombre, total, fecha, estado, metodo_pago) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
            [userId, clienteId, clienteNombre, total, fecha, estado, metodoPago]
        );

        const facturaId = facturaResult.rows[0].id;

        for (const { id: productoId, cantidad, precio_unitario, subtotal, descuento, codigo_barra } of productos) {
            await pool.query(
                "INSERT INTO detalle_factura (factura_id, producto_id, cantidad, precio_unitario, descuento, codigo, subtotal) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [facturaId, productoId, cantidad, precio_unitario, descuento, codigo_barra, subtotal]
            );
        }

        const outputDir = "./pdf";
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.resolve(`${outputDir}/factura_${facturaId}.pdf`); // Convertir ruta relativa en absoluta

        await new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                doc.pipe(fs.createWriteStream(outputPath));

                if (encabezado.logo_path) {
                    doc.image(encabezado.logo_path, 50, 45, { width: 100 });
                }
                doc.fontSize(20).text(encabezado.titulo, 200, 50, { align: "right" });
                doc.fontSize(10)
                    .text(encabezado.nombre_empresa, 50, 110)
                    .text(encabezado.direccion, 50, 125)
                    .text(encabezado.telefono, 50, 140);

                doc.text(`Factura ID: ${facturaId}`);
                doc.text(`Cliente: ${clienteNombre}`);
                doc.text(`Fecha: ${fecha}`);
                doc.text(`Total: $${total}`);
                doc.moveDown();

                doc.text("Detalles de la Factura:", { underline: true }).moveDown();
                productos.forEach(({ nombre, cantidad, precio_unitario, subtotal }) => {
                    doc.text(
                        `Producto: ${nombre} | Cantidad: ${cantidad} | Precio Unitario: $${precio_unitario} | Subtotal: $${subtotal}`
                    );
                });

                doc.moveDown().text(encabezado.mensaje_pie, { align: "center" });

                doc.end();
                resolve();
            } catch (error) {
                reject(error);
            }
        });

        await pool.query(
            "UPDATE facturas SET pdf_path = $1 WHERE id = $2",
            [outputPath, facturaId]
        );

        // Usar una ruta absoluta con sendFile
        res.sendFile(outputPath);
    } catch (error) {
        console.error(`Error al procesar la factura: ${error.message}`);
        res.status(500).json({ message: "Error al procesar la factura." });
    }
};

async function followInvoices(req, res){
    const  clienteId  = req.params.id; // Obtener el ID del cliente desde los parámetros de la URL
    console.log(clienteId, 'aqui')
    try {
        // Consulta para obtener la última factura del cliente específico (ordenada por fecha)
        const result = await pool.query(`
            SELECT
                f.estado,
                f.metodo_pago,
                f.id AS factura_id,
                f.user_id,
                f.cliente_id,
                c.nombre AS cliente_nombre,
                f.total,
                f.fecha,
                f.pdf_path,
                eh.logo_path,
                eh.titulo,
                eh.nombre_empresa,
                eh.direccion,
                eh.telefono,
                eh.mensaje_pie
            FROM
                facturas f
            LEFT JOIN clientes c ON f.cliente_id = c.id
            LEFT JOIN encabezados_facturas eh ON f.user_id = eh.user_id
            WHERE
                f.cliente_id = $1
            ORDER BY
                f.fecha DESC
            LIMIT 1;
        `, [clienteId]);

        // Verifica si hay resultados
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "No se encontraron facturas para este cliente." });
        }

        // Devuelve la última factura
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error al obtener la última factura del cliente:", error.message);
        res.status(500).json({ message: "Error al obtener la última factura." });
    }
} 

async function updatePaymentStatus(req, res) {
    const { facturaId, estadoPago, metodoPago } = req.body; // Obtener los datos desde la solicitud
    console.log(req.body)
    // Validar los datos proporcionados
    if (!facturaId || !estadoPago || !metodoPago) {
        return res.status(400).json({ message: "Datos incompletos. Se requiere facturaId, estadoPago y metodoPago." });
    }

    try {
        // Validar que el estadoPago sea válido
        const estadosValidos = ["Pendiente", "Pagada"];
        if (!estadosValidos.includes(estadoPago)) {
            return res.status(400).json({ message: "Estado de pago inválido. Solo se permite 'Pendiente' o 'Pagada'." });
        }

        // Actualizar la factura en la base de datos
        const result = await pool.query(
            `
            UPDATE facturas
            SET estado = $1, metodo_pago = $2
            WHERE id = $3
            RETURNING id, estado, metodo_pago;
            `,
            [estadoPago, metodoPago, facturaId]
        );

        // Verificar si se actualizó alguna fila
        if (result.rowCount === 0) {
            return res.status(404).json({ message: `No se encontró una factura con el ID ${facturaId}.` });
        }

        // Devolver la factura actualizada
        res.status(200).json({
            message: "Estado de pago y método de pago actualizados correctamente.",
            factura: result.rows[0],
        });
    } catch (error) {
        console.error("Error al actualizar el estado de pago:", error.message);
        res.status(500).json({ message: "Error interno al actualizar la factura." });
    }
}

async function saveHeader(req, res) {
    const { 
        logo,
        title,
        businessName,
        businessAddress,
        businessPhone,
        footerMessage,
        rif,
        user_id} = req.body;

        console.log(req.body)

    if (!user_id || !title || !businessName || !businessAddress  || !businessPhone || !footerMessage || !rif) {
        return res.status(400).json({ message: "Error: Incomplete data to save header." });
    }

    try {
        const result = await pool.query(
            "INSERT INTO encabezados_facturas (user_id, logo_path, titulo, nombre_empresa, direccion, telefono, mensaje_pie, rif) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)  RETURNING *;",
            [user_id, logo || null, title, businessName, businessAddress, businessPhone, footerMessage, rif,]
        );

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error al guardar el encabezado:", error.message);
        res.status(500).json({ message: "Error al guardar el encabezado." });
    }
}

async function getHeader(req, res) {
    const user_id = req.params.id
    try{
        if(!user_id){
            res.status(400).json({message: "not found id user"})
        }
        const encabezado = await pool.query(`
            SELECT * FROM encabezados_facturas WHERE user_id = $1 LIMIT 1;`,
            [user_id])
        res.status(200).json(encabezado.rows[0])
    }
    catch(error){
        console.error("Error al obtener el encabezado:", error.message);
        res.status(500).json({ message: "Error al obtener el encabezado." });
    }
}
async function updateHeader(req, res) {
    const { 
        logo,
        title,
        businessName,
        businessAddress,
        businessPhone,
        footerMessage,
        rif,
        user_id} = req.body;

    if (!user_id || !title || !businessName || !businessAddress  || !businessPhone || !footerMessage || !rif) {
        return res.status(400).json({ message: "Error: Incomplete data to save header." });
    }

    try {
        const result = await pool.query(
            "UPDATE encabezados_facturas SET logo_path = $1, titulo = $2, nombre_empresa = $3, direccion = $4, telefono = $5, mensaje_pie = $6, rif = $7 WHERE user_id = $8 RETURNING *;",
            [logo || null, title, businessName, businessAddress, businessPhone, footerMessage, rif, user_id]
        );

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("Error al guardar el encabezado:", error.message);
        res.status(500).json({ message: "Error al guardar el encabezado." });
    }
} 



export const methods = {
    updateStock,
    saveInvoice,
    getInvoices,
    followInvoices,
    updatePaymentStatus,
    saveHeader,
    getHeader,
    updateHeader
};

