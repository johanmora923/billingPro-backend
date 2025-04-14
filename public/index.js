import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { methods as authentication } from "../app/controllers/authentication.controllers.js";
import { methods as authorization } from "../app//middlewares/authorization.js";
import { methods as clients } from "../app//controllers/clients.js";
import { methods as products } from "../app//controllers/products.js";
import { methods as invoices } from "../app//controllers/Invoices.js";
import { methods as nt } from "../app//controllers/nt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuración de CORS
const corsOptions = {
    origin: ["http://localhost:5173","https://billing-pro.vercel.app"],
    credentials: true,
};

// Inicialización del servidor
const app = express();
app.set("port", 3000);

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Rutas
app.post("/api/login", authentication.login);
app.post("/api/register", authentication.register);
app.post("/api/addclient/:id", clients.addClient);
app.get("/api/getclients/:id", clients.getClients);
app.delete("/api/deleteclient/:id", clients.deleteClient);
app.get("/api/products/:id", products.getProducts );
app.post("/api/addproduct", products.addProduct);
app.put("/api/stock/:id", products.updateStock);
app.put("/api/updateproduct/:id", products.updateProduct)
app.delete("/api/deleteproduct/:id", products.deletepproduct)
app.put("/api/updateStock", invoices.updateStock)
app.post("/api/saveInvoice", invoices.saveInvoice)
app.get("/api/getInvoces/:id", invoices.getInvoices)
app.get("/api/followInvoice/:id", invoices.followInvoices)
app.put("/api/updateInvoice", invoices.updatePaymentStatus)
app.post("/api/saveHeader", invoices.saveHeader)
app.get("/api/getHeader/:id", invoices.getHeader)
app.put("/api/updateHeader", invoices.updateHeader)
app.post("/api/notifications", nt.notification)
app.get("/api/getNotifications/:id", nt.getNotifications)
app.delete("/api/deleteNotification/:id", nt.deleteNotification)
app.delete("/api/clearNotifications/:id", nt.clearNotifications)


// Inicio del servidor
app.listen(app.get("port"), () => {
    console.log(`Server running on port ${app.get("port")}`);
});
