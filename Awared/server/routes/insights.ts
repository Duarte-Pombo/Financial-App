/**
 * routes/insights.ts
 *
 * POST /api/insights/analyze
 *
 * Accepts a JSON body of scored transactions + optional aggregate stats,
 * runs the PII mask, forwards to the local SLM, and returns structured insights.
 *
 * Designed to be mounted in your Express app:
 *   import insightsRouter from "./routes/insights";
 *   app.use("/api/insights", insightsRouter);
 */

import { Router, Request, Response, NextFunction } from "express";
import { maskTransactions, assertNoPII, RawTransactionPayload } from "../middleware/piiMask";
import { querySlm, SlmError } from "../services/slm";

const router = Router();

// ─── Request / Response shapes ────────────────────────────────────────────────

interface AnalyzeRequestBody {
	transactions: RawTransactionPayload[];
	/** Optional client-computed aggregates — used for richer prompts later */
	context?: {
		avgSpend?: number;
		periodDays?: number;
	};
}

interface AnalyzeSuccessResponse {
	ok: true;
	insights: Array<{
		type: "pattern" | "warning" | "tip" | "positive";
		title: string;
		body: string;
		actions: string[];
	}>;
	meta: {
		maskedCount: number;      // how many transactions were analysed
		modelLatencyMs: number;
	};
}

interface AnalyzeErrorResponse {
	ok: false;
	error: string;
	retryable: boolean;
}

// ─── Input validation ─────────────────────────────────────────────────────────

const RETRYABLE_CODES = new Set(["SLM_BUSY", "SLM_TIMEOUT", "SLM_UNREACHABLE"]);

function validateBody(body: unknown): body is AnalyzeRequestBody {
	if (!body || typeof body !== "object") return false;
	const b = body as Record<string, unknown>;
	if (!Array.isArray(b.transactions)) return false;
	if (b.transactions.length === 0) return false;
	if (b.transactions.length > 200) return false; // sanity cap
	return true;
}

// ─── Route handler ────────────────────────────────────────────────────────────

router.post(
	"/analyze",
	async (
		req: Request<object, object, AnalyzeRequestBody>,
		res: Response<AnalyzeSuccessResponse | AnalyzeErrorResponse>,
		next: NextFunction
	) => {
		// ── 1. Validate ──────────────────────────────────────────────────────────
		if (!validateBody(req.body)) {
			res.status(400).json({
				ok: false,
				error: "Invalid request: `transactions` must be a non-empty array (max 200).",
				retryable: false,
			});
			return;
		}

		const { transactions } = req.body;

		// ── 2. PII masking ───────────────────────────────────────────────────────
		const { masked } = maskTransactions(transactions);

		// In dev mode, run the PII leak assertion
		if (process.env.NODE_ENV !== "production") {
			try {
				assertNoPII(masked, transactions);
			} catch (err) {
				console.error("[pii-mask] VIOLATION:", (err as Error).message);
				// Hard-fail in dev so engineers catch this immediately
				res.status(500).json({
					ok: false,
					error: "Internal: PII masking validation failed.",
					retryable: false,
				});
				return;
			}
		}

		const maskedJson = JSON.stringify(masked, null, 0);

		// ── 3. Query SLM ─────────────────────────────────────────────────────────
		const t0 = Date.now();

		try {
			const slmResult = await querySlm(maskedJson);
			const latencyMs = Date.now() - t0;

			res.json({
				ok: true,
				insights: slmResult.insights,
				meta: {
					maskedCount: masked.length,
					modelLatencyMs: latencyMs,
				},
			});

		} catch (err) {
			const latencyMs = Date.now() - t0;

			if (err instanceof SlmError) {
				const retryable = RETRYABLE_CODES.has(err.code);
				const status = err.httpStatus === 504 ? 504 : retryable ? 503 : 502;

				console.warn(
					`[insights/analyze] SLM error code=${err.code} latency=${latencyMs}ms`
				);

				res.status(status).json({
					ok: false,
					error: err.code === "SLM_TIMEOUT"
						? "The analysis model is taking too long. Please try again in a moment."
						: err.code === "SLM_BUSY"
							? "The model is busy processing another request. Try again shortly."
							: "The insights model is currently unavailable.",
					retryable,
				});
				return;
			}

			// Unexpected error — let Express error middleware handle it
			next(err);
		}
	}
);

export default router;
