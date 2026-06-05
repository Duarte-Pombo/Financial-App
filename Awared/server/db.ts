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

/** Close the DB connection gracefully (useful for tests). */
export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
		console.log("[db] closed");
	}
}

