/**
 * seed_08_happy_excited_spender.ts
 *
 * Persona: Tiago — 26, social butterfly, loves experiences.
 * Pattern: Mostly happy/excited emotions — emotion weight = 0.
 *          But: high frequency, entertainment category (weight 2),
 *          and above-average amounts. Shows that positive emotions
 *          don't make you immune to overspending patterns.
 *
 * Expected insights:
 *  🎬  Entertainment as top category (risky even when happy)
 *  💸  Above-average purchases flagged
 *  📊  Frequency pattern on weekends (3–4 purchases Sat/Sun)
 *  ✅  Positive reinforcement partially (emotion scores low)
 *  ~   Mild impulse pattern overall (category + amount carry the score)
 *  🟡  Zone: "Mild impulse risk"
 *
 * Edge cases tested:
 *  - Positive emotion (Excited, Happy) → emotion weight = 0
 *  - Amount weight still accumulates even with low emotion weight
 *  - Weekend frequency pattern (Sat = day 0, 7, 14 etc.)
 *  - All transactions between 12h–19h (time weight = 0) — isolates other factors
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
  // ── Weekend entertainment binges (3–4 purchases each weekend) ─────────────
  // Weekend 1 (this week)
  { daysBack: 2, hour: 13, amount: 18.00, merchant: "Cinema NOS", emotionName: "Excited", categoryName: "Entertainment", note: "IMAX with friends" },
  { daysBack: 2, hour: 15, amount: 32.00, merchant: "Hard Rock Café", emotionName: "Happy", categoryName: "Food & Drink", note: "Post-film dinner" },
  { daysBack: 2, hour: 18, amount: 45.00, merchant: "Bowling Porto", emotionName: "Excited", categoryName: "Entertainment", note: "Group bowling" },
  { daysBack: 1, hour: 14, amount: 12.00, merchant: "Escape Room Porto", emotionName: "Excited", categoryName: "Entertainment" },
  { daysBack: 1, hour: 17, amount: 28.00, merchant: "Restaurante Vista Rio", emotionName: "Happy", categoryName: "Food & Drink", note: "Sunday roast" },

  // Weekend 2
  { daysBack: 9, hour: 12, amount: 22.00, merchant: "FC Porto Bilhetes", emotionName: "Excited", categoryName: "Entertainment", note: "Football match!" },
  { daysBack: 9, hour: 15, amount: 14.00, merchant: "Estádio Bar", emotionName: "Excited", categoryName: "Food & Drink", note: "Drinks at the stadium" },
  { daysBack: 9, hour: 18, amount: 55.00, merchant: "Camisola FC Porto", emotionName: "Excited", categoryName: "Shopping", note: "Bought merch after the win" },
  { daysBack: 8, hour: 14, amount: 38.00, merchant: "Kartódromo do Porto", emotionName: "Excited", categoryName: "Entertainment" },
  { daysBack: 8, hour: 17, amount: 19.00, merchant: "Happy Sushi", emotionName: "Happy", categoryName: "Food & Drink" },

  // Weekend 3
  { daysBack: 16, hour: 13, amount: 40.00, merchant: "Concerto NOS Alive", emotionName: "Excited", categoryName: "Entertainment", note: "Festival day pass" },
  { daysBack: 16, hour: 15, amount: 18.00, merchant: "Festival Bar", emotionName: "Excited", categoryName: "Food & Drink" },
  { daysBack: 15, hour: 12, amount: 65.00, merchant: "Porto Tours Boat", emotionName: "Excited", categoryName: "Entertainment", note: "Douro river tour with cousins" },
  { daysBack: 15, hour: 16, amount: 22.00, merchant: "Pastéis de Belém", emotionName: "Happy", categoryName: "Food & Drink", note: "Tourist mode, very happy" },

  // Weekend 4
  { daysBack: 23, hour: 14, amount: 30.00, merchant: "Mini-Golfe", emotionName: "Happy", categoryName: "Entertainment" },
  { daysBack: 23, hour: 17, amount: 14.00, merchant: "Gelataria Portuense", emotionName: "Happy", categoryName: "Food & Drink" },
  { daysBack: 22, hour: 13, amount: 48.00, merchant: "Stand-Up Comedy Porto", emotionName: "Excited", categoryName: "Entertainment" },

  // ── Weekday (low-key, planned) ─────────────────────────────────────────────
  { daysBack: 3, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },
  { daysBack: 4, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },
  { daysBack: 5, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Calm", categoryName: "Transport" },
  { daysBack: 10, hour: 8, amount: 1.30, merchant: "Metro Porto", emotionName: "Happy", categoryName: "Transport" },
  { daysBack: 3, hour: 12, amount: 9.00, merchant: "Taberna do Porto", emotionName: "Happy", categoryName: "Food & Drink", note: "Lunch break" },
  { daysBack: 4, hour: 12, amount: 8.50, merchant: "Frangasqueira", emotionName: "Happy", categoryName: "Food & Drink" },
  { daysBack: 5, hour: 12, amount: 10.00, merchant: "Pizza à fatia", emotionName: "Happy", categoryName: "Food & Drink" },
  { daysBack: 6, hour: 12, amount: 7.50, merchant: "Cantina FEUP", emotionName: "Calm", categoryName: "Food & Drink" },
  { daysBack: 11, hour: 12, amount: 9.50, merchant: "Taberna do Porto", emotionName: "Happy", categoryName: "Food & Drink" },

  // ── Subscription (low risk) ───────────────────────────────────────────────
  { daysBack: 5, hour: 10, amount: 9.99, merchant: "Spotify", emotionName: "Happy", categoryName: "Entertainment" },
  { daysBack: 12, hour: 10, amount: 14.99, merchant: "Disney+", emotionName: "Excited", categoryName: "Entertainment", note: "New season dropped" },
];

export async function seed_08_happy_excited_spender(): Promise<void> {
  const db = await getDb();

  const guard = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'FC Porto Bilhetes'`,
    [USER_ID]
  );
  if (guard && guard.count > 0) { console.log("[seed_08] already seeded, skipping"); return; }

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
         VALUES (?, ?, ?, ?, ?, 'EUR', ?, ?, 'cash', ?, ?)`,
        [txId, USER_ID, categoryId ?? null, emotionId ? logId : null, tx.amount, tx.merchant, tx.note ?? null, ts, ts]
      );
    }
  });
  console.log(`[seed_08] inserted ${TRANSACTIONS.length} transactions — Happy/Excited Spender`);
}
