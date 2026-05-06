/**
 * slm.ts
 *
 * Thin client for a locally-running SLM via the Ollama REST API.
 *
 * Design goals:
 *  - Single responsibility: send prompt, return text.
 *  - Hard timeout so a slow model never blocks the request indefinitely.
 *  - Exponential backoff retry on transient failures (busy GPU, cold start).
 *  - All model config lives here — one place to change model / params.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const SLM_CONFIG = {
	baseUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
	model: process.env.OLLAMA_MODEL ?? "llama3.2:3b",   // swap to any local model
	timeoutMs: parseInt(process.env.SLM_TIMEOUT_MS ?? "18000", 10),  // 18 s hard cap
	maxRetries: parseInt(process.env.SLM_MAX_RETRIES ?? "2", 10),
	temperature: 0.3,   // low → deterministic, consistent tone
	maxTokens: 512,   // insights are short; cap prevents runaway generation
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlmInsight {
	title: string;
	body: string;
	type: "pattern" | "warning" | "tip" | "positive";
	actions: string[];
}

export interface SlmResponse {
	insights: SlmInsight[];
	rawText: string;   // preserved for logging / debugging
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** AbortController-based fetch with a hard deadline. */
async function fetchWithTimeout(
	url: string,
	options: RequestInit,
	timeoutMs: number
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...options, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

/** Sleep helper for retry back-off. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Parses the model's response.
 * The prompt instructs the model to return a JSON array; we try to parse it
 * and fall back to a single-insight wrapper if the model drifts from schema.
 */
function parseModelOutput(raw: string): SlmInsight[] {
	// Attempt 1: clean JSON array
	try {
		const trimmed = raw.trim();
		const jsonStart = trimmed.indexOf("[");
		const jsonEnd = trimmed.lastIndexOf("]");
		if (jsonStart !== -1 && jsonEnd !== -1) {
			const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
			if (Array.isArray(parsed)) return parsed as SlmInsight[];
		}
	} catch {/* fall through */ }

	// Attempt 2: treat entire output as a single narrative insight
	return [{
		type: "pattern",
		title: "Behavioral pattern detected",
		body: raw.slice(0, 400).trim(),
		actions: [],
	}];
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the system + user prompt.
 * Keeping the system prompt concise reduces token spend and
 * makes the model more likely to stay on-schema.
 */
function buildPrompt(maskedPayloadJson: string): { system: string; user: string } {
	const system = `\
You are a behavioural-finance analyst embedded in a personal finance app.
You receive anonymised spending data (no names, no dates, no identifying info).
Your job: identify 1-3 concise, human-grade insights about the user's emotional
spending patterns. Be empathetic and specific. Never shame.

RESPOND ONLY WITH a valid JSON array of insight objects. No markdown, no prose.
Each object must match this exact shape:
{
  "type": "pattern" | "warning" | "tip" | "positive",
  "title": "<short title, max 10 words>",
  "body": "<2-3 sentence insight, max 60 words>",
  "actions": ["<actionable suggestion>", ...]  // 1-2 items
}`;

	const user = `Analyse the following anonymised transactions and return insights:\n\n${maskedPayloadJson}`;

	return { system, user };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Sends the masked payload to the local Ollama instance.
 * Retries up to SLM_CONFIG.maxRetries times with exponential back-off.
 *
 * Throws SlmError (see below) on unrecoverable failure so the route handler
 * can return the appropriate HTTP status.
 */
export async function querySlm(maskedPayloadJson: string): Promise<SlmResponse> {
	const { system, user } = buildPrompt(maskedPayloadJson);

	const body = JSON.stringify({
		model: SLM_CONFIG.model,
		stream: false,
		options: {
			temperature: SLM_CONFIG.temperature,
			num_predict: SLM_CONFIG.maxTokens,
		},
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: user },
		],
	});

	let lastError: unknown;

	for (let attempt = 0; attempt <= SLM_CONFIG.maxRetries; attempt++) {
		if (attempt > 0) {
			// Exponential back-off: 1 s → 2 s → 4 s …
			await sleep(1000 * 2 ** (attempt - 1));
		}

		try {
			const res = await fetchWithTimeout(
				`${SLM_CONFIG.baseUrl}/api/chat`,
				{ method: "POST", headers: { "Content-Type": "application/json" }, body },
				SLM_CONFIG.timeoutMs
			);

			if (!res.ok) {
				// 503 → model busy; anything else → hard failure, no point retrying
				if (res.status === 503 && attempt < SLM_CONFIG.maxRetries) {
					lastError = new SlmError("SLM_BUSY", res.status);
					continue;
				}
				throw new SlmError(`Ollama returned HTTP ${res.status}`, res.status);
			}

			const json = await res.json() as { message?: { content?: string } };
			const rawText = json?.message?.content ?? "";

			return { insights: parseModelOutput(rawText), rawText };

		} catch (err) {
			if (err instanceof SlmError) throw err;

			// AbortError = timeout
			if ((err as Error).name === "AbortError") {
				lastError = new SlmError("SLM_TIMEOUT", 504);
				if (attempt < SLM_CONFIG.maxRetries) continue;
			} else {
				lastError = err;
				if (attempt < SLM_CONFIG.maxRetries) continue;
			}
		}
	}

	// All retries exhausted
	if (lastError instanceof SlmError) throw lastError;
	throw new SlmError("SLM_UNREACHABLE", 503);
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class SlmError extends Error {
	constructor(
		public readonly code: string,
		public readonly httpStatus: number
	) {
		super(code);
		this.name = "SlmError";
	}
}
