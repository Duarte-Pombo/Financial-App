/**
 * server/db.ts
 *
 * better-sqlite3 connection singleton.
 * Opens awared.db in WAL mode for safe concurrent reads/writes.
 */

import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (!db) {
		const dbPath = path.resolve(__dirname, "..", "awared.db");
		db = new Database(dbPath);
		db.pragma("journal_mode = WAL");
		console.log("[db] connected to", dbPath, "(WAL mode)");
	}
	return db;
}

// ── DEBUG: schema validation ───────────────────────────────────────────────────
try {
	const db = getDb();
	const tables = db.prepare(
		`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
	).all() as { name: string }[];

	const tableNames = tables.map((t) => t.name);
	console.log("[DB] Tables found:", tableNames);

	const required = [
		"users", "transactions", "emotion_logs", "emotions",
		"spending_categories", "budgets", "user_achievements", "journal_entries"
	];
	const missing = required.filter((r) => !tableNames.includes(r));
	if (missing.length > 0) {
		console.error("[DB] MISSING TABLES:", missing);
		console.error("[DB] The server will crash on first query. Run your schema migration.");
	}
} catch (err) {
	console.error("[DB] Schema check failed:", err);
}

/** Close the DB connection gracefully (useful for tests). */
export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
		console.log("[db] closed");
	}
}

