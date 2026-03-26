import { getDb } from "./database";

export async function logAllTransactions() {
  try {
    const db = await getDb();
    const transactions = await db.getAllAsync("SELECT * FROM transactions;");
    console.log("Transactions:", transactions);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
  }
}