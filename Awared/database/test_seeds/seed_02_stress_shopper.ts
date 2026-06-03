/**
 * seed_02_stress_shopper.ts
 *
 * Persona: Rodrigo — 27, software dev, high-pressure job.
 * Pattern: Buys things when stressed or anxious, mostly Shopping & Food,
 *          clusters around late evenings after work, several late-night outliers,
 *          above-average amounts when emotional.
 *
 * Expected insights:
 *  ⚠️  High-risk spending detected
 *  😤  Stress / 😰 Anxiety as top trigger
 *  🌙  Late-night spending habit
 *  🛍️  Shopping as biggest spend (high-weight category)
 *  💸  Above-average purchases flagged
 *  🟠  Zone: "Emotional spending detected"
 */

import { getDb } from "../db";
import { randomUUID } from "expo-crypto";

const USER_ID = 2;

const SEED_ANCHOR = new Date("2026-04-17T12:00:00");

function daysAgo(n: number, hour = 12, minute = 0): string {
  const d = new Date(SEED_ANCHOR);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function ensureUser(db: any) {
  await db.runAsync(
    `INSERT OR IGNORE INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)`,
    [USER_ID, "stress@app.com", "stress_user", "MTIz"]
  );
}

type TestTx = {
  daysBack: number; hour: number; minute?: number;
  amount: number; merchant: string;
  emotionName: string; categoryName: string; note?: string;
};

const TRANSACTIONS: TestTx[] = [
  // ── Post-work stress shopping (evenings, 19–22h) ──────────────────────────
  { daysBack: 1, hour: 20, amount: 44.00, merchant: "FNAC", emotionName: "Stress", categoryName: "Shopping", note: "Bought a gadget to decompress" },
  { daysBack: 2, hour: 21, amount: 29.99, merchant: "Amazon", emotionName: "Anxiety", categoryName: "Shopping" },
  { daysBack: 4, hour: 19, minute: 30, amount: 18.50, merchant: "Worten", emotionName: "Stress", categoryName: "Shopping" },
  { daysBack: 6, hour: 20, amount: 62.00, merchant: "El Corte Inglés", emotionName: "Stress", categoryName: "Shopping", note: "Felt entitled after bad sprint" },
  { daysBack: 9, hour: 21, minute: 15, amount: 37.00, merchant: "Zara", emotionName: "Anxiety", categoryName: "Shopping" },
  { daysBack: 11, hour: 20, amount: 22.00, merchant: "Mango", emotionName: "Stress", categoryName: "Shopping" },
  { daysBack: 14, hour: 21, amount: 55.00, merchant: "Nike Store", emotionName: "Stress", categoryName: "Shopping", note: "Big project deadline rage-buy" },
  { daysBack: 17, hour: 19, amount: 31.00, merchant: "Pull & Bear", emotionName: "Anxiety", categoryName: "Shopping" },
  { daysBack: 21, hour: 20, amount: 14.90, merchant: "Amazon", emotionName: "Stress", categoryName: "Shopping" },

  // ── Late-night spirals ──────────────────────────────────────────────────────
  { daysBack: 3, hour: 23, amount: 48.00, merchant: "Amazon", emotionName: "Anxiety", categoryName: "Shopping", note: "3AM doom scroll and buy" },
  { daysBack: 7, hour: 0, minute: 20, amount: 78.00, merchant: "Zalando", emotionName: "Stress", categoryName: "Shopping", note: "Couldn't sleep, shopped instead" },
  { daysBack: 13, hour: 23, minute: 50, amount: 34.00, merchant: "ASOS", emotionName: "Anger", categoryName: "Shopping" },
  { daysBack: 19, hour: 22, minute: 45, amount: 19.00, merchant: "Shein", emotionName: "Anxiety", categoryName: "Shopping" },
  { daysBack: 25, hour: 1, amount: 91.00, merchant: "Amazon", emotionName: "Stress", categoryName: "Shopping", note: "Panic-bought expensive headphones" },

  // ── Stress food (convenience, quick) ─────────────────────────────────────
  { daysBack: 1, hour: 13, amount: 9.50, merchant: "McDonald's", emotionName: "Stress", categoryName: "Food & Drink" },
  { daysBack: 2, hour: 13, amount: 7.80, merchant: "Burger King", emotionName: "Anxiety", categoryName: "Food & Drink" },
  { daysBack: 4, hour: 12, amount: 11.00, merchant: "Nando's", emotionName: "Stress", categoryName: "Food & Drink", note: "Needed comfort food" },
  { daysBack: 6, hour: 13, amount: 8.20, merchant: "KFC", emotionName: "Stress", categoryName: "Food & Drink" },
  { daysBack: 9, hour: 12, amount: 13.50, merchant: "Sushi Go", emotionName: "Anxiety", categoryName: "Food & Drink" },
  { daysBack: 12, hour: 13, amount: 9.00, merchant: "McDonald's", emotionName: "Stress", categoryName: "Food & Drink" },

  // ── Necessary transport (low risk baseline) ──────────────────────────────
  { daysBack: 2, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Stress", categoryName: "Transport" },
  { daysBack: 3, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Anxiety", categoryName: "Transport" },
  { daysBack: 5, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Stress", categoryName: "Transport" },

  // ── One big entertainment splurge ─────────────────────────────────────────
  { daysBack: 8, hour: 21, amount: 140.00, merchant: "PlayStation Store", emotionName: "Anger", categoryName: "Entertainment", note: "Rage-bought game pass + 3 games after bad day" },
];

export async function seed_02_stress_shopper(): Promise<void> {
  const db = await getDb();

  const guard = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Zalando'`,
    [USER_ID]
  );
  if (guard && guard.count > 0) { console.log("[seed_02] already seeded, skipping"); return; }

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
      const emotionId = eMap[tx.emotionName];
      const categoryId = cMap[tx.categoryName];

      if (emotionId) {
        await db.runAsync(
          `INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at) VALUES (?, ?, ?, 8, 'manual', ?, ?)`,
          [logId, USER_ID, emotionId, ts, ts]
        );
      }
      await db.runAsync(
        `INSERT INTO transactions (id, user_id, category_id, emotion_log_id, amount, currency_code, merchant_name, note, type, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, '€', ?, ?, 'cash', ?, ?)`,
        [txId, USER_ID, categoryId ?? null, emotionId ? logId : null, tx.amount, tx.merchant, tx.note ?? null, ts, ts]
      );
    }
  });
  console.log(`[seed_02] inserted ${TRANSACTIONS.length} transactions — Stress Shopper`);
}
