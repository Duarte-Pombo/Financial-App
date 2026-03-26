import { getDb } from "./db";
import { randomUUID } from "expo-crypto";

export type Transaction = {
  id: string;
  user_id: string;
  category_id: number | null;
  emotion_log_id: string | null;
  amount: number;
  currency_code: string;
  merchant_name: string | null;
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

export type NewTransaction = {
  user_id: string;
  amount: number;
  merchant_name?: string;
  note?: string;
  location?: string;       // stored in merchant_name if no merchant provided
  category_id?: number;
  emotion_ids?: number[];
  currency_code?: string;
  type?: "debit" | "cash" | "bank transfer" | "credit";
};

// Ensures the local placeholder user exists (needed because user_id is a FK)
async function ensureLocalUser(user_id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO users (id, email, username, password_hash)
     VALUES (?, ?, ?, ?)`,
    [user_id, "local@app.com", "local_user", "no-auth"]
  );
}

// ─── Insert a transaction ─────────────────────────────────────────────────────
export async function insertTransaction(data: NewTransaction): Promise<string> {
  await ensureLocalUser(data.user_id);

  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  // Use merchant_name for the item name, fall back to location if provided
  const merchantName = data.merchant_name || data.location || null;

  await db.withTransactionAsync(async () => {
    // 1. Insert one emotion_log per selected emotion
    let firstLogId: string | null = null;

    for (const emotion_id of data.emotion_ids ?? []) {
      const logId = randomUUID();
      await db.runAsync(
        `INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at)
         VALUES (?, ?, ?, 5, 'manual', ?, ?)`,
        [logId, data.user_id, emotion_id, now, now]
      );
      if (!firstLogId) firstLogId = logId;
    }

    // 2. Insert the transaction
    await db.runAsync(
      `INSERT INTO transactions
         (id, user_id, category_id, emotion_log_id, amount, currency_code, merchant_name, note, type, transacted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.user_id,
        data.category_id ?? null,
        firstLogId,
        data.amount,
        data.currency_code ?? "EUR",
        merchantName,
        data.note ?? null,
        data.type ?? "cash",
        now,
        now,
      ]
    );
  });

  return id;
}

// ─── Get recent transactions ──────────────────────────────────────────────────
export async function getTransactions(user_id: string): Promise<Transaction[]> {
  const db = await getDb();
  return db.getAllAsync<Transaction>(
    `SELECT
       t.*,
       e.name      AS emotion_name,
       e.emoji     AS emotion_emoji,
       e.color_hex AS emotion_color,
       sc.name     AS category_name,
       sc.icon     AS category_icon
     FROM transactions t
     LEFT JOIN emotion_logs el        ON el.id  = t.emotion_log_id
     LEFT JOIN emotions e             ON e.id   = el.emotion_id
     LEFT JOIN spending_categories sc ON sc.id  = t.category_id
     WHERE t.user_id = ?
     ORDER BY t.transacted_at DESC
     LIMIT 50`,
    [user_id]
  );
}