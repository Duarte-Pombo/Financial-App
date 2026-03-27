/**
 * seed_01_mindful_spender.ts
 *
 * Persona: Ana — 24, works in HR, budgets carefully.
 * Pattern: Planned purchases, positive emotions, daytime spending,
 *          consistent categories, never above-average amounts.
 *
 * Expected insights:
 *  ✅ Positive reinforcement ("You're spending mindfully")
 *  📊 Low avg risk score (< 3)
 *  🟢 Zone: "Healthy pattern"
 *  No high-risk or pattern warnings
 */

import { getDb } from "../db";
import { randomUUID } from "expo-crypto";

const USER_ID = "local-user";

function daysAgo(n: number, hour = 10, minute = 0): string {
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
  // Weekly groceries — calm, morning
  { daysBack: 1, hour: 10, amount: 32.40, merchant: "Pingo Doce", emotionName: "Calm", categoryName: "Food & Drink", note: "Weekly shop" },
  { daysBack: 8, hour: 10, amount: 28.90, merchant: "Pingo Doce", emotionName: "Calm", categoryName: "Food & Drink" },
  { daysBack: 15, hour: 9, amount: 31.20, merchant: "Continente", emotionName: "Happy", categoryName: "Food & Drink" },
  { daysBack: 22, hour: 10, amount: 27.80, merchant: "Pingo Doce", emotionName: "Calm", categoryName: "Food & Drink" },

  // Daily commute — happy mornings
  { daysBack: 1, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },
  { daysBack: 2, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 3, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },
  { daysBack: 5, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 6, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },
  { daysBack: 9, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 10, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },

  // Planned bills
  { daysBack: 3, hour: 11, amount: 45.00, merchant: "NOS Internet", emotionName: "Calm", categoryName: "Bills", note: "Monthly internet" },
  { daysBack: 10, hour: 11, amount: 120.00, merchant: "EDP Energia", emotionName: "Calm", categoryName: "Bills", note: "Electricity" },

  // Planned subscriptions / education
  { daysBack: 5, hour: 14, amount: 9.99, merchant: "Spotify", emotionName: "Happy", categoryName: "Entertainment", note: "Monthly sub" },
  { daysBack: 12, hour: 15, amount: 14.99, merchant: "Duolingo Plus", emotionName: "Excited", categoryName: "Education" },
  { daysBack: 20, hour: 16, amount: 11.50, merchant: "Biblioteca Municipal", emotionName: "Calm", categoryName: "Education", note: "Library membership" },

  // Health — planned
  { daysBack: 7, hour: 10, amount: 18.50, merchant: "Farmácia Saúde", emotionName: "Calm", categoryName: "Health" },
  { daysBack: 14, hour: 11, amount: 8.00, merchant: "Farmácia Saúde", emotionName: "Happy", categoryName: "Health" },

  // Leisure — happy, daytime
  { daysBack: 4, hour: 15, amount: 14.00, merchant: "Cinema NOS", emotionName: "Excited", categoryName: "Entertainment", note: "Weekend film" },
  { daysBack: 11, hour: 13, amount: 19.00, merchant: "Restaurante do Bairro", emotionName: "Happy", categoryName: "Food & Drink", note: "Lunch with friends" },
  { daysBack: 18, hour: 14, amount: 12.00, merchant: "Museu Serralves", emotionName: "Calm", categoryName: "Entertainment" },
  { daysBack: 25, hour: 11, amount: 7.50, merchant: "Café Majestic", emotionName: "Happy", categoryName: "Food & Drink" },

  // Small planned clothing — calm, daytime
  { daysBack: 16, hour: 11, amount: 22.00, merchant: "Decathlon", emotionName: "Happy", categoryName: "Shopping", note: "Sports socks — needed" },
];

export async function seed_01_mindful_spender(): Promise<void> {
  const db = await getDb();

  const guard = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Metro Porto'`,
    [USER_ID]
  );
  if (guard && guard.count > 0) { console.log("[seed_01] already seeded, skipping"); return; }

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
          `INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at) VALUES (?, ?, ?, 5, 'manual', ?, ?)`,
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
  console.log(`[seed_01] inserted ${TRANSACTIONS.length} transactions — Mindful Spender`);
}
