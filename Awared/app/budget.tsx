import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";

export default function SetBudget() {
  const router = useRouter();
  const [budget, setBudget] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchBudget() {
      try {
        const db = await getDb();
        const userID = global.userID;
        
        const settings = await db.getFirstAsync<{ monthly_budget: number }>(
          `SELECT monthly_budget FROM user_settings WHERE user_id = ?`,
          [userID]
        );
        
        if (settings && settings.monthly_budget) {
          setBudget(settings.monthly_budget.toString());
        }
      } catch (error) {
        console.error("Failed to load budget:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBudget();
  }, []);

  const handleSave = async () => {
    let parsedBudget = 0;

    // Allow empty string to mean "remove budget limit"
    if (budget.trim() !== "") {
      parsedBudget = parseFloat(budget.replace(',', '.'));
      if (isNaN(parsedBudget) || parsedBudget < 0) {
        Alert.alert("Invalid Amount", "Please enter a valid positive number.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const db = await getDb();
      const userID = global.userID;

      // INSERT OR REPLACE safely updates the record or creates a new one if it doesn't exist
      await db.runAsync(
        `INSERT OR REPLACE INTO user_settings (user_id, monthly_budget) VALUES (?, ?)`,
        [userID, parsedBudget > 0 ? parsedBudget : null] // Save as NULL if they cleared the field
      );

      router.back();
    } catch (error) {
      console.error("Failed to save budget:", error);
      Alert.alert("Error", "Could not save your budget goal.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#9b72cf" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} disabled={isSaving}>
            <Ionicons name="close" size={24} color="#1a1a1a" />
          </Pressable>
          <Text style={styles.headerTitle}>Set Monthly Goal</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>
            Setting a monthly budget goal helps you stay on top of your spending habits and emotional purchases.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Monthly Budget (€)</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>€</Text>
              <TextInput
                style={styles.amountInput}
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#ccc"
                autoFocus
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <Pressable 
          style={[styles.saveButton, isSaving && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Goal</Text>
            </>
          )}
        </Pressable>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  centered: { justifyContent: "center", alignItems: "center" },
  content: { flex: 1, padding: 20, paddingTop: 60 },
  
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  iconButton: {
    padding: 8, backgroundColor: "#fff", borderRadius: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  headerTitle: { fontSize: 18, fontFamily: "RobotoSerif_700Bold", color: "#1a1a1a" },

  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 30,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
  },
  cardSubtitle: {
    fontSize: 14, fontFamily: "RobotoSerif_400Regular", color: "#666", 
    marginBottom: 24, lineHeight: 22,
  },
  inputGroup: {
    paddingBottom: 10,
  },
  label: {
    fontSize: 13, fontFamily: "RobotoSerif_500Medium", color: "#888",
    marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5,
  },
  amountContainer: {
    flexDirection: "row", alignItems: "center",
  },
  currencySymbol: {
    fontSize: 32, color: "#1a1a1a", fontFamily: "RobotoSerif_700Bold", marginRight: 8,
  },
  amountInput: {
    flex: 1, fontSize: 40, color: "#9b72cf", fontFamily: "RobotoSerif_700Bold", padding: 0, 
  },

  saveButton: {
    flexDirection: "row", backgroundColor: "#9b72cf", paddingVertical: 16, borderRadius: 16,
    alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#9b72cf", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontFamily: "RobotoSerif_700Bold" },
});