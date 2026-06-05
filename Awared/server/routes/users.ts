
/**
 * routes/users.ts
 *
 * GET    /api/users/:id              → user profile
 * GET    /api/users/:id/stats        → profile stats (purchases count, top emotion, member since)
 * PATCH  /api/users/:id              → update profile fields
 * PATCH  /api/users/:id/password     → change password
 * DELETE /api/users/:id              → delete account + all data
 */

import { Router } from "express";
import { getDb } from "../db";

const router = Router();

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

router.get("/:id", (req, res) => {
	const db = getDb();
	try {
		let row = db
			.prepare("SELECT id, email, username, timezone, currency_code, avatar_url, created_at FROM users WHERE id = ?")
			.get(req.params.id);

		if (!row) {
			db.prepare(
				`INSERT OR IGNORE INTO users (id, email, username, password_hash, timezone, currency_code)
         VALUES (?, ?, ?, ?, ?, ?)`
			).run(req.params.id, "local@app.com", "local_user", "no-auth", "UTC", "EUR");

			row = db
				.prepare("SELECT id, email, username, timezone, currency_code, avatar_url, created_at FROM users WHERE id = ?")
				.get(req.params.id);
		}

		res.json(row);
	} catch (err) {
		console.error("[users] GET error:", err);
		res.status(500).json({ error: "Failed to fetch user" });
	}
});

// ─── GET /api/users/:id/stats ─────────────────────────────────────────────────

router.get("/:id/stats", (req, res) => {
	const db = getDb();
	const userId = req.params.id;

	try {
		const user = db
			.prepare("SELECT username, avatar_url, created_at FROM users WHERE id = ?")
			.get(userId) as { username: string; avatar_url: string | null; created_at: string | null } | undefined;

		const countRow = db
			.prepare("SELECT COUNT(*) as count FROM transactions WHERE user_id = ?")
			.get(userId) as { count: number } | undefined;

		const topEmotion = db
			.prepare(
				`SELECT e.name, e.emoji, e.color_hex
         FROM emotion_logs el
         JOIN emotions e ON e.id = el.emotion_id
         WHERE el.user_id = ?
         GROUP BY el.emotion_id
         ORDER BY COUNT(*) DESC
         LIMIT 1`
			)
			.get(userId) as { name: string; emoji: string; color_hex: string } | undefined;

		res.json({
			username: user?.username ?? "User",
			avatar_url: user?.avatar_url ?? null,
			created_at: user?.created_at ?? null,
			totalPurchases: countRow?.count ?? 0,
			topEmotionName: topEmotion?.name ?? null,
			topEmotionEmoji: topEmotion?.emoji ?? null,
			topEmotionColor: topEmotion?.color_hex ?? null,
		});
	} catch (err) {
		console.error("[users] stats error:", err);
		res.status(500).json({ error: "Failed to fetch user stats" });
	}
});

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────

router.patch("/:id", (req, res) => {
	const db = getDb();
	const { email, username, currency_code, avatar_url } = req.body;

	const fields: string[] = [];
	const values: unknown[] = [];

	if (email !== undefined) { fields.push("email = ?"); values.push(email); }
	if (username !== undefined) { fields.push("username = ?"); values.push(username); }
	if (currency_code !== undefined) { fields.push("currency_code = ?"); values.push(currency_code); }
	if (avatar_url !== undefined) { fields.push("avatar_url = ?"); values.push(avatar_url); }

	if (fields.length === 0) {
		res.status(400).json({ error: "No fields to update" });
		return;
	}

	values.push(req.params.id);

	try {
		db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
		res.json({ ok: true });
	} catch (err: any) {
		console.error("[users] PATCH error:", err);
		if (err.message?.includes("UNIQUE constraint failed")) {
			res.status(409).json({ error: "That email or username is already taken." });
			return;
		}
		res.status(500).json({ error: "Failed to update user" });
	}
});

// ─── PATCH /api/users/:id/password ────────────────────────────────────────────

router.patch("/:id/password", (req, res) => {
	const db = getDb();
	const { current_password, new_password } = req.body;

	if (!current_password || !new_password) {
		res.status(400).json({ error: "current_password and new_password are required" });
		return;
	}

	try {
		const hashOld = Buffer.from(current_password).toString("base64");

		const user = db
			.prepare("SELECT id FROM users WHERE id = ? AND password_hash = ?")
			.get(req.params.id, hashOld);

		if (!user) {
			res.status(401).json({ error: "Current password is incorrect" });
			return;
		}

		const hashNew = Buffer.from(new_password).toString("base64");
		db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashNew, req.params.id);

		res.json({ ok: true });
	} catch (err) {
		console.error("[users] password error:", err);
		res.status(500).json({ error: "Failed to update password" });
	}
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

router.delete("/:id", (req, res) => {
	const db = getDb();

	try {
		db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
		res.json({ ok: true });
	} catch (err) {
		console.error("[users] DELETE error:", err);
		res.status(500).json({ error: "Failed to delete account" });
	}
});

export default router;
