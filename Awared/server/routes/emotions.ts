/**
 * routes/emotions.ts
 *
 * GET /api/emotions
 * Returns the full emotion registry (id, name, emoji, color_hex).
 */

import { Router } from "express";
import { getDb } from "../db";

const router = Router();

router.get("/", (_req, res) => {
	const db = getDb();
	try {
		const rows = db
			.prepare("SELECT id, name, emoji, color_hex FROM emotions ORDER BY id ASC")
			.all();
		res.json(rows);
	} catch (err) {
		console.error("[emotions] GET error:", err);
		res.status(500).json({ error: "Failed to fetch emotions" });
	}
});

export default router;
