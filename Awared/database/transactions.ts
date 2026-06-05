
/**
 * database/transactions.ts  —  API client (was local SQLite)
 *
 * All functions previously hitting expo-sqlite now call the Express REST API.
 * Function signatures and return types are preserved so UI components need
 * zero changes apart from import paths (if you moved this file).
 */

import { apiFetch } from "../api";

// ─── Types (unchanged) ────────────────────────────────────────────────────────

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
  location?: string;
  category_id?: number;
  emotion_ids?: number[];
  currency_code?: string;
  type?: "debit" | "cash" | "bank transfer" | "credit" | "refunded";
  transacted_at?: string;
};

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

export type HeatmapMonthData = Record<string, HeatmapDayData>;

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

// ─── Insert a transaction ─────────────────────────────────────────────────────

export async function insertTransaction(data: NewTransaction): Promise<string> {
  const result = await apiFetch<{ id: string }>("/api/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result.id;
}

// ─── Get recent transactions ──────────────────────────────────────────────────

export async function getTransactions(user_id: string): Promise<Transaction[]> {
  return apiFetch<Transaction[]>(
    `/api/transactions?user_id=${encodeURIComponent(user_id)}&limit=50`
  );
}

// ─── Get single transaction ───────────────────────────────────────────────────

export async function getTransactionById(id: string): Promise<Transaction | null> {
  try {
    return await apiFetch<Transaction>(`/api/transactions/${encodeURIComponent(id)}`);
  } catch (err: any) {
    if (err.message?.includes("404")) return null;
    throw err;
  }
}

// ─── Update transaction ───────────────────────────────────────────────────────

export async function updateTransaction(
  id: string,
  patch: Partial<Pick<Transaction, "amount" | "merchant_name" | "location" | "note" | "category_id" | "type" | "transacted_at">>
): Promise<void> {
  await apiFetch(`/api/transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ─── Delete transaction ───────────────────────────────────────────────────────

export async function deleteTransaction(id: string): Promise<void> {
  await apiFetch(`/api/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ─── Update transaction emotion ───────────────────────────────────────────────

export async function updateTransactionEmotion(
  id: string,
  emotion_id: number
): Promise<void> {
  await apiFetch(`/api/transactions/${encodeURIComponent(id)}/emotion`, {
    method: "PATCH",
    body: JSON.stringify({ emotion_id }),
  });
}

// ─── Get month data for heatmap ───────────────────────────────────────────────

export async function getMonthHeatmapData(
  user_id: string,
  year: number,
  month: number // 0-indexed
): Promise<HeatmapMonthData> {
  return apiFetch<HeatmapMonthData>(
    `/api/transactions/heatmap/month?user_id=${encodeURIComponent(user_id)}&year=${year}&month=${month}`
  );
}

// ─── Get week data for calendar weekly view ───────────────────────────────────

export async function getWeekHeatmapData(
  user_id: string,
  weekStart: Date // Monday
): Promise<WeekDayData[]> {
  return apiFetch<WeekDayData[]>(
    `/api/transactions/heatmap/week?user_id=${encodeURIComponent(user_id)}&weekStart=${encodeURIComponent(weekStart.toISOString())}`
  );
}
