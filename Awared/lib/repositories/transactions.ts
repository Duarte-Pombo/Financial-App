import { getDb } from "../database";
import uuid from "react-native-uuid";

export type Transaction = {
  id: string;
  user_id: string;
  category_id?: number | null;
  emotion_log_id?: string | null;
  amount: number;
  currency_code: string;
  merchant_name?: string | null;
  note?: string | null;
  type: "debit" | "cash" | "bank transfer" | "credit";
  is_impulse?: 0 | 1;
  transacted_at: string;
  created_at?: string;
};

export async function addTransaction(transaction: Omit<Transaction, "id">) {
  const db = await getDb();
  const id = uuid.v4().toString();

  await db.runAsync(
    `INSERT INTO transactions
      (id, user_id, category_id, emotion_log_id, amount, currency_code, merchant_name, note, type, is_impulse, transacted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      transaction.user_id,
      transaction.category_id ?? null,
      transaction.emotion_log_id ?? null,
      transaction.amount,
      transaction.currency_code,
      transaction.merchant_name ?? null,
      transaction.note ?? null,
      transaction.type,
      transaction.is_impulse ?? 0,
      transaction.transacted_at,
    ]
  );

  return id;
}