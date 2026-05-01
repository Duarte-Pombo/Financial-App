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

export type NewTransaction = {
  user_id: string;
  amount: number;
  merchant_name?: string;
  note?: string;
  location?: string;       // stored in merchant_name if no merchant provided
  category_id?: number;
  emotion_ids?: number[];
  currency_code?: string;
  type?: "debit" | "cash" | "bank transfer" | "credit" | "refunded";
  transacted_at?: string; 
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
  const transacted_at = data.transacted_at ?? now;
  const txType = data.type ?? "cash";

  await db.withTransactionAsync(async () => {
    // 1. Insert one emotion_log per selected emotion
    let firstLogId: string | null = null;

    for (const emotion_id of data.emotion_ids ?? []) {
      const logId = randomUUID();
      await db.runAsync(
        `INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at)
         VALUES (?, ?, ?, 5, 'manual', ?, ?)`,
        [logId, data.user_id, emotion_id, transacted_at, now]
      );
      if (!firstLogId) firstLogId = logId;
    }

    // 2. Insert the transaction
    await db.runAsync(
      `INSERT INTO transactions
         (id, user_id, category_id, emotion_log_id, amount, currency_code, merchant_name, location, note, type, transacted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.user_id,
        data.category_id ?? null,
        firstLogId,
        data.amount,
        data.currency_code ?? "€",
        data.merchant_name ?? null, 
        data.location ?? null,
        data.note ?? null,
        txType,
        transacted_at,
        now,
      ]
    );
  });

  return id;
}

// ─── Heatmap types ───────────────────────────────────────────────────────────
export type HeatmapTx = {
  merchant_name: string;
  amount: number;
  category_name: string | null;
  category_icon: string | null;
  emotion_emoji: string | null;
  emotion_name: string | null;
};

export type HeatmapDayData = {
  totalAmount: number;
  transactions: HeatmapTx[];
};

export type HeatmapMonthData = Record<string, HeatmapDayData>; // "YYYY-MM-DD"

export type WeekEmotionStat = {
  name: string;
  emoji: string;
  color_hex: string;
  count: number;
};

export type WeekDayData = {
  count: number;
  emotions: WeekEmotionStat[];
};

// ─── Get month data for heatmap ──────────────────────────────────────────────
export async function getMonthHeatmapData(
  user_id: string | number,
  year: number,
  month: number // 0-indexed
): Promise<HeatmapMonthData> {
  const db = await getDb();
  const mm = String(month + 1).padStart(2, "0");
  const rows = await db.getAllAsync<{
    amount: number;
    merchant_name: string | null;
    transacted_at: string;
    category_name: string | null;
    category_icon: string | null;
    emotion_emoji: string | null;
    emotion_name: string | null;
  }>(
    `SELECT t.amount, t.merchant_name, t.transacted_at,
            sc.name AS category_name, sc.icon AS category_icon,
            e.emoji AS emotion_emoji, e.name AS emotion_name
     FROM transactions t
     LEFT JOIN emotion_logs el ON el.id = t.emotion_log_id
     LEFT JOIN emotions e     ON e.id  = el.emotion_id
     LEFT JOIN spending_categories sc ON sc.id = t.category_id
     WHERE t.user_id = ?
       AND strftime('%Y-%m', t.transacted_at) = ?
     ORDER BY t.transacted_at ASC`,
    [user_id, `${year}-${mm}`]
  );

  const result: HeatmapMonthData = {};
  for (const row of rows) {
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
  return result;
}

// ─── Get week data for calendar weekly view ───────────────────────────────────
export async function getWeekHeatmapData(
  user_id: string | number,
  weekStart: Date // Monday
): Promise<WeekDayData[]> {
  const db = await getDb();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const rows = await db.getAllAsync<{
    transacted_at: string;
    emotion_name: string | null;
    emotion_emoji: string | null;
    emotion_color: string | null;
  }>(
    `SELECT t.transacted_at,
            e.name     AS emotion_name,
            e.emoji    AS emotion_emoji,
            e.color_hex AS emotion_color
     FROM transactions t
     LEFT JOIN emotion_logs el ON el.id = t.emotion_log_id
     LEFT JOIN emotions e     ON e.id  = el.emotion_id
     WHERE t.user_id = ?
       AND t.transacted_at >= ?
       AND t.transacted_at <  ?
     ORDER BY t.transacted_at ASC`,
    [user_id, weekStart.toISOString(), weekEnd.toISOString()]
  );

  const days: WeekDayData[] = Array.from({ length: 7 }, () => ({ count: 0, emotions: [] }));
  for (const row of rows) {
    const dow = (new Date(row.transacted_at).getDay() + 6) % 7; // Mon=0
    days[dow].count++;
    if (row.emotion_name && row.emotion_emoji) {
      const ex = days[dow].emotions.find((e) => e.name === row.emotion_name);
      if (ex) ex.count++;
      else days[dow].emotions.push({
        name: row.emotion_name,
        emoji: row.emotion_emoji,
        color_hex: row.emotion_color ?? "#ccc",
        count: 1,
      });
    }
  }
  return days;
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