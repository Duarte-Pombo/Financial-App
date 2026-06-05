
/**
 * routes/transactions.ts
 *
 * REST endpoints for the core transaction data flow:
 *   POST   /api/transactions          → create tx + emotion logs
 *   GET    /api/transactions          → list for user (enriched)
 *   GET    /api/transactions/:id      → single tx (enriched)
 *   PATCH  /api/transactions/:id      → update tx fields
 *   DELETE /api/transactions/:id      → hard delete
 *   GET    /api/transactions/heatmap/month  → monthly heatmap data
 *   GET    /api/transactions/heatmap/week   → weekly calendar data
 */

import { Router } from "express";
import { randomUUID } from "crypto";
import { getDb } from "../db";

const router = Router();

// ─── Types (mirrors frontend) ─────────────────────────────────────────────────

export type Transaction = {
	id: string;
	user_id: string;
	category_id: number | null;
	emotion_log_id: string | null;
	amount: number;
	currency_code: string;
	merchant_name: string | null;
	location: string | null;
	note: string | null;
	type: string;
	transacted_at: string;
	// joined fields
	emotion_name: string | null;
	emotion_emoji: string | null;
	emotion_color: string | null;
	category_name: string | null;
	category_icon: string | null;
};

// ─── POST /api/transactions ───────────────────────────────────────────────────

router.post("/", (req, res) => {
	const db = getDb();
	const {
		user_id,
		amount,
		merchant_name,
		location,
		note,
		category_id,
		emotion_ids,
		currency_code,
		type,
		transacted_at,
	} = req.body;

	if (!user_id || typeof amount !== "number") {
		res.status(400).json({ error: "user_id and amount are required" });
		return;
	}

	const now = new Date().toISOString();
	const txType = type || "cash";
	const txDate = transacted_at || now;
	const txCurrency = currency_code || "EUR";

	try {
		const txId = db.transaction(() => {
			// Ensure placeholder user exists ( FK safety )
			const userExists = db
				.prepare("SELECT 1 FROM users WHERE id = ?")
				.get(user_id);
			if (!userExists) {
				db.prepare(
					`INSERT OR IGNORE INTO users (id, email, username, password_hash, timezone, currency_code)
           VALUES (?, ?, ?, ?, ?, ?)`
				).run(user_id, "local@app.com", "local_user", "no-auth", "UTC", "EUR");
			}

			// Create one emotion_log per selected emotion
			let firstLogId: string | null = null;
			for (const emotion_id of emotion_ids || []) {
				const logId = randomUUID();
				db.prepare(
					`INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at)
           VALUES (?, ?, ?, 5, 'manual', ?, ?)`
				).run(logId, user_id, emotion_id, txDate, now);
				if (!firstLogId) firstLogId = logId;
			}

			// Insert transaction
			const id = randomUUID();
			db.prepare(
				`INSERT INTO transactions
           (id, user_id, category_id, emotion_log_id, amount, currency_code, merchant_name, location, note, type, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).run(
				id,
				user_id,
				category_id ?? null,
				firstLogId,
				amount,
				txCurrency,
				merchant_name ?? null,
				location ?? null,
				note ?? null,
				txType,
				txDate,
				now
			);

			return id;
		})();

		res.status(201).json({ id: txId });
	} catch (err) {
		console.error("[transactions] POST error:", err);
		res.status(500).json({ error: "Failed to create transaction" });
	}
});

// ─── GET /api/transactions?user_id=...&limit=... ──────────────────────────────

router.get("/", (req, res) => {
	const db = getDb();
	const { user_id, limit = "50" } = req.query;

	if (!user_id) {
		res.status(400).json({ error: "user_id query param is required" });
		return;
	}

	try {
		const rows = db
			.prepare<Transaction>(
				`SELECT t.*,
                e.name      AS emotion_name,
                e.emoji     AS emotion_emoji,
                e.color_hex AS emotion_color,
                sc.name     AS category_name,
                sc.icon     AS category_icon
         FROM transactions t
         LEFT JOIN emotion_logs el        ON el.id = t.emotion_log_id
         LEFT JOIN emotions e             ON e.id  = el.emotion_id
         LEFT JOIN spending_categories sc ON sc.id = t.category_id
         WHERE t.user_id = ?
         ORDER BY t.transacted_at DESC
         LIMIT ?`
			)
			.all(user_id as string, parseInt(limit as string, 10));

		res.json(rows);
	} catch (err) {
		console.error("[transactions] GET list error:", err);
		res.status(500).json({ error: "Failed to fetch transactions" });
	}
});

// ─── GET /api/transactions/:id ────────────────────────────────────────────────

router.get("/:id", (req, res) => {
	const db = getDb();

	try {
		const row = db
			.prepare(
				`SELECT t.*,
                e.name      AS emotion_name,
                e.emoji     AS emotion_emoji,
                e.color_hex AS emotion_color,
                sc.name     AS category_name,
                sc.icon     AS category_icon
         FROM transactions t
         LEFT JOIN emotion_logs el        ON el.id = t.emotion_log_id
         LEFT JOIN emotions e             ON e.id  = el.emotion_id
         LEFT JOIN spending_categories sc ON sc.id = t.category_id
         WHERE t.id = ?`
			)
			.get(req.params.id);

		if (!row) {
			res.status(404).json({ error: "Transaction not found" });
			return;
		}
		res.json(row);
	} catch (err) {
		console.error("[transactions] GET by id error:", err);
		res.status(500).json({ error: "Failed to fetch transaction" });
	}
});

// ─── PATCH /api/transactions/:id ──────────────────────────────────────────────

router.patch("/:id", (req, res) => {
	const db = getDb();
	const { amount, merchant_name, location, note, category_id, type, transacted_at } = req.body;

	const fields: string[] = [];
	const values: unknown[] = [];

	if (amount !== undefined) { fields.push("amount = ?"); values.push(amount); }
	if (merchant_name !== undefined) { fields.push("merchant_name = ?"); values.push(merchant_name); }
	if (location !== undefined) { fields.push("location = ?"); values.push(location); }
	if (note !== undefined) { fields.push("note = ?"); values.push(note); }
	if (category_id !== undefined) { fields.push("category_id = ?"); values.push(category_id); }
	if (type !== undefined) { fields.push("type = ?"); values.push(type); }
	if (transacted_at !== undefined) { fields.push("transacted_at = ?"); values.push(transacted_at); }

	if (fields.length === 0) {
		res.status(400).json({ error: "No fields to update" });
		return;
	}

	values.push(req.params.id);

	try {
		db.prepare(`UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`).run(...values);
		res.json({ ok: true });
	} catch (err) {
		console.error("[transactions] PATCH error:", err);
		res.status(500).json({ error: "Failed to update transaction" });
	}
});

// ─── PATCH /api/transactions/:id/emotion ──────────────────────────────────────

router.patch("/:id/emotion", (req, res) => {
	const db = getDb();
	const { emotion_id } = req.body;

	if (!emotion_id) {
		res.status(400).json({ error: "emotion_id is required" });
		return;
	}

	try {
		const tx = db
			.prepare("SELECT emotion_log_id, user_id FROM transactions WHERE id = ?")
			.get(req.params.id) as { emotion_log_id: string | null; user_id: string } | undefined;

		if (!tx) {
			res.status(404).json({ error: "Transaction not found" });
			return;
		}

		if (tx.emotion_log_id) {
			// Update existing emotion_log
			db.prepare("UPDATE emotion_logs SET emotion_id = ? WHERE id = ?").run(emotion_id, tx.emotion_log_id);
		} else {
			// Create a new emotion_log and link it
			const logId = randomUUID();
			const now = new Date().toISOString();
			db.prepare(
				`INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at)
         VALUES (?, ?, ?, 5, 'manual', ?, ?)`
			).run(logId, tx.user_id, emotion_id, now, now);
			db.prepare("UPDATE transactions SET emotion_log_id = ? WHERE id = ?").run(logId, req.params.id);
		}

		res.json({ ok: true });
	} catch (err) {
		console.error("[transactions] PATCH emotion error:", err);
		res.status(500).json({ error: "Failed to update transaction emotion" });
	}
});

// ─── DELETE /api/transactions/:id ─────────────────────────────────────────────

router.delete("/:id", (req, res) => {
	const db = getDb();

	try {
		db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
		res.json({ ok: true });
	} catch (err) {
		console.error("[transactions] DELETE error:", err);
		res.status(500).json({ error: "Failed to delete transaction" });
	}
});

// ─── GET /api/transactions/heatmap/month ──────────────────────────────────────

router.get("/heatmap/month", (req, res) => {
	const db = getDb();
	const { user_id, year, month } = req.query;

	if (!user_id || !year || month === undefined) {
		res.status(400).json({ error: "user_id, year, and month are required" });
		return;
	}

	const mm = String(parseInt(month as string, 10) + 1).padStart(2, "0");

	try {
		const rows = db
			.prepare(
				`SELECT t.amount, t.merchant_name, t.transacted_at,
                sc.name AS category_name, sc.icon AS category_icon,
                e.emoji AS emotion_emoji, e.name  AS emotion_name
         FROM transactions t
         LEFT JOIN emotion_logs el ON el.id = t.emotion_log_id
         LEFT JOIN emotions e     ON e.id  = el.emotion_id
         LEFT JOIN spending_categories sc ON sc.id = t.category_id
         WHERE t.user_id = ?
           AND strftime('%Y-%m', t.transacted_at) = ?
         ORDER BY t.transacted_at ASC`
			)
			.all(user_id as string, `${year}-${mm}`);

		type DayData = { totalAmount: number; transactions: any[] };
		const result: Record<string, DayData> = {};

		for (const row of rows as any[]) {
			const d = new Date(row.transacted_at);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			if (!result[key]) result[key] = { totalAmount: 0, transactions: [] };
			result[key].totalAmount += row.amount;
			result[key].transactions.push({
				merchant_name: row.merchant_name ?? "Unknown",
				amount: row.amount,
				category_name: row.category_name,
				category_icon: row.category_icon,
				emotion_emoji: row.emotion_emoji,
				emotion_name: row.emotion_name,
			});
		}

		res.json(result);
	} catch (err) {
		console.error("[transactions] heatmap/month error:", err);
		res.status(500).json({ error: "Failed to fetch heatmap data" });
	}
});

// ─── GET /api/transactions/heatmap/week ───────────────────────────────────────

router.get("/heatmap/week", (req, res) => {
	const db = getDb();
	const { user_id, weekStart } = req.query;

	if (!user_id || !weekStart) {
		res.status(400).json({ error: "user_id and weekStart are required" });
		return;
	}

	const weekEnd = new Date(weekStart as string);
	weekEnd.setDate(weekEnd.getDate() + 7);

	try {
		const rows = db
			.prepare(
				`SELECT t.transacted_at,
                e.name      AS emotion_name,
                e.emoji     AS emotion_emoji,
                e.color_hex AS emotion_color
         FROM transactions t
         LEFT JOIN emotion_logs el ON el.id = t.emotion_log_id
         LEFT JOIN emotions e     ON e.id  = el.emotion_id
         WHERE t.user_id = ?
           AND t.transacted_at >= ?
           AND t.transacted_at <  ?
         ORDER BY t.transacted_at ASC`
			)
			.all(user_id as string, weekStart as string, weekEnd.toISOString());

		type EmoStat = { name: string; emoji: string; color_hex: string; count: number };
		type DayData = { count: number; emotions: EmoStat[] };
		const days: DayData[] = Array.from({ length: 7 }, () => ({ count: 0, emotions: [] }));

		for (const row of rows as any[]) {
			const dow = (new Date(row.transacted_at).getDay() + 6) % 7; // Mon=0
			days[dow].count++;
			if (row.emotion_name && row.emotion_emoji) {
				const ex = days[dow].emotions.find((e) => e.name === row.emotion_name);
				if (ex) ex.count++;
				else
					days[dow].emotions.push({
						name: row.emotion_name,
						emoji: row.emotion_emoji,
						color_hex: row.emotion_color ?? "#ccc",
						count: 1,
					});
			}
		}

		res.json(days);
	} catch (err) {
		console.error("[transactions] heatmap/week error:", err);
		res.status(500).json({ error: "Failed to fetch week data" });
	}
});

export default router;
