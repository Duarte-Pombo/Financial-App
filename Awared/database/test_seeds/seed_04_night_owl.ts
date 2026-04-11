/**
 * seed_04_night_owl.ts
 *
 * Persona: Marco — 30, freelancer, works odd hours, lives nocturnally.
 * Pattern: Almost ALL purchases happen between 21h and 3h.
 *          Mix of emotions — some happy, many anxious/stressed.
 *          Categories span Food, Shopping, Entertainment.
 *          Every transaction gets maximum time-of-day penalty.
 *
 * Expected insights:
 *  🌙  Late-night spending habit (STRONG — nearly 100% of purchases)
 *  ⚠️  High-risk transactions (time + emotion + category stacking)
 *  😰  Anxiety as dominant trigger
 *  🛍️  Shopping flagged as top risky category
 *  💸  Several above-average amounts
 *  🔴  Zone: "Emotional spending detected" or "High-risk pattern"
 *
 * Edge cases tested:
 *  - Hour = 0 (midnight, max time weight = 3)
 *  - Hour = 1, 2, 3 (deep night)
 *  - Hour = 23 (just before midnight cutoff)
 *  - Hour = 21, 22 (evening, weight = 2)
 *  - Mix of negative AND positive emotions at night (excited at night = low emotion weight but still high time weight)
 */

import { getDb } from "../db";
import { randomUUID } from "expo-crypto";

const USER_ID = 4;

