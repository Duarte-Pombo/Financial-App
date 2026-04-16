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

import { AuthProvider } from "../context/AuthContext";
import { getDb } from "../database/db";
import { seedDatabase } from "../database/seed";

// Import seeds only if needed
import { seed_01_mindful_spender } from "../database/test_seeds/seed_01_mindful_spender";
import { seed_02_stress_shopper } from "../database/test_seeds/seed_02_stress_shopper";
import { seed_03_boredom_binger } from "../database/test_seeds/seed_03_boredom_binger";
import { seed_04_night_owl } from "../database/test_seeds/seed_04_night_owl";
import { seed_05_recovering_spender } from "../database/test_seeds/seed_05_recovering_spender";
import { seed_06_edge_cases } from "../database/test_seeds/seed_06_edge_cases";
import { seed_07_anger_spender } from "../database/test_seeds/seed_07_anger_spender";
import { seed_08_happy_excited_spender } from "../database/test_seeds/seed_08_happy_excited_spender";

const DEV_RESET = true; // Set to true only when you want to reset dev data
const RUN_TEST_SEEDS = true; // Set to true to insert sample users/data

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded] = useFonts({
    RobotoSerif_400Regular,
    RobotoSerif_500Medium,
    RobotoSerif_600SemiBold,
    RobotoSerif_700Bold,
  });

  useEffect(() => {
    async function init() {
      try {
        const db = await getDb(); // ensures tables exist

        if (DEV_RESET) {
          await db.execAsync("DELETE FROM users;"); // cascade deletes all user data
          console.log("[dev] database wiped");
        }

        await seedDatabase(); // seeds emotions and system categories

        if (RUN_TEST_SEEDS) {
          // These seeds create test users and data
          await seed_01_mindful_spender();
          await seed_02_stress_shopper();
          await seed_03_boredom_binger();
          await seed_04_night_owl();
          await seed_05_recovering_spender();
          await seed_06_edge_cases();
          await seed_07_anger_spender();
          await seed_08_happy_excited_spender();
        }

        setDbReady(true);
      } catch (e) {
        console.error("[layout] init error:", e);
      }
    }
    init();
  }, []);

  if (!dbReady || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fdf3ff" }}>
        <ActivityIndicator color="#9b72cf" size="large" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" backgroundColor="#fdf3ff" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="monthlyHeatmap" options={{ headerShown: false, animation: "slide_from_right" }} />
      </Stack>
    </AuthProvider>
  );
}
