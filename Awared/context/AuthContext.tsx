import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, useSegments, useRootNavigationState } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDb } from "@/database/db";
import * as Crypto from "expo-crypto";

type User = {
	id: string;
	email: string;
	username: string;
};

type AuthContextType = {
	user: User | null;
	isLoading: boolean;
	login: (emailOrUsername: string, password: string) => Promise<boolean>;
	register: (email: string, username: string, password: string) => Promise<boolean>;
	logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const router = useRouter();
	const segments = useSegments();
	const rootNavigationState = useRootNavigationState();

	// Load stored session
	useEffect(() => {
		const loadUser = async () => {
			try {
				const storedUserId = await AsyncStorage.getItem("userId");
				if (storedUserId) {
					const db = await getDb();
					const result = await db.getFirstAsync<{ id: string; email: string; username: string }>(
						"SELECT id, email, username FROM users WHERE id = ?",
						[storedUserId]
					);
					if (result) {
						setUser(result);
					} else {
						await AsyncStorage.removeItem("userId");
					}
				}
			} catch (e) {
				console.error("Auth load error:", e);
			} finally {
				setIsLoading(false);
			}
		};
		loadUser();
	}, []);

	// Protect routes
	useEffect(() => {
		if (isLoading || !rootNavigationState?.key) return;

		const currentSegment = segments[0];

		const isAuthScreen = !currentSegment || currentSegment === "index" || currentSegment === "register";

		if (!user && !isAuthScreen) {
			router.replace("/");
		} else if (user && isAuthScreen) {
			router.replace("/(tabs)");
		}
	}, [user, segments, isLoading, rootNavigationState]);

	const login = async (emailOrUsername: string, password: string): Promise<boolean> => {
		try {
			const db = await getDb();
			const hash = await Crypto.digestStringAsync(
				Crypto.CryptoDigestAlgorithm.SHA256,
				password
			);
			const result = await db.getFirstAsync<{ id: string; email: string; username: string }>(
				"SELECT id, email, username FROM users WHERE (email = ? OR username = ?) AND password_hash = ?",
				[emailOrUsername, emailOrUsername, hash]
			);
			if (result) {
				setUser(result);
				await AsyncStorage.setItem("userId", result.id);
				return true;
			}
			return false;
		} catch (e) {
			console.error("Login error:", e);
			return false;
		}
	};

	const register = async (email: string, username: string, password: string): Promise<boolean> => {
		try {
			const db = await getDb();
			const id = Crypto.randomUUID();
			const hash = await Crypto.digestStringAsync(
				Crypto.CryptoDigestAlgorithm.SHA256,
				password
			);
			await db.runAsync(
				"INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)",
				[id, email, username, hash]
			);
			const newUser = { id, email, username };
			setUser(newUser);
			await AsyncStorage.setItem("userId", id);
			return true;
		} catch (e) {
			console.error("Register error:", e);
			return false;
		}
	};

	const logout = async () => {
		setUser(null);
		await AsyncStorage.removeItem("userId");
		router.replace("/");
	};

	return (
		<AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within AuthProvider");
	return context;
}
