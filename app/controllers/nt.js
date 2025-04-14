import pool from "./authentication.controllers.js";

async function notification(req, res){
    const { user_id, description, title, type, timesTamp } = req.body;
    console.log(req.body)
    if (!user_id || !description || !title || !type || !timesTamp ) {
        return res.status(400).json({ error: "Missing fields in notification" });
    }
    const query = await pool.query(
        "INSERT INTO notifications (user_id, description, title, type) VALUES ($1, $2, $3, $4) RETURNING *",
        [user_id, description, title, type]
    );
    if (query.rowCount === 0) {
        return res.status(500).json({ error: "Failed to create notification" });
    }
    const notifications = query.rows[0];
    res.status(201).json({ success: true, notification: notifications });
}

async function getNotifications(req, res) {
    const  user_id  = req.params.id;
    if (!user_id) {
        return res.status(400).json({ error: "Missing user_id" });
    }
    const query = await pool.query(
        "SELECT * FROM notifications WHERE user_id = $1",
        [user_id]
    );
    if (query.rowCount === 0) {
        return res.status(404).json({ error: "No notifications found" });
    }
    const notifications = query.rows;
    res.status(200).json({ success: true, notifications });
}


async function deleteNotification(req, res) {
    const { id } = req.params.id;
    if (!id) {
        return res.status(400).json({ error: "Missing notification ID" });
    }
    const query = await pool.query(
        "DELETE FROM notifications WHERE id = $1 RETURNING *",
        [id]
    );
    if (query.rowCount === 0) {
        return res.status(404).json({ error: "Notification not found" });
    }
    const notification = query.rows[0];
    res.status(200).json({ success: true, notification });
}
async function clearNotifications(req, res) {
    const { user_id } = req.params;
    if (!user_id) {
        return res.status(400).json({ error: "Missing user_id" });
    }
    const query = await pool.query(
        "DELETE FROM notifications WHERE user_id = $1",
        [user_id]
    );
    if (query.rowCount === 0) {
        return res.status(404).json({ error: "No notifications found" });
    }
    res.status(200).json({ success: true, message: "Notifications cleared" });
}

export const methods = {
    notification,
    getNotifications,
    deleteNotification,
    clearNotifications
};