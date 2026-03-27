/**
 * seed_06_edge_cases.ts
 *
 * NOT a persona — a stress-test of the algorithm's edge cases.
 * Designed to break things, produce unexpected inputs, and validate guards.
 *
 * Edge cases covered:
 *  1. Single transaction only (no patterns possible)
 *  2. Transaction with no emotion logged (null emotion_log_id)
 *  3. Transaction with no category (null category_id)
 *  4. Transaction with neither emotion nor category
 *  5. Extremely large amount (€9999) — tests amountWeight ratio
 *  6. Amount of €0.01 — minimum valid spend
 *  7. All transactions on the SAME day (max frequency pressure)
 *  8. Exactly on the hour boundary (hour=20 → weight 1, hour=21 → weight 2, hour=23 → weight 3)
 *  9. Positive emotion at 3AM (high time risk, zero emotion risk)
 * 10. All transactions in "Bills" category (weight 0 — should NOT trigger category insight)
 * 11. Mixed emotions on the same purchase day (should not crash dominant-emotion logic)
 * 12. Transaction exactly 30 days ago (boundary of the 30-day query window)
 * 13. Transaction exactly 31 days ago (should be EXCLUDED from query)
 * 14. Duplicate merchant names (robustness)
 *
 * Expected insights:
 *  💸  Above-average flagged (€9999 dominates the average)
 *  No crash on null fields
 *  No false positives for Bills-only pattern
 *  Time boundary insights correctly triggered or suppressed
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
  categoryName: string | null;
  note?: string;
};

const TRANSACTIONS: TestTx[] = [
  // ── 1. Normal anchor (so "single tx" edge case is separate from guards) ───
  //    (Not included here — see seed_06b if you want a true single-tx test)

  // ── 2. No emotion logged ──────────────────────────────────────────────────
  { daysBack: 5, hour: 14, amount: 15.00, merchant: "Padaria Portuguesa", emotionName: null, categoryName: "Food & Drink", note: "No emotion tracked" },
  { daysBack: 8, hour: 10, amount: 22.00, merchant: "Pingo Doce", emotionName: null, categoryName: "Food & Drink" },

  // ── 3. No category ───────────────────────────────────────────────────────
  { daysBack: 4, hour: 15, amount: 8.00, merchant: "Feira do Mercado", emotionName: "Happy", categoryName: null, note: "Market stall, no category" },
  { daysBack: 7, hour: 11, amount: 3.50, merchant: "Vendedora na rua", emotionName: "Calm", categoryName: null },

  // ── 4. No emotion AND no category ────────────────────────────────────────
  { daysBack: 6, hour: 13, amount: 5.00, merchant: "Unknown", emotionName: null, categoryName: null, note: "Nothing logged" },

  // ── 5. Extremely large amount ─────────────────────────────────────────────
  { daysBack: 3, hour: 14, amount: 9999.00, merchant: "Concessionária Auto", emotionName: "Excited", categoryName: "Other", note: "Car downpayment — planned but massive" },

  // ── 6. Minimum amount ─────────────────────────────────────────────────────
  { daysBack: 2, hour: 9, amount: 0.01, merchant: "Vending Machine", emotionName: "Calm", categoryName: "Food & Drink", note: "1 cent edge case" },

  // ── 7. All on the same day — frequency pressure test ──────────────────────
  { daysBack: 1, hour: 9, minute: 0, amount: 3.50, merchant: "Café", emotionName: "Stress", categoryName: "Food & Drink" },
  { daysBack: 1, hour: 10, minute: 30, amount: 4.00, merchant: "Café", emotionName: "Stress", categoryName: "Food & Drink" },
  { daysBack: 1, hour: 12, amount: 11.00, merchant: "Cantina FEUP", emotionName: "Anxiety", categoryName: "Food & Drink" },
  { daysBack: 1, hour: 14, amount: 5.99, merchant: "App Store", emotionName: "Boredom", categoryName: "Entertainment" },
  { daysBack: 1, hour: 15, minute: 30, amount: 2.50, merchant: "Vending", emotionName: "Stress", categoryName: "Food & Drink" },
  // 5 purchases in one day → frequencyWeight = 2

  // ── 8a. Hour boundary: exactly 20h (weight = 1) ──────────────────────────
  { daysBack: 9, hour: 20, minute: 0, amount: 18.00, merchant: "Worten", emotionName: "Boredom", categoryName: "Shopping", note: "Hour=20 boundary: weight should be 1" },

  // ── 8b. Hour boundary: exactly 21h (weight = 2) ──────────────────────────
  { daysBack: 10, hour: 21, minute: 0, amount: 18.00, merchant: "Worten", emotionName: "Boredom", categoryName: "Shopping", note: "Hour=21 boundary: weight should be 2" },

  // ── 8c. Hour boundary: exactly 23h (weight = 3) ──────────────────────────
  { daysBack: 11, hour: 23, minute: 0, amount: 18.00, merchant: "Worten", emotionName: "Boredom", categoryName: "Shopping", note: "Hour=23 boundary: weight should be 3" },

  // ── 9. Positive emotion at 3AM ────────────────────────────────────────────
  { daysBack: 13, hour: 3, amount: 29.99, merchant: "Steam", emotionName: "Excited", categoryName: "Entertainment", note: "Excited at 3AM — low emotion risk but high time risk" },

  // ── 10. All Bills — category weight = 0 ──────────────────────────────────
  { daysBack: 12, hour: 11, amount: 45.00, merchant: "NOS Internet", emotionName: "Calm", categoryName: "Bills" },
  { daysBack: 12, hour: 12, amount: 120.00, merchant: "EDP Energia", emotionName: "Calm", categoryName: "Bills" },
  { daysBack: 12, hour: 10, amount: 35.00, merchant: "Seguro Saúde", emotionName: "Calm", categoryName: "Bills" },
  // Bills cluster: should NOT trigger "Shopping is top category" insight

  // ── 11. Mixed emotions on same day ────────────────────────────────────────
  { daysBack: 15, hour: 10, amount: 3.50, merchant: "Café", emotionName: "Happy", categoryName: "Food & Drink", note: "Happy in the morning" },
  { daysBack: 15, hour: 13, amount: 12.00, merchant: "Restaurante", emotionName: "Stress", categoryName: "Food & Drink", note: "Stressed by lunch" },
  { daysBack: 15, hour: 17, amount: 8.00, merchant: "Worten", emotionName: "Anger", categoryName: "Shopping", note: "Angry in the afternoon" },
  { daysBack: 15, hour: 20, amount: 5.00, merchant: "Café", emotionName: "Calm", categoryName: "Food & Drink", note: "Calmed down by evening" },

  // ── 12. Exactly 30 days ago (boundary — should be INCLUDED) ──────────────
  { daysBack: 30, hour: 12, amount: 20.00, merchant: "Pingo Doce", emotionName: "Calm", categoryName: "Food & Drink", note: "30-day boundary — included" },

  // ── 13. Exactly 31 days ago (boundary — should be EXCLUDED) ──────────────
  { daysBack: 31, hour: 12, amount: 50.00, merchant: "Amazon_EXCLUDED", emotionName: "Anger", categoryName: "Shopping", note: "31-day boundary — should NOT appear in insights" },

  // ── 14. Duplicate merchant names (robustness) ────────────────────────────
  { daysBack: 2, hour: 11, amount: 3.50, merchant: "Café", emotionName: "Happy", categoryName: "Food & Drink" },
  { daysBack: 3, hour: 12, amount: 4.00, merchant: "Café", emotionName: "Calm", categoryName: "Food & Drink" },
  { daysBack: 4, hour: 13, amount: 3.80, merchant: "Café", emotionName: "Stress", categoryName: "Food & Drink" },
];

export async function seed_06_edge_cases(): Promise<void> {
  const db = await getDb();

  const guard = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Amazon_EXCLUDED'`,
    [USER_ID]
  );
  if (guard && guard.count > 0) { console.log("[seed_06] already seeded, skipping"); return; }

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

  // Verification log
  const excluded = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Amazon_EXCLUDED'
     AND transacted_at >= datetime('now', '-30 days')`,
    [USER_ID]
  );
  console.log(`[seed_06] Amazon_EXCLUDED in 30-day window: ${excluded?.count} (should be 0)`);
  console.log(`[seed_06] inserted ${TRANSACTIONS.length} transactions — Edge Cases`);
}
