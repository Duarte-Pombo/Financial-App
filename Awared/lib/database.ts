import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

// ─── Open / return the singleton connection ───────────────────────────────────
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("moodspend.db");
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  return db;
}

// ─── Run all migrations in order ─────────────────────────────────────────────
export async function runMigrations(): Promise<void> {
  const database = await getDb();

  // migrations table tracks which have already run
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      applied_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
  `);

  for (const migration of MIGRATIONS) {
    const existing = await database.getFirstAsync<{ id: number }>(
      "SELECT id FROM _migrations WHERE name = ?;",
      [migration.name]
    );
    if (existing) continue;

    await database.withTransactionAsync(async () => {
      await database.execAsync(migration.sql);
      await database.runAsync(
        "INSERT INTO _migrations (name) VALUES (?);",
        [migration.name]
      );
    });

    console.log(`[db] migration applied: ${migration.name}`);
  }
}

// ─── Migrations ───────────────────────────────────────────────────────────────
// Add new migrations to the END of this array only — never edit existing ones.
const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "001_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id              TEXT  PRIMARY KEY,
        email           TEXT  NOT NULL UNIQUE,
        username        TEXT  NOT NULL UNIQUE,
        password_hash   TEXT  NOT NULL,
        avatar_url      TEXT,
        timezone        TEXT  NOT NULL DEFAULT 'GMT',
        currency_code   TEXT  NOT NULL DEFAULT 'EUR' CHECK (LENGTH(currency_code) = 3),
        created_at      TEXT  NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at      TEXT  NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS emotions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL UNIQUE,
        category    TEXT    NOT NULL CHECK (category IN ('positive', 'negative', 'neutral')),
        polarity    INTEGER NOT NULL CHECK (polarity BETWEEN -5 AND 5),
        energy      INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 10),
        emoji       TEXT,
        color_hex   TEXT    CHECK (LENGTH(color_hex) = 7),
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS spending_categories (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id   INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
        user_id     TEXT    REFERENCES users (id) ON DELETE CASCADE,
        name        TEXT    NOT NULL,
        icon        TEXT,
        color_hex   TEXT    CHECK (LENGTH(color_hex) = 7),
        is_system   INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1))
      );

      CREATE TABLE IF NOT EXISTS emotion_logs (
        id            TEXT    PRIMARY KEY,
        user_id       TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        emotion_id    INTEGER NOT NULL REFERENCES emotions (id) ON DELETE RESTRICT,
        intensity     INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
        source        TEXT    NOT NULL CHECK (source IN ('manual', 'prompted')),
        context_note  TEXT,
        logged_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id              TEXT    PRIMARY KEY,
        user_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        category_id     INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
        emotion_log_id  TEXT    REFERENCES emotion_logs (id) ON DELETE SET NULL,
        amount          REAL    NOT NULL,
        currency_code   TEXT    NOT NULL CHECK (LENGTH(currency_code) = 3),
        merchant_name   TEXT,
        note            TEXT,
        type            TEXT    NOT NULL CHECK (type IN ('debit','cash','bank transfer','credit')),
        is_impulse      INTEGER CHECK (is_impulse IN (0, 1)),
        transacted_at   TEXT    NOT NULL,
        created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS emotional_patterns (
        id                TEXT  PRIMARY KEY,
        user_id           TEXT  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        emotion_id        INTEGER NOT NULL REFERENCES emotions (id) ON DELETE RESTRICT,
        category_id       INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
        pattern_type      TEXT  NOT NULL CHECK (pattern_type IN ('time_based', 'trigger', 'cyclical')),
        avg_spend_amount  REAL  NOT NULL,
        occurrence_count  INTEGER NOT NULL DEFAULT 0,
        time_of_day       TEXT,
        days_of_week      TEXT,
        correlation_score REAL  NOT NULL,
        computed_at       TEXT  NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        valid_until       TEXT  NOT NULL
      );

      CREATE TABLE IF NOT EXISTS insights (
        id                TEXT  PRIMARY KEY,
        user_id           TEXT  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        emotion_id        INTEGER REFERENCES emotions (id) ON DELETE SET NULL,
        category_id       INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
        type              TEXT  NOT NULL CHECK (type IN ('pattern', 'warning', 'milestone', 'nudge')),
        title             TEXT  NOT NULL,
        body              TEXT  NOT NULL,
        confidence        REAL  NOT NULL,
        data_window_days  INTEGER NOT NULL,
        metadata          TEXT  NOT NULL DEFAULT '{}',
        seen_at           TEXT,
        dismissed_at      TEXT,
        generated_at      TEXT  NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id              TEXT    PRIMARY KEY,
        user_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        emotion_log_id  TEXT    REFERENCES emotion_logs (id) ON DELETE SET NULL,
        transaction_id  TEXT    REFERENCES transactions (id) ON DELETE SET NULL,
        title           TEXT,
        body            TEXT    NOT NULL,
        prompt_used     TEXT,
        is_private      INTEGER NOT NULL DEFAULT 1 CHECK (is_private IN (0, 1)),
        created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS interventions (
        id              TEXT  PRIMARY KEY,
        user_id         TEXT  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        emotion_log_id  TEXT  REFERENCES emotion_logs (id) ON DELETE SET NULL,
        transaction_id  TEXT  REFERENCES transactions (id) ON DELETE SET NULL,
        type            TEXT  NOT NULL CHECK (type IN ('breathing', 'cooldown', 'journal_nudge', 'reflection')),
        trigger_context TEXT  NOT NULL DEFAULT '{}',
        presented_at    TEXT  NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        outcome         TEXT  NOT NULL DEFAULT 'pending' CHECK (outcome IN ('heeded', 'bypassed', 'ignored', 'pending')),
        cooldown_until  TEXT,
        responded_at    TEXT
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
        alert_threshold INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold BETWEEN 1 AND 100),
        is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id                  TEXT    PRIMARY KEY,
        user_id             TEXT    NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
        emotion_check_freq  TEXT    NOT NULL DEFAULT 'per_transaction' CHECK (emotion_check_freq IN ('per_transaction', 'daily', 'manual')),
        nudge_enabled       INTEGER NOT NULL DEFAULT 1 CHECK (nudge_enabled IN (0, 1)),
        cooldown_minutes    INTEGER NOT NULL DEFAULT 30,
        weekly_digest_on    INTEGER NOT NULL DEFAULT 1 CHECK (weekly_digest_on IN (0, 1)),
        notification_prefs  TEXT    NOT NULL DEFAULT '{}',
        theme               TEXT    NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
        updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user_id         ON transactions (user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category_id     ON transactions (category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_emotion_log_id  ON transactions (emotion_log_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_transacted_at   ON transactions (transacted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type            ON transactions (type);
      CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id         ON emotion_logs (user_id);
      CREATE INDEX IF NOT EXISTS idx_emotion_logs_emotion_id      ON emotion_logs (emotion_id);
      CREATE INDEX IF NOT EXISTS idx_emotion_logs_logged_at       ON emotion_logs (logged_at DESC);
      CREATE INDEX IF NOT EXISTS idx_insights_user_id             ON insights (user_id);
      CREATE INDEX IF NOT EXISTS idx_insights_generated_at        ON insights (generated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id      ON journal_entries (user_id);
      CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at   ON journal_entries (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_interventions_user_id        ON interventions (user_id);
      CREATE INDEX IF NOT EXISTS idx_budgets_user_id              ON budgets (user_id);
      CREATE INDEX IF NOT EXISTS idx_spending_categories_user_id  ON spending_categories (user_id);

      CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
        AFTER UPDATE ON users FOR EACH ROW
        BEGIN
          UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = OLD.id;
        END;

      CREATE TRIGGER IF NOT EXISTS trg_journal_entries_updated_at
        AFTER UPDATE ON journal_entries FOR EACH ROW
        BEGIN
          UPDATE journal_entries SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = OLD.id;
        END;

      CREATE TRIGGER IF NOT EXISTS trg_user_settings_updated_at
        AFTER UPDATE ON user_settings FOR EACH ROW
        BEGIN
          UPDATE user_settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = OLD.id;
        END;
    `,
  },

  {
    name: "002_seed_emotions",
    sql: `
      INSERT OR IGNORE INTO emotions (name, category, polarity, energy, emoji, color_hex, description) VALUES
        ('Sadness',  'negative', -3, 2, '😢', '#c8daf5', 'Feeling of sorrow or unhappiness'),
        ('Stress',   'negative', -4, 7, '😤', '#7a2a8c', 'Feeling overwhelmed or under pressure'),
        ('Happy',    'positive',  4, 7, '😊', '#f5e642', 'Feeling of joy or contentment'),
        ('Anxiety',  'negative', -4, 8, '😰', '#f0997b', 'Feeling of worry or unease'),
        ('Boredom',  'neutral',  -1, 2, '😑', '#b4b2a9', 'Feeling of disengagement or restlessness'),
        ('Excited',  'positive',  5, 9, '🤩', '#9FE1CB', 'Feeling of enthusiasm or eagerness'),
        ('Calm',     'positive',  2, 3, '😌', '#c9b8d8', 'Feeling of peace and relaxation'),
        ('Anger',    'negative', -5, 9, '😠', '#f09595', 'Feeling of frustration or rage');
    `,
  },

  {
    name: "003_seed_spending_categories",
    sql: `
      INSERT OR IGNORE INTO spending_categories (name, icon, color_hex, is_system) VALUES
        ('Food & Drink',    '🍔', '#f5e642', 1),
        ('Transport',       '🚌', '#c8daf5', 1),
        ('Shopping',        '🛍️', '#f3d0ff', 1),
        ('Entertainment',   '🎬', '#9FE1CB', 1),
        ('Health',          '💊', '#f09595', 1),
        ('Bills',           '#️⃣', '#b4b2a9', 1),
        ('Education',       '📚', '#c8daf5', 1),
        ('Other',           '📦', '#d3d1c7', 1);
    `,
  },
];