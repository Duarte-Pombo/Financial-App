/**
 * routes/users.ts
 *
 * POST   /api/users/register         → create account
 * POST   /api/users/login            → authenticate, return JWT
 * GET    /api/users/:id              → user profile
 * GET    /api/users/:id/stats        → profile stats
 * PATCH  /api/users/:id              → update profile fields
 * PATCH  /api/users/:id/password     → change password
 * DELETE /api/users/:id              → delete account + all data
 */

import { Router } from "express";
import { createHash, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { getDb } from "../db";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashPassword(plain: string): string {
	return createHash("sha256").update(plain).digest("hex");
}

function signToken(userId: string): string {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error("JWT_SECRET is not set in environment");
	return jwt.sign({ sub: userId }, secret, { expiresIn: "90d" });
}

// ─── POST /api/users/register ─────────────────────────────────────────────────

router.post("/register", (req, res) => {
	const db = getDb();
	const { email, username, password } = req.body;

	if (!email || !username || !password) {
		res.status(400).json({ error: "email, username, and password are required" });
		return;
	}

	try {
		const id = randomUUID();
		const hash = hashPassword(password);
		const now = new Date().toISOString();

		db.prepare(
			`INSERT INTO users (id, email, username, password_hash, timezone, currency_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'UTC', 'EUR', ?, ?)`
		).run(id, email.trim().toLowerCase(), username.trim(), hash, now, now);

		const token = signToken(id);
		res.status(201).json({ ok: true, token, userId: id, username: username.trim() });
	} catch (err: any) {
		if (err.message?.includes("UNIQUE constraint failed")) {
			res.status(409).json({ error: "Email or username is already taken." });
			return;
		}
		console.error("[users] register error:", err);
		res.status(500).json({ error: "Registration failed" });
	}
});

// ─── POST /api/users/login ────────────────────────────────────────────────────

router.post("/login", (req, res) => {
	const db = getDb();
	const { email, password } = req.body;

	if (!email || !password) {
		res.status(400).json({ error: "email and password are required" });
		return;
	}

	try {
		const hash = hashPassword(password);
		const user = db
			.prepare(
				"SELECT id, username, currency_code FROM users WHERE email = ? AND password_hash = ?"
			)
			.get(email.trim().toLowerCase(), hash) as
			| { id: string; username: string; currency_code: string }
			| undefined;

		if (!user) {
			res.status(401).json({ error: "Invalid email or password." });
			return;
		}

		const token = signToken(user.id);
		res.json({ ok: true, token, userId: user.id, username: user.username, currency_code: user.currency_code });
	} catch (err) {
		console.error("[users] login error:", err);
		res.status(500).json({ error: "Login failed" });
	}
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

router.get("/:id", (req, res) => {
	const db = getDb();
	try {
		const row = db
			.prepare(
				"SELECT id, email, username, timezone, currency_code, avatar_url, created_at FROM users WHERE id = ?"
			)
			.get(req.params.id);

		if (!row) {
			res.status(404).json({ error: "User not found" });
			return;
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
		const user = db
			.prepare("SELECT id FROM users WHERE id = ? AND password_hash = ?")
			.get(req.params.id, hashPassword(current_password));

		if (!user) {
			res.status(401).json({ error: "Current password is incorrect" });
			return;
		}

		db.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
			.run(hashPassword(new_password), req.params.id);

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
