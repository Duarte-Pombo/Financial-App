/**
 * api/index.ts  —  DEBUG VERSION
 */
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

// ── DEBUG: verify what URL we're actually using ──
console.log("API_BASE resolved to:", API_BASE);
console.log("EXPO_PUBLIC_API_URL env:", process.env.EXPO_PUBLIC_API_URL);

export async function apiFetch<T = any>(
	path: string,
	options?: RequestInit
): Promise<T> {
	const url = `${API_BASE}${path}`;

	console.log(`[API REQ] ${options?.method || "GET"} ${url}`);
	if (options?.body) {
		console.log(`[API BODY]`, options.body);
	}

	try {
		const res = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
		});

		console.log(`[API RES] ${res.status} ${res.statusText} for ${url}`);

		if (!res.ok) {
			let message = `HTTP ${res.status}`;
			let bodyText = "";
			try {
				bodyText = await res.text(); // read as text first for debugging
				console.log(`[API ERR BODY]`, bodyText.slice(0, 500));
				const body = JSON.parse(bodyText);
				message = body.error || message;
			} catch {
				/* ignore parse errors */
			}
			throw new Error(message);
		}

		const data = await res.json();
		console.log(`[API DATA] keys:`, Object.keys(data).join(", "));
		return data as Promise<T>;
	} catch (err: any) {
		console.error(`[API FAIL] ${url} — ${err.message}`);
		throw err;
	}
}
