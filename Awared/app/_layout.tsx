import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import React from "react";
import {
  useFonts,
  RobotoSerif_400Regular,
  RobotoSerif_500Medium,
  RobotoSerif_600SemiBold,
  RobotoSerif_700Bold,
} from "@expo-google-fonts/roboto-serif";

import { getDb } from "../database/db";
import { seedDatabase } from "../database/seed";

const DEV_RESET = true; // COMMENT AFTER TESTING

// ┌─────┬──────────────────────────────────────────────────────────────────────┐
// │  #  │ Persona / Purpose                                                    │
// ├─────┼──────────────────────────────────────────────────────────────────────┤
// │  01 │ Mindful Spender — healthy, low-risk, positive reinforcement          │
// │  02 │ Stress Shopper — anxiety/stress → Shopping, late evenings            │
// │  03 │ Boredom Binger — frequent small purchases, mid impulse risk          │
// │  04 │ Night Owl — almost all purchases after 21h, max time risk            │
// │  05 │ Recovering Spender — bad history + recent improvement                │
// │  06 │ Edge Cases — nulls, €0.01, €9999, 31-day boundary, duplicates       │
// │  07 │ Anger Spender — max emotion weight, large amounts, high-risk zone    │
// │  08 │ Happy/Excited Spender — positive emotion but category/amount risk    │
// └─────┴──────────────────────────────────────────────────────────────────────┘

import { seed_01_mindful_spender } from "../database/test_seeds/seed_01_mindful_spender";
import { seed_02_stress_shopper } from "../database/test_seeds/seed_02_stress_shopper";
import { seed_03_boredom_binger } from "../database/test_seeds/seed_03_boredom_binger";
import { seed_04_night_owl } from "../database/test_seeds/seed_04_night_owl";
import { seed_05_recovering_spender } from "../database/test_seeds/seed_05_recovering_spender";
import { seed_06_edge_cases } from "../database/test_seeds/seed_06_edge_cases";
import { seed_07_anger_spender } from "../database/test_seeds/seed_07_anger_spender";
import { seed_08_happy_excited_spender } from "../database/test_seeds/seed_08_happy_excited_spender";

// const activeSeed: (() => Promise<void>) | null = null;

// ─── Wipes all user-generated data, leaving table structure intact ────────────
async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM journal_entries;");
    await db.execAsync("DELETE FROM budgets;");
    await db.execAsync("DELETE FROM transactions;");
    await db.execAsync("DELETE FROM emotion_logs;");
    await db.execAsync("DELETE FROM spending_categories;");
    await db.execAsync("DELETE FROM emotions;");
    await db.execAsync("DELETE FROM users;");
  });
  console.log("[dev] database wiped");
}

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
      try {
        await getDb(); // ensures tables exist

        if (DEV_RESET) {
          await resetDatabase();
        }

        await seedDatabase(); // always runs
        await seed_01_mindful_spender();
        await seed_02_stress_shopper();
        await seed_03_boredom_binger();
        await seed_04_night_owl();
        await seed_05_recovering_spender();
        await seed_06_edge_cases();
        await seed_07_anger_spender();
        await seed_08_happy_excited_spender();
        setReady(true);
      } catch (e) {
        console.error("[layout] init error:", e);
      }
    }
    init();
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fdf3ff" }}>
        <ActivityIndicator color="#9b72cf" size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor="#fdf3ff" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="monthlyHeatmap" options={{ headerShown: false, animation: "slide_from_right" }} />
      </Stack>
    </>
  );
}
