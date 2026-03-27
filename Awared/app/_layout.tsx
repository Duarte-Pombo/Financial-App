import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { getDb } from "../database/db";
import { seedDatabase } from "../database/seed";
import React from "react";
import {
  useFonts,
  RobotoSerif_400Regular,
  RobotoSerif_500Medium,
  RobotoSerif_600SemiBold,
  RobotoSerif_700Bold,
} from "@expo-google-fonts/roboto-serif";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    RobotoSerif_400Regular,
    RobotoSerif_500Medium,
    RobotoSerif_600SemiBold,
    RobotoSerif_700Bold,
  });

  useEffect(() => {
    async function init() {
      await getDb();        // creates tables
      await seedDatabase(); // inserts emotions + categories if empty
      setReady(true);
    }
    init().catch(console.error);
  }, []);

  if (!ready || !fontsLoaded) {
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