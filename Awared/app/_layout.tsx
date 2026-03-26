import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { runMigrations } from "../lib/database";
import React from "react";

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    runMigrations()
      .then(() => setDbReady(true))
      .catch((e) => console.error("[db] migration failed:", e));
  }, []);

  // Block rendering until DB is ready — usually <100ms
  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fdf3ff" }}>
        <ActivityIndicator color="#9b72cf" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor="#fdf3ff" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}