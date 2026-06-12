/**
 * context/AuthContext.tsx
 *
 * Stores JWT token + userId in AsyncStorage so they survive app restarts.
 * Replace the global.userID pattern everywhere with useAuth().
 *
 * Usage:
 *   // Wrap your root layout (app/_layout.tsx):
 *   <AuthProvider>
 *     <Slot />
 *   </AuthProvider>
 *
 *   // In any screen:
 *   const { userId, token, login, logout } = useAuth();
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
	userId: string | null;
	token: string | null;
	username: string | null;
	currencyCode: string;
}

interface AuthContextValue extends AuthState {
	isLoading: boolean;
	/** Call after a successful /register or /login response */
	login: (payload: { userId: string; token: string; username: string; currency_code?: string }) => Promise<void>;
	logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "awared_auth";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = useState<AuthState>({
		userId: null,
		token: null,
		username: null,
		currencyCode: "EUR",
	});
	const [isLoading, setIsLoading] = useState(true);

	// Rehydrate from storage on mount
	useEffect(() => {
		AsyncStorage.getItem(STORAGE_KEY)
			.then((raw) => {
				if (raw) {
					const parsed = JSON.parse(raw) as AuthState;
					setState(parsed);
				}
			})
			.catch(console.error)
			.finally(() => setIsLoading(false));
	}, []);

	async function login(payload: {
		userId: string;
		token: string;
		username: string;
		currency_code?: string;
	}) {
		const next: AuthState = {
			userId: payload.userId,
			token: payload.token,
			username: payload.username,
			currencyCode: payload.currency_code ?? "EUR",
		};
		await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		setState(next);
	}

	async function logout() {
		await AsyncStorage.removeItem(STORAGE_KEY);
		setState({ userId: null, token: null, username: null, currencyCode: "EUR" });
	}

	return (
		<AuthContext.Provider value={{ ...state, isLoading, login, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
	return ctx;
}
