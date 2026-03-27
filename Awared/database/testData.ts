/**
 * seedInsightsTestData.ts
 *
 * Populates the database with ~30 days of realistic transactions, emotion logs,
 * and spending patterns specifically designed to exercise the insights algorithm.
 *
 * Patterns included:
 *  - Late-night impulse purchases (anxiety + Shopping)
 *  - Stress-driven Food & Drink cluster on weekday mornings
 *  - Healthy, planned weekday transport + bills
 *  - A "binge day" with 5 purchases on one day (high frequency score)
 *  - Several high-amount, emotionally-charged outliers
 *  - Positive, calm-state purchases for reinforcement insights
 *
 * Usage: call this from your app's startup (e.g. after seedDatabase()):
 *
 *   import { seedInsightsTestData } from "./seedInsightsTestData";
 *   await seedDatabase();
 *   await seedInsightsTestData();
 */

import { getDb } from "./db";
import { randomUUID } from "expo-crypto";

const USER_ID = "local-user";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number, hour = 12, minute = 0): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	d.setHours(hour, minute, 0, 0);
	return d.toISOString();
}

async function ensureUser(db: Awaited<ReturnType<typeof getDb>>) {
	await db.runAsync(
		`INSERT OR IGNORE INTO users (id, email, username, password_hash)
     VALUES (?, ?, ?, ?)`,
		[USER_ID, "local@app.com", "local_user", "no-auth"]
	);
}

// ─── Test transactions definition ────────────────────────────────────────────
//
// Fields:
//   daysBack   — how many days ago (integer)
//   hour       — hour of day (for time-of-day score)
//   amount     — EUR
//   merchant   — display name
//   emotionId  — maps to the emotion inserted by seedDatabase()
//               1=Sadness 2=Stress 3=Happy 4=Anxiety 5=Boredom 6=Excited 7=Calm 8=Anger
//   categoryId — maps to spending_categories inserted by seedDatabase()
//               1=Food&Drink 2=Transport 3=Shopping 4=Entertainment 5=Health 6=Bills 7=Education 8=Other
//   note       — optional

type TestTx = {
	daysBack: number;
	hour: number;
	minute?: number;
	amount: number;
	merchant: string;
	emotionId: number;
	categoryId: number;
	note?: string;
};

const TEST_TRANSACTIONS: TestTx[] = [
	// ── Healthy / planned purchases ──────────────────────────────────────────
	{ daysBack: 1, hour: 8, amount: 1.30, merchant: "Metro", emotionId: 7, categoryId: 2, note: "Morning commute" },
	{ daysBack: 2, hour: 9, amount: 1.30, merchant: "Metro", emotionId: 7, categoryId: 2 },
	{ daysBack: 3, hour: 8, amount: 1.30, merchant: "Metro", emotionId: 3, categoryId: 2 },
	{ daysBack: 5, hour: 10, amount: 25.00, merchant: "Pingo Doce", emotionId: 3, categoryId: 1, note: "Weekly groceries" },
	{ daysBack: 7, hour: 11, amount: 28.50, merchant: "Continente", emotionId: 7, categoryId: 1, note: "Groceries" },
	{ daysBack: 10, hour: 10, amount: 350.00, merchant: "EDP", emotionId: 7, categoryId: 6, note: "Electricity bill — planned" },
	{ daysBack: 14, hour: 9, amount: 9.99, merchant: "Spotify", emotionId: 3, categoryId: 4, note: "Monthly subscription" },
	{ daysBack: 20, hour: 14, amount: 18.00, merchant: "Farmácia Bem-Estar", emotionId: 7, categoryId: 5, note: "Vitamins" },
	{ daysBack: 22, hour: 10, amount: 12.50, merchant: "FNAC", emotionId: 6, categoryId: 7, note: "Study book" },

	// ── Stress-driven Food & Drink cluster (weekday mornings) ────────────────
	{ daysBack: 1, hour: 8, minute: 45, amount: 3.50, merchant: "Pastelaria Central", emotionId: 2, categoryId: 1, note: "Needed something before the meeting" },
	{ daysBack: 2, hour: 7, minute: 50, amount: 2.80, merchant: "Starbucks FEUP", emotionId: 4, categoryId: 1, note: "Couldn't sleep" },
	{ daysBack: 3, hour: 8, minute: 20, amount: 4.20, merchant: "Pastelaria Central", emotionId: 2, categoryId: 1 },
	{ daysBack: 6, hour: 8, minute: 10, amount: 3.90, merchant: "Delta Q", emotionId: 2, categoryId: 1, note: "Stressed before exam" },
	{ daysBack: 9, hour: 7, minute: 55, amount: 2.50, merchant: "Bom Dia Café", emotionId: 4, categoryId: 1 },

	// ── Late-night impulse Shopping ──────────────────────────────────────────
	{ daysBack: 2, hour: 23, amount: 34.00, merchant: "Zara Online", emotionId: 4, categoryId: 3, note: "Couldn't sleep, just kept scrolling" },
	{ daysBack: 5, hour: 22, minute: 30, amount: 18.50, merchant: "ASOS", emotionId: 2, categoryId: 3 },
	{ daysBack: 8, hour: 23, minute: 45, amount: 55.00, merchant: "Amazon", emotionId: 1, categoryId: 3, note: "Felt sad, bought stuff I didn't need" },
	{ daysBack: 12, hour: 0, minute: 10, amount: 29.99, merchant: "Amazon", emotionId: 8, categoryId: 3 },
	{ daysBack: 18, hour: 22, amount: 14.00, merchant: "Shein", emotionId: 5, categoryId: 3 },

	// ── Binge day: 5 purchases in one day (high frequency) ───────────────────
	{ daysBack: 4, hour: 10, amount: 3.50, merchant: "Nespresso", emotionId: 4, categoryId: 1, note: "Already anxious today" },
	{ daysBack: 4, hour: 12, amount: 11.00, merchant: "Taberna do Porto", emotionId: 4, categoryId: 1 },
	{ daysBack: 4, hour: 15, amount: 7.80, merchant: "Worten", emotionId: 2, categoryId: 3, note: "Just wandering the mall" },
	{ daysBack: 4, hour: 18, amount: 24.00, merchant: "H&M", emotionId: 2, categoryId: 3 },
	{ daysBack: 4, hour: 20, minute: 30, amount: 9.99, merchant: "Steam", emotionId: 5, categoryId: 4, note: "Bored after everything else" },

	// ── High-amount emotionally-charged outliers ──────────────────────────────
	{ daysBack: 3, hour: 21, amount: 89.00, merchant: "El Corte Inglés", emotionId: 2, categoryId: 3, note: "Retail therapy after a horrible day" },
	{ daysBack: 11, hour: 19, amount: 120.00, merchant: "Nike Store", emotionId: 4, categoryId: 3, note: "Felt like I deserved it" },

	// ── Calm, positive weekend leisure ───────────────────────────────────────
	{ daysBack: 6, hour: 14, amount: 22.00, merchant: "Cinema NOS", emotionId: 6, categoryId: 4, note: "Fun afternoon with friends" },
	{ daysBack: 13, hour: 13, amount: 15.50, merchant: "Tasca da Esquina", emotionId: 3, categoryId: 1, note: "Nice lunch" },
	{ daysBack: 20, hour: 11, amount: 8.00, merchant: "Museu do Porto", emotionId: 6, categoryId: 4 },
];