function daysAgo(n: number, hour = 22, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function ensureUser(db: any) {
  await db.runAsync(
    `INSERT OR IGNORE INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)`,
    [USER_ID, "night@app.com", "night_user", "MTIz"]
  );
}

type TestTx = {
  daysBack: number; hour: number; minute?: number;
  amount: number; merchant: string;
  emotionName: string; categoryName: string; note?: string;
};

const TRANSACTIONS: TestTx[] = [
  // ── Deep night (0–3h) — maximum time penalty ──────────────────────────────
  { daysBack: 1, hour: 0, minute: 45, amount: 54.00, merchant: "Amazon", emotionName: "Anxiety", categoryName: "Shopping", note: "Can't sleep, buying stuff" },
  { daysBack: 2, hour: 1, minute: 20, amount: 28.00, merchant: "ASOS", emotionName: "Stress", categoryName: "Shopping" },
  { daysBack: 4, hour: 2, minute: 10, amount: 12.00, merchant: "Glovo", emotionName: "Anxiety", categoryName: "Food & Drink", note: "2AM food delivery" },
  { daysBack: 6, hour: 3, minute: 5, amount: 89.00, merchant: "Apple Store", emotionName: "Stress", categoryName: "Shopping", note: "Impulsively bought AirPods at 3AM" },
  { daysBack: 8, hour: 1, amount: 7.50, merchant: "Bolt Food", emotionName: "Anxiety", categoryName: "Food & Drink" },
  { daysBack: 10, hour: 0, minute: 30, amount: 34.00, merchant: "Shein", emotionName: "Sadness", categoryName: "Shopping", note: "Lonely midnight scroll" },
  { daysBack: 12, hour: 2, amount: 19.99, merchant: "Steam", emotionName: "Anxiety", categoryName: "Entertainment", note: "Bought DLC at 2AM" },
  { daysBack: 14, hour: 3, minute: 30, amount: 110.00, merchant: "Amazon", emotionName: "Anger", categoryName: "Shopping", note: "Rage purchase" },
  { daysBack: 16, hour: 0, amount: 15.00, merchant: "Glovo", emotionName: "Stress", categoryName: "Food & Drink" },
  { daysBack: 18, hour: 2, minute: 50, amount: 44.00, merchant: "Zalando", emotionName: "Sadness", categoryName: "Shopping" },
  { daysBack: 20, hour: 1, minute: 15, amount: 9.99, merchant: "Netflix", emotionName: "Anxiety", categoryName: "Entertainment", note: "Extra screen panic" },
  { daysBack: 22, hour: 0, amount: 67.00, merchant: "Apple Store", emotionName: "Anger", categoryName: "Shopping", note: "Replacement charger at 0h lol" },
  { daysBack: 24, hour: 3, amount: 6.00, merchant: "Bolt Food", emotionName: "Stress", categoryName: "Food & Drink" },

  // ── 23h zone (just before midnight cutoff) ──────────────────────────────
  { daysBack: 1, hour: 23, minute: 50, amount: 38.00, merchant: "Zara Online", emotionName: "Anxiety", categoryName: "Shopping" },
  { daysBack: 3, hour: 23, amount: 22.00, merchant: "Pull & Bear", emotionName: "Stress", categoryName: "Shopping" },
  { daysBack: 5, hour: 23, minute: 10, amount: 7.80, merchant: "Glovo", emotionName: "Anxiety", categoryName: "Food & Drink" },
  { daysBack: 7, hour: 23, amount: 14.00, merchant: "PlayStation Store", emotionName: "Excited", categoryName: "Entertainment", note: "Excited — but still 23h (time risk)" },
  { daysBack: 9, hour: 23, minute: 40, amount: 55.00, merchant: "Amazon", emotionName: "Stress", categoryName: "Shopping" },
  { daysBack: 11, hour: 23, amount: 4.50, merchant: "Bolt Food", emotionName: "Sadness", categoryName: "Food & Drink" },

  // ── 21–22h (evening, weight=2) ────────────────────────────────────────────
  { daysBack: 2, hour: 21, amount: 19.00, merchant: "H&M", emotionName: "Anxiety", categoryName: "Shopping" },
  { daysBack: 4, hour: 22, amount: 32.00, merchant: "El Corte Inglés", emotionName: "Stress", categoryName: "Shopping", note: "Evening retail therapy" },
  { daysBack: 6, hour: 21, minute: 30, amount: 11.50, merchant: "Glovo", emotionName: "Anxiety", categoryName: "Food & Drink" },
  { daysBack: 8, hour: 22, amount: 48.00, merchant: "Nike Store Online", emotionName: "Anger", categoryName: "Shopping" },
  { daysBack: 10, hour: 21, amount: 9.99, merchant: "Spotify", emotionName: "Excited", categoryName: "Entertainment", note: "Positive emotion, but still late" },
  { daysBack: 13, hour: 22, minute: 20, amount: 25.00, merchant: "FNAC", emotionName: "Boredom", categoryName: "Entertainment" },
  { daysBack: 15, hour: 21, amount: 14.00, merchant: "Worten", emotionName: "Stress", categoryName: "Shopping" },
  { daysBack: 17, hour: 22, amount: 8.00, merchant: "Bolt Food", emotionName: "Anxiety", categoryName: "Food & Drink" },
  { daysBack: 19, hour: 21, minute: 45, amount: 60.00, merchant: "Apple Store", emotionName: "Excited", categoryName: "Shopping", note: "Excited but very expensive at 21h" },
  { daysBack: 21, hour: 22, amount: 17.00, merchant: "Mango", emotionName: "Stress", categoryName: "Shopping" },

  // ── Bills (necessary, but still at night — low weight category) ─────────
  { daysBack: 5, hour: 22, amount: 45.00, merchant: "NOS Internet", emotionName: "Calm", categoryName: "Bills", note: "Paid online, calm, low risk" },
];

export async function seed_04_night_owl(): Promise<void> {
  const db = await getDb();

  const guard = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Bolt Food'`,
    [USER_ID]
  );
  if (guard && guard.count > 0) { console.log("[seed_04] already seeded, skipping"); return; }

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
          `INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at) VALUES (?, ?, ?, 7, 'manual', ?, ?)`,
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
  console.log(`[seed_04] inserted ${TRANSACTIONS.length} transactions — Night Owl`);
}
