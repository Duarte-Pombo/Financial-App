/**
 * seed_07_anger_spender.ts
 *
 * Persona: Diogo — 32, competitive, high earner, explosive temperament.
 * Pattern: Anger drives large, high-category purchases. Polarity -5, Energy 9
 *          = maximum emotion weight (3). Combined with large amounts and
 *          impulsive categories = consistently hitting top-risk zone.
 *
 * Expected insights:
 *  ⚠️  High-risk spending detected (max emotion + max amount weight)
 *  😠  Anger as dominant trigger
 *  💸  Above-average purchases (large amounts throughout)
 *  🛍️  Shopping as top risky category
 *  🔴  Zone: "High-risk pattern" (scores consistently 9+)
 *
 * Edge cases tested:
 *  - Maximum emotion weight (anger: polarity=-5, energy=9 → weight 3)
 *  - Very large single amounts (€200–€500)
 *  - High-impulse category (Shopping) + max emotion = guaranteed score ≥ 6
 *  - Anger during daytime (proves emotion alone can push score high without time penalty)
 */

import { getDb } from "../db";
import { randomUUID } from "expo-crypto";

const USER_ID = "local-user";

function daysAgo(n: number, hour = 15, minute = 0): string {
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
  emotionName: string; categoryName: string; note?: string;
};

const TRANSACTIONS: TestTx[] = [
  // ── Anger + large Shopping (max emotion + amount weight) ─────────────────
  { daysBack: 1, hour: 15, amount: 280.00, merchant: "Apple Store", emotionName: "Anger", categoryName: "Shopping", note: "Smashed my phone, bought new one in rage" },
  { daysBack: 2, hour: 14, amount: 180.00, merchant: "Nike Store", emotionName: "Anger", categoryName: "Shopping", note: "After losing a match" },
  { daysBack: 4, hour: 16, amount: 95.00, merchant: "Adidas Store", emotionName: "Anger", categoryName: "Shopping", note: "Bad day at work" },
  { daysBack: 5, hour: 17, amount: 220.00, merchant: "PlayStation Store", emotionName: "Anger", categoryName: "Entertainment", note: "Console + games, didn't think" },
  { daysBack: 7, hour: 13, amount: 145.00, merchant: "El Corte Inglés", emotionName: "Anger", categoryName: "Shopping" },
  { daysBack: 8, hour: 15, amount: 320.00, merchant: "Apple Store", emotionName: "Anger", categoryName: "Shopping", note: "Bought AirPods Max — still angry" },
  { daysBack: 10, hour: 14, amount: 75.00, merchant: "H&M", emotionName: "Anger", categoryName: "Shopping" },
  { daysBack: 11, hour: 16, amount: 190.00, merchant: "FNAC", emotionName: "Anger", categoryName: "Shopping", note: "Camera I don't need" },
  { daysBack: 13, hour: 17, amount: 88.00, merchant: "Worten", emotionName: "Anger", categoryName: "Shopping" },
  { daysBack: 14, hour: 13, amount: 450.00, merchant: "Concessionária Motas", emotionName: "Anger", categoryName: "Other", note: "Rage-bought a scooter" },

  // ── Anger during evening (stacks time + emotion) ──────────────────────────
  { daysBack: 3, hour: 21, amount: 155.00, merchant: "Amazon", emotionName: "Anger", categoryName: "Shopping", note: "Night + anger + shopping = max risk" },
  { daysBack: 6, hour: 22, amount: 65.00, merchant: "Zara Online", emotionName: "Anger", categoryName: "Shopping" },
  { daysBack: 9, hour: 23, amount: 210.00, merchant: "Apple Store Online", emotionName: "Anger", categoryName: "Shopping", note: "Late night, max risk" },
  { daysBack: 12, hour: 21, minute: 30, amount: 48.00, merchant: "ASOS", emotionName: "Anger", categoryName: "Shopping" },

  // ── Anger with Food (lower category weight, but emotion still high) ───────
  { daysBack: 2, hour: 12, amount: 38.00, merchant: "Restaurante Caro", emotionName: "Anger", categoryName: "Food & Drink", note: "Lunch alone after argument" },
  { daysBack: 5, hour: 13, amount: 52.00, merchant: "Michelin restaurant", emotionName: "Anger", categoryName: "Food & Drink", note: "Expensive meal to feel better" },
  { daysBack: 9, hour: 12, amount: 22.00, merchant: "Tasca de Luxo", emotionName: "Anger", categoryName: "Food & Drink" },

  // ── Necessary/calm purchases for contrast ─────────────────────────────────
  { daysBack: 15, hour: 10, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport", note: "Morning commute, calm" },
  { daysBack: 16, hour: 10, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 20, hour: 11, amount: 120.00, merchant: "EDP Energia", emotionName: "Calm", categoryName: "Bills", note: "Planned bill" },
  { daysBack: 25, hour: 10, amount: 30.00, merchant: "Pingo Doce", emotionName: "Happy", categoryName: "Food & Drink", note: "Weekly groceries, happy" },
];

export async function seed_07_anger_spender(): Promise<void> {
  const db = await getDb();

  const guard = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Concessionária Motas'`,
    [USER_ID]
  );
  if (guard && guard.count > 0) { console.log("[seed_07] already seeded, skipping"); return; }

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
          `INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at) VALUES (?, ?, ?, 9, 'manual', ?, ?)`,
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
  console.log(`[seed_07] inserted ${TRANSACTIONS.length} transactions — Anger Spender`);
}