// ─── Main seed function ───────────────────────────────────────────────────────

export async function seedInsightsTestData(): Promise<void> {
	const db = await getDb();

	// Guard: skip if we already seeded test data (check for a sentinel merchant)
	const existing = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND merchant_name = 'Zara Online'`,
		[USER_ID]
	);
	if (existing && existing.count > 0) {
		console.log("[seedInsightsTestData] already seeded, skipping");
		return;
	}

	await ensureUser(db);

	// We need the actual IDs of emotions and categories from the DB
	// (they're autoincrement, so we look them up by name)
	const emotions = await db.getAllAsync<{ id: number; name: string }>(
		"SELECT id, name FROM emotions"
	);
	const categories = await db.getAllAsync<{ id: number; name: string }>(
		"SELECT id, name FROM spending_categories"
	);

	// Build name→id maps
	const emotionMap: Record<number, number> = {}; // seedIndex→real db id
	const emotionByOrder = [
		"Sadness", "Stress", "Happy", "Anxiety",
		"Boredom", "Excited", "Calm", "Anger",
	];
	for (let i = 0; i < emotionByOrder.length; i++) {
		const found = emotions.find((e) => e.name === emotionByOrder[i]);
		if (found) emotionMap[i + 1] = found.id;
	}

	const categoryByOrder = [
		"Food & Drink", "Transport", "Shopping", "Entertainment",
		"Health", "Bills", "Education", "Other",
	];
	const categoryMap: Record<number, number> = {};
	for (let i = 0; i < categoryByOrder.length; i++) {
		const found = categories.find((c) => c.name === categoryByOrder[i]);
		if (found) categoryMap[i + 1] = found.id;
	}

	await db.withTransactionAsync(async () => {
		for (const tx of TEST_TRANSACTIONS) {
			const txId = randomUUID();
			const logId = randomUUID();
			const timestamp = daysAgo(tx.daysBack, tx.hour, tx.minute ?? 0);

			const realEmotionId = emotionMap[tx.emotionId];
			const realCategoryId = categoryMap[tx.categoryId];

			// Insert emotion log
			if (realEmotionId) {
				await db.runAsync(
					`INSERT INTO emotion_logs (id, user_id, emotion_id, intensity, source, logged_at, created_at)
           VALUES (?, ?, ?, 6, 'manual', ?, ?)`,
					[logId, USER_ID, realEmotionId, timestamp, timestamp]
				);
			}

			// Insert transaction
			await db.runAsync(
				`INSERT INTO transactions
           (id, user_id, category_id, emotion_log_id, amount, currency_code, merchant_name, note, type, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'EUR', ?, ?, 'cash', ?, ?)`,
				[
					txId,
					USER_ID,
					realCategoryId ?? null,
					realEmotionId ? logId : null,
					tx.amount,
					tx.merchant,
					tx.note ?? null,
					timestamp,
					timestamp,
				]
			);
		}
	});

	console.log(`[seedInsightsTestData] inserted ${TEST_TRANSACTIONS.length} test transactions`);
}
