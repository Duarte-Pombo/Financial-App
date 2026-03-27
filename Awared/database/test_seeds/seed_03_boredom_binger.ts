/**
 * seed_03_boredom_binger.ts
 *
 * Persona: Filipa — 21, student, a lot of free time between classes.
 * Pattern: Boredom drives many small, frequent purchases across the day.
 *          No single huge spend but high frequency pushes risk scores up.
 *          Entertainment and Food & Drink dominate. Several 4–5 purchase days.
 *
 * Expected insights:
 *  😑  Boredom as top trigger
 *  📊  Frequency pattern (multiple purchases per day)
 *  🎬  Entertainment as a notable category
 *  ~   Mild impulse pattern (mid-range scores, not catastrophic)
 *  🟡  Zone: "Mild impulse risk"
 *  No late-night or high-amount alerts (purchases are small and daytime)
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
  emotionName: string; categoryName: string; note?: string;
};

const TRANSACTIONS: TestTx[] = [
  // ── Day 1: 5-purchase boredom binge ──────────────────────────────────────
  { daysBack: 1, hour: 10, amount: 3.50, merchant: "Café FEUP", emotionName: "Boredom", categoryName: "Food & Drink", note: "Nothing to do after class" },
  { daysBack: 1, hour: 12, amount: 2.80, merchant: "Pingo Doce Express", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 1, hour: 14, amount: 4.99, merchant: "App Store", emotionName: "Boredom", categoryName: "Entertainment", note: "Bought a game I'll never play" },
  { daysBack: 1, hour: 16, amount: 3.20, merchant: "Nespresso Bar", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 1, hour: 18, amount: 7.50, merchant: "Wook.pt", emotionName: "Boredom", categoryName: "Entertainment", note: "Book I probably won't read" },

  // ── Day 3: 4-purchase binge ───────────────────────────────────────────────
  { daysBack: 3, hour: 11, amount: 2.50, merchant: "Bom Dia Café", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 3, hour: 13, amount: 9.90, merchant: "Steam", emotionName: "Boredom", categoryName: "Entertainment", note: "Sale, didn't need it" },
  { daysBack: 3, hour: 15, amount: 4.00, merchant: "Café Central", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 3, hour: 17, amount: 6.00, merchant: "FNAC (Livros)", emotionName: "Boredom", categoryName: "Entertainment" },

  // ── Day 5: 4-purchase binge ───────────────────────────────────────────────
  { daysBack: 5, hour: 10, amount: 3.00, merchant: "Delta Q", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 5, hour: 12, amount: 5.99, merchant: "Netflix", emotionName: "Boredom", categoryName: "Entertainment", note: "Added extra screen" },
  { daysBack: 5, hour: 15, amount: 3.80, merchant: "Pão de Açúcar", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 5, hour: 18, amount: 12.00, merchant: "Spotify (gift)", emotionName: "Boredom", categoryName: "Entertainment", note: "Gift card for myself lol" },

  // ── Scattered boredom snacks ──────────────────────────────────────────────
  { daysBack: 2, hour: 15, amount: 4.20, merchant: "Padaria Portuguesa", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 4, hour: 14, amount: 2.90, merchant: "Bom Dia Café", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 6, hour: 11, amount: 3.50, merchant: "Café FEUP", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 7, hour: 16, amount: 8.99, merchant: "App Store", emotionName: "Boredom", categoryName: "Entertainment" },
  { daysBack: 8, hour: 13, amount: 4.50, merchant: "Nespresso Bar", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 9, hour: 15, amount: 5.00, merchant: "Google Play", emotionName: "Boredom", categoryName: "Entertainment", note: "In-app purchase in a free game" },
  { daysBack: 10, hour: 14, amount: 3.20, merchant: "Café Central", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 11, hour: 16, amount: 11.00, merchant: "Steam", emotionName: "Boredom", categoryName: "Entertainment" },
  { daysBack: 12, hour: 11, amount: 2.80, merchant: "Padaria Portuguesa", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 13, hour: 14, amount: 6.50, merchant: "Wook.pt", emotionName: "Boredom", categoryName: "Entertainment" },
  { daysBack: 15, hour: 15, amount: 3.50, merchant: "Café FEUP", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 17, hour: 13, amount: 4.99, merchant: "App Store", emotionName: "Boredom", categoryName: "Entertainment" },
  { daysBack: 20, hour: 16, amount: 3.80, merchant: "Bom Dia Café", emotionName: "Boredom", categoryName: "Food & Drink" },
  { daysBack: 23, hour: 14, amount: 7.00, merchant: "FNAC (Livros)", emotionName: "Boredom", categoryName: "Entertainment" },

  // ── A few calm purchases for contrast ────────────────────────────────────
  { daysBack: 4, hour: 9, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 6, hour: 9, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 14, hour: 11, amount: 22.00, merchant: "Pingo Doce", emotionName: "Happy", categoryName: "Food & Drink", note: "Planned groceries" },
];

export async function seed_03_boredom_binger(): Promise<void> {
  const db = await getDb();

  const guard = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Wook.pt'`,
    [USER_ID]
  );
  if (guard && guard.count > 0) { console.log("[seed_03] already seeded, skipping"); return; }

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
  console.log(`[seed_03] inserted ${TRANSACTIONS.length} transactions — Boredom Binger`);
}
