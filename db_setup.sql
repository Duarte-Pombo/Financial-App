PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id              TEXT        PRIMARY KEY,  
    email           TEXT        NOT NULL UNIQUE,
    username        TEXT        NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    avatar_url      TEXT,
    timezone        TEXT        NOT NULL DEFAULT 'GMT',
    currency_code   TEXT        NOT NULL DEFAULT 'EUR' CHECK (LENGTH(currency_code) = 3),
    created_at      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE emotions (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    name        TEXT        NOT NULL UNIQUE,
    category    TEXT        NOT NULL CHECK (category IN ('positive', 'negative', 'neutral')),
    polarity    INTEGER     NOT NULL CHECK (polarity BETWEEN -5 AND 5),
    energy      INTEGER     NOT NULL CHECK (energy BETWEEN 1 AND 10),
    emoji       TEXT,
    color_hex   TEXT        CHECK (LENGTH(color_hex) = 7),
    description TEXT
);

CREATE TABLE spending_categories (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    parent_id   INTEGER     REFERENCES spending_categories (id) ON DELETE SET NULL,
    user_id     TEXT        REFERENCES users (id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    icon        TEXT,
    color_hex   TEXT        CHECK (LENGTH(color_hex) = 7),
    is_system   INTEGER     NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1))
);

CREATE TABLE emotion_logs (
    id              TEXT        PRIMARY KEY,
    user_id         TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emotion_id      INTEGER     NOT NULL REFERENCES emotions (id) ON DELETE RESTRICT,
    intensity       INTEGER     NOT NULL CHECK (intensity BETWEEN 1 AND 10),
    source          TEXT        NOT NULL CHECK (source IN ('manual', 'prompted')),
    context_note    TEXT,
    logged_at       TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    created_at      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE transactions (
    id              TEXT        PRIMARY KEY,
    user_id         TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id     INTEGER     REFERENCES spending_categories (id) ON DELETE SET NULL,
    emotion_log_id  TEXT        REFERENCES emotion_logs (id) ON DELETE SET NULL,
    amount          REAL        NOT NULL,
    currency_code   TEXT        NOT NULL CHECK (LENGTH(currency_code) = 3),
    merchant_name   TEXT,
    note            TEXT,
    type            TEXT        NOT NULL CHECK (type IN ('debit','cash','bank transfer','credit')),
    is_impulse      INTEGER     CHECK (is_impulse IN (0, 1)),
    transacted_at   TEXT        NOT NULL,
    created_at      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);


-- ============================================================
--  INTELLIGENCE
-- ============================================================

CREATE TABLE emotional_patterns (
    id                  TEXT    PRIMARY KEY,
    user_id             TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emotion_id          INTEGER NOT NULL REFERENCES emotions (id) ON DELETE RESTRICT,
    category_id         INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
    pattern_type        TEXT    NOT NULL CHECK (pattern_type IN ('time_based', 'trigger', 'cyclical')),
    avg_spend_amount    REAL    NOT NULL,
    occurrence_count    INTEGER NOT NULL DEFAULT 0,
    time_of_day         TEXT,
    days_of_week        TEXT,
    correlation_score   REAL    NOT NULL,
    computed_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    valid_until         TEXT    NOT NULL
);

CREATE TABLE insights (
    id                  TEXT    PRIMARY KEY,
    user_id             TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emotion_id          INTEGER REFERENCES emotions (id) ON DELETE SET NULL,
    category_id         INTEGER REFERENCES spending_categories (id) ON DELETE SET NULL,
    type                TEXT    NOT NULL CHECK (type IN ('pattern', 'warning', 'milestone', 'nudge')),
    title               TEXT    NOT NULL,
    body                TEXT    NOT NULL,
    confidence          REAL    NOT NULL,
    data_window_days    INTEGER NOT NULL,
    metadata            TEXT    NOT NULL DEFAULT '{}',
    seen_at             TEXT,
    dismissed_at        TEXT,
    generated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE journal_entries (
    id              TEXT        PRIMARY KEY,
    user_id         TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emotion_log_id  TEXT        REFERENCES emotion_logs (id) ON DELETE SET NULL,
    transaction_id  TEXT        REFERENCES transactions (id) ON DELETE SET NULL,
    title           TEXT,
    body            TEXT        NOT NULL,
    prompt_used     TEXT,
    is_private      INTEGER     NOT NULL DEFAULT 1 CHECK (is_private IN (0, 1)),
    created_at      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE interventions (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emotion_log_id  TEXT    REFERENCES emotion_logs (id) ON DELETE SET NULL,
    transaction_id  TEXT    REFERENCES transactions (id) ON DELETE SET NULL,
    type            TEXT    NOT NULL CHECK (type IN ('breathing', 'cooldown', 'journal_nudge', 'reflection')),
    trigger_context TEXT    NOT NULL DEFAULT '{}',
    presented_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    outcome         TEXT    NOT NULL DEFAULT 'pending' CHECK (outcome IN ('heeded', 'bypassed', 'ignored', 'pending')),
    cooldown_until  TEXT,
    responded_at    TEXT
);

CREATE TABLE budgets (
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

CREATE TABLE user_settings (
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

CREATE INDEX idx_transactions_user_id           ON transactions (user_id);
CREATE INDEX idx_transactions_category_id       ON transactions (category_id);
CREATE INDEX idx_transactions_emotion_log_id    ON transactions (emotion_log_id);
CREATE INDEX idx_transactions_transacted_at     ON transactions (transacted_at DESC);
CREATE INDEX idx_transactions_type              ON transactions (type);

CREATE INDEX idx_emotion_logs_user_id           ON emotion_logs (user_id);
CREATE INDEX idx_emotion_logs_emotion_id        ON emotion_logs (emotion_id);
CREATE INDEX idx_emotion_logs_logged_at         ON emotion_logs (logged_at DESC);

CREATE INDEX idx_emotional_patterns_user_id     ON emotional_patterns (user_id);
CREATE INDEX idx_emotional_patterns_emotion_id  ON emotional_patterns (emotion_id);
CREATE INDEX idx_emotional_patterns_valid_until ON emotional_patterns (valid_until);

CREATE INDEX idx_insights_user_id               ON insights (user_id);
CREATE INDEX idx_insights_generated_at          ON insights (generated_at DESC);
CREATE INDEX idx_insights_unseen                ON insights (user_id) WHERE seen_at IS NULL;

CREATE INDEX idx_journal_entries_user_id        ON journal_entries (user_id);
CREATE INDEX idx_journal_entries_created_at     ON journal_entries (created_at DESC);

CREATE INDEX idx_interventions_user_id          ON interventions (user_id);
CREATE INDEX idx_interventions_outcome          ON interventions (outcome);

CREATE INDEX idx_budgets_user_id                ON budgets (user_id);
CREATE INDEX idx_budgets_is_active              ON budgets (is_active) WHERE is_active = 1;

CREATE INDEX idx_spending_categories_user_id    ON spending_categories (user_id);
CREATE INDEX idx_spending_categories_parent_id  ON spending_categories (parent_id);

CREATE TRIGGER trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
        UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = OLD.id;
    END;

CREATE TRIGGER trg_journal_entries_updated_at
    AFTER UPDATE ON journal_entries
    FOR EACH ROW
    BEGIN
        UPDATE journal_entries SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = OLD.id;
    END;

CREATE TRIGGER trg_user_settings_updated_at
    AFTER UPDATE ON user_settings
    FOR EACH ROW
    BEGIN
        UPDATE user_settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = OLD.id;
    END;
