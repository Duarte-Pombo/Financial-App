/**
 * seed_05_recovering_spender.ts
 *
 * Persona: Beatriz — 29, recently started tracking her spending after a rough patch.
 * Pattern: Heavy emotional spending 3–4 weeks ago, gradually improving.
 *          Recent week is noticeably healthier. Tests whether the algorithm
 *          picks up both the historic risk AND the recent positive trend.
 *
 * Expected insights:
 *  ⚠️  Historic high-risk purchases still in the 30-day window
 *  😢  Sadness dominant trigger (older purchases)
 *  🌙  Late-night pattern (older cluster)
 *  ✅  Positive reinforcement for recent calm purchases
 *  📊  Avg score should be mid-range (improving trend flattens the average)
 *  🟡  Zone: "Mild impulse risk" (not worst, not best)
 *
 * Edge cases tested:
 *  - Historical bad pattern vs recent improvement in same 30-day window
 *  - Sadness emotion (polarity -3, energy 2) → moderate emotion weight
 *  - Emotion with NO category attached (null category_id)
 *  - Transactions with no note
 */

import { getDb } from "../db";
import { randomUUID } from "expo-crypto";

const USER_ID = "local-user";

function daysAgo(n: number, hour = 12, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function ensureUser(db: any) {
  await db.runAsync(
    `INSERT OR IGNORE INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)`,
    [USER_ID, "local@app.com", "local_user", "no-auth"]
  );
}

type TestTx = {
  daysBack: number; hour: number; minute?: number;
  amount: number; merchant: string;
  emotionName: string | null;
  categoryName: string | null; // null = no category (edge case)
  note?: string;
};

const TRANSACTIONS: TestTx[] = [
  // ── WEEKS 3–4 AGO: The rough patch ────────────────────────────────────────
  { daysBack: 28, hour: 23, amount: 72.00, merchant: "Amazon", emotionName: "Sadness", categoryName: "Shopping", note: "Breakup week. Bought stuff." },
  { daysBack: 27, hour: 22, minute: 30, amount: 34.00, merchant: "ASOS", emotionName: "Sadness", categoryName: "Shopping" },
  { daysBack: 26, hour: 0, amount: 18.00, merchant: "Glovo", emotionName: "Sadness", categoryName: "Food & Drink", note: "Couldn't be bothered to cook" },
  { daysBack: 25, hour: 23, amount: 55.00, merchant: "Zara Online", emotionName: "Sadness", categoryName: "Shopping" },
  { daysBack: 24, hour: 21, amount: 9.99, merchant: "Netflix", emotionName: "Sadness", categoryName: "Entertainment", note: "Needed distraction" },
  { daysBack: 23, hour: 20, amount: 28.00, merchant: "El Corte Inglés", emotionName: "Sadness", categoryName: "Shopping" },
  { daysBack: 22, hour: 22, amount: 14.50, merchant: "Glovo", emotionName: "Anxiety", categoryName: "Food & Drink" },
  { daysBack: 21, hour: 23, minute: 30, amount: 43.00, merchant: "Mango", emotionName: "Sadness", categoryName: "Shopping" },

  // ── WEEKS 2–3 AGO: Trying to stabilise ────────────────────────────────────
  { daysBack: 18, hour: 19, amount: 22.00, merchant: "Pingo Doce", emotionName: "Sadness", categoryName: "Food & Drink", note: "At least cooking now" },
  { daysBack: 17, hour: 14, amount: 8.00, merchant: "Farmácia Saúde", emotionName: "Calm", categoryName: "Health" },
  { daysBack: 16, hour: 10, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 15, hour: 21, amount: 19.00, merchant: "H&M", emotionName: "Sadness", categoryName: "Shopping", note: "Small slip" },
  { daysBack: 14, hour: 11, amount: 26.00, merchant: "Continente", emotionName: "Calm", categoryName: "Food & Drink", note: "Actual groceries" },
  { daysBack: 13, hour: 10, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },
  { daysBack: 12, hour: 9, amount: 9.99, merchant: "Spotify", emotionName: "Calm", categoryName: "Entertainment" },
  { daysBack: 11, hour: 14, amount: 7.50, merchant: "Café Central", emotionName: "Happy", categoryName: "Food & Drink" },

  // ── WEEK 2 AGO: no-category edge case ────────────────────────────────────
  { daysBack: 13, hour: 15, amount: 5.00, merchant: "Random stall", emotionName: "Calm", categoryName: null, note: "Market, no category" },
  { daysBack: 10, hour: 13, amount: 3.50, merchant: "Unknown shop", emotionName: null, categoryName: null, note: "No emotion logged, no category" },

  // ── LAST WEEK: Clear improvement ──────────────────────────────────────────
  { daysBack: 7, hour: 10, amount: 29.00, merchant: "Pingo Doce", emotionName: "Happy", categoryName: "Food & Drink", note: "Planned weekly shop" },
  { daysBack: 6, hour: 9, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },
  { daysBack: 5, hour: 10, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 4, hour: 11, amount: 45.00, merchant: "EDP Energia", emotionName: "Calm", categoryName: "Bills", note: "Planned bill" },
  { daysBack: 3, hour: 15, amount: 14.00, merchant: "Cinema NOS", emotionName: "Excited", categoryName: "Entertainment", note: "First fun thing in a while" },
  { daysBack: 2, hour: 13, amount: 19.00, merchant: "Restaurante Faz Gosto", emotionName: "Happy", categoryName: "Food & Drink", note: "Lunch with a friend — felt good" },
  { daysBack: 1, hour: 10, amount: 8.50, merchant: "Livraria Bertrand", emotionName: "Calm", categoryName: "Education", note: "Bought a book on habits" },
];

export async function seed_05_recovering_spender(): Promise<void> {
  const db = await getDb();

  const guard = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Livraria Bertrand'`,
    [USER_ID]
  );
  if (guard && guard.count > 0) { console.log("[seed_05] already seeded, skipping"); return; }

  await ensureUser(db);

  const emotions = await db.getAllAsync<{ id: number; name: string }>("SELECT id, name FROM emotions");
  const categories = await db.getAllAsync<{ id: number; name: string }>("SELECT id, name FROM spending_categories");
  const eMap = Object.fromEntries(emotions.map((e) => [e.name, e.id]));
  const cMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  await db.withTransactionAsync(async () => {
    for (const tx of TRANSACTIONS) {
      const txId = randomUUID();
      const logId = randomUUID();
      const ts = daysAgo(tx.daysBack, tx.hour, tx.minute ?? 0);
      const emotionId = tx.emotionName ? eMap[tx.emotionName] : undefined;
      const categoryId = tx.categoryName ? cMap[tx.categoryName] : undefined;

      if (emotionId) {
        await db.runAsync(
          `INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at) VALUES (?, ?, ?, 6, 'manual', ?, ?)`,
          [logId, USER_ID, emotionId, ts, ts]
        );
      }
      await db.runAsync(
        `INSERT INTO transactions (id, user_id, category_id, emotion_log_id, amount, currency_code, merchant_name, note, type, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'EUR', ?, ?, 'cash', ?, ?)`,
        [txId, USER_ID, categoryId ?? null, emotionId ? logId : null, tx.amount, tx.merchant, tx.note ?? null, ts, ts]
      );
    }
  });
  console.log(`[seed_05] inserted ${TRANSACTIONS.length} transactions — Recovering Spender`);
}
