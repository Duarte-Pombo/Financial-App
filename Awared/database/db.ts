import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync("awared.db");

  await _db.execAsync("PRAGMA journal_mode = WAL;");
  await _db.execAsync("PRAGMA foreign_keys = ON;");

  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_url    TEXT,
      timezone      TEXT NOT NULL DEFAULT 'GMT',
      currency_code TEXT NOT NULL DEFAULT 'EUR',
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS emotions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      category    TEXT    NOT NULL CHECK (category IN ('positive', 'negative', 'neutral')),
      polarity    INTEGER NOT NULL CHECK (polarity BETWEEN -5 AND 5),
      energy      INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 10),
      emoji       TEXT,
      color_hex   TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS spending_categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
      user_id   TEXT    REFERENCES users (id) ON DELETE CASCADE,
      name      TEXT    NOT NULL,
      icon      TEXT,
      color_hex TEXT,
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS emotion_logs (
      id           TEXT    PRIMARY KEY,
      user_id      TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      emotion_id   INTEGER NOT NULL REFERENCES emotions (id) ON DELETE RESTRICT,
      intensity    INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
      source       TEXT    NOT NULL CHECK (source IN ('manual', 'prompted')),
      context_note TEXT,
      logged_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id             TEXT    PRIMARY KEY,
      user_id        TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      category_id    INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
      emotion_log_id TEXT    REFERENCES emotion_logs (id) ON DELETE SET NULL,
      amount         REAL    NOT NULL,
      currency_code  TEXT    NOT NULL,
      merchant_name  TEXT,
      note           TEXT,
      type           TEXT    NOT NULL CHECK (type IN ('debit','cash','bank transfer','credit')),
      is_impulse     INTEGER,
      transacted_at  TEXT    NOT NULL,
      created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id              TEXT    PRIMARY KEY,
      user_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      category_id     INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
      name            TEXT    NOT NULL,
      amount_limit    REAL    NOT NULL,
      period          TEXT    NOT NULL CHECK (period IN ('weekly', 'monthly', 'custom')),
      period_start    TEXT    NOT NULL,
      period_end      TEXT    NOT NULL,
      alert_threshold INTEGER NOT NULL DEFAULT 80,
      is_active       INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id             TEXT    PRIMARY KEY,
      user_id        TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      emotion_log_id TEXT    REFERENCES emotion_logs (id) ON DELETE SET NULL,
      transaction_id TEXT    REFERENCES transactions (id) ON DELETE SET NULL,
      title          TEXT,
      body           TEXT    NOT NULL,
      prompt_used    TEXT,
      is_private     INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_id       ON transactions (user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_transacted_at ON transactions (transacted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id       ON emotion_logs (user_id);
    CREATE INDEX IF NOT EXISTS idx_emotion_logs_logged_at     ON emotion_logs (logged_at DESC);
  `);

  return _db;
}