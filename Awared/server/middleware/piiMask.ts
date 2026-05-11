/**
 * piiMask.ts
 *
 * Strips or replaces Personally Identifiable Information (PII) from a
 * transaction payload BEFORE it is forwarded to the local SLM.
 *
 * What counts as PII in this context:
 *  - merchant_name  → replaced with a stable per-category pseudonym
 *  - user_id        → removed entirely
 *  - transaction id → replaced with an opaque index
 *  - exact amounts  → rounded into spend bands so micro-amounts can't be
 *                     reverse-engineered into a specific purchase
 *  - timestamps     → reduced to hour-of-day + day-of-week (no date)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawTransactionPayload {
	id: string;
	user_id?: string;
	amount: number;
	merchant_name: string | null;
	transacted_at: string;          // ISO-8601
	category_name: string | null;
	category_icon: string | null;
	emotion_name: string | null;
	emotion_emoji: string | null;
	emotion_polarity: number | null; // -5 to 5
	emotion_energy: number | null;   // 1 to 10
	emotion_category: string | null; // 'positive' | 'negative' | 'neutral'
	impulseScore: number;
}

export interface MaskedTransaction {
	ref: string;                     // opaque reference, e.g. "tx_03"
	spendBand: string;               // "low" | "medium" | "high" | "very_high"
	merchantAlias: string;           // e.g. "Merchant-FoodDrink-A"
	hourOfDay: number;               // 0-23
	dayOfWeek: string;               // "Monday" etc.
	categoryName: string | null;
	emotionName: string | null;
	emotionPolarity: number | null;
	emotionEnergy: number | null;
	emotionCategory: string | null;
	impulseScore: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Assigns a spend band so the model reasons about relative magnitude
 * rather than exact EUR values.
 */
function toSpendBand(amount: number, avg: number): string {
	const ratio = amount / Math.max(avg, 1);
	if (ratio > 3) return "very_high";
	if (ratio > 1.5) return "high";
	if (ratio > 0.6) return "medium";
	return "low";
}

/**
 * Produces a stable, opaque alias for a merchant name.
 * The alias is deterministic (same merchant → same alias within one request)
 * but reveals no identifying information to the model.
 *
 * Format: "Merchant-<category>-<letter>"
 * e.g.    "Merchant-Shopping-B"
 */
function buildMerchantAliasMap(
	transactions: RawTransactionPayload[]
): Map<string, string> {
	const map = new Map<string, string>();
	const categoryCounters: Record<string, number> = {};

	for (const tx of transactions) {
		const key = tx.merchant_name ?? "__unknown__";
		if (map.has(key)) continue;

		const cat = (tx.category_name ?? "Other").replace(/\s+/g, "");
		categoryCounters[cat] = (categoryCounters[cat] ?? 0) + 1;
		const letter = String.fromCharCode(64 + categoryCounters[cat]); // A, B, C …
		map.set(key, `Merchant-${cat}-${letter}`);
	}

	return map;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Masks a list of raw transactions, returning a PII-free payload
 * safe to forward to the SLM.
 *
 * Also returns a `reverseMap` that maps opaque refs back to internal IDs
 * so the server can attach model output back to real transactions without
 * the model ever seeing real IDs.
 */
export function maskTransactions(transactions: RawTransactionPayload[]): {
	masked: MaskedTransaction[];
	reverseMap: Record<string, string>; // ref → original id
} {
	if (transactions.length === 0) return { masked: [], reverseMap: {} };

	const avgAmount =
		transactions.reduce((s, t) => s + t.amount, 0) / transactions.length;

	const merchantAliases = buildMerchantAliasMap(transactions);
	const reverseMap: Record<string, string> = {};

	const masked: MaskedTransaction[] = transactions.map((tx, i) => {
		const ref = `tx_${String(i + 1).padStart(2, "0")}`;
		reverseMap[ref] = tx.id;

		const d = new Date(tx.transacted_at);

		return {
			ref,
			spendBand: toSpendBand(tx.amount, avgAmount),
			merchantAlias: merchantAliases.get(tx.merchant_name ?? "__unknown__")!,
			hourOfDay: d.getHours(),
			dayOfWeek: DOW[d.getDay()],
			categoryName: tx.category_name,
			emotionName: tx.emotion_name,
			emotionPolarity: tx.emotion_polarity,
			emotionEnergy: tx.emotion_energy,
			emotionCategory: tx.emotion_category,
			impulseScore: tx.impulseScore,
		};
	});

	return { masked, reverseMap };
}

/**
 * Quick sanity check: asserts that none of the PII fields leak into the
 * serialised payload. Throws if a violation is found.
 * Call this in tests or during development.
 */
export function assertNoPII(
	masked: MaskedTransaction[],
	originalTransactions: RawTransactionPayload[]
): void {
	const piiStrings = new Set<string>(
		originalTransactions.flatMap((tx) => [
			tx.id,
			tx.user_id ?? "",
			tx.merchant_name ?? "",
			// ISO date portion (time portion is allowed via hourOfDay)
			tx.transacted_at.slice(0, 10),
		]).filter(Boolean)
	);

	const serialised = JSON.stringify(masked);
	for (const pii of piiStrings) {
		if (pii.length < 3) continue; // skip trivially short strings
		if (serialised.includes(pii)) {
			throw new Error(`PII leak detected in masked payload: "${pii}"`);
		}
	}
}
