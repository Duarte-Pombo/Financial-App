/**
 *
 * api/index.ts
 *
 * Base API configuration and typed fetch helper.
 * Reads EXPO_PUBLIC_API_URL from env (fallback to localhost).
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

/**
 * Centralised fetch wrapper.
 *  - Prepends the base URL
 *  - Sets JSON headers
 *  - Throws on non-2xx so call-sites can use try/catch
 */
export async function apiFetch<T = any>(
	path: string,
	options?: RequestInit
): Promise<T> {
	const url = `${API_BASE}${path}`;

	const res = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});

	if (!res.ok) {
		let message = `HTTP ${res.status}`;
		try {
			const body = await res.json();
			message = body.error || message;
		} catch {
			/* ignore parse errors */
		}
		throw new Error(message);
	}

	return res.json() as Promise<T>;
}
