import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";

export default function EditTransaction() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form States
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState("€");

  // Emotion States
  const [availableEmotions, setAvailableEmotions] = useState<any[]>([]);
  const [selectedEmotionId, setSelectedEmotionId] = useState<number | null>(null);
  const [emotionLogId, setEmotionLogId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTransactionData() {
      try {
        const db = await getDb();
        
        // 1. Fetch all available emotions for the picker
        const emotions = await db.getAllAsync(`SELECT * FROM emotions`);
        setAvailableEmotions(emotions);

        // 2. Fetch the transaction details
        const tx = await db.getFirstAsync<any>(
          `SELECT * FROM transactions WHERE id = ?`,
          [id]
        );

        if (tx) {
          setAmount(tx.amount ? tx.amount.toString() : "");
          setMerchant(tx.merchant_name || "");
          setLocation(tx.location || "");
          setNote(tx.note || "");
          setEmotionLogId(tx.emotion_log_id);

          // 3. If the transaction has an emotion log, fetch its current emotion
          if (tx.emotion_log_id) {
            const log = await db.getFirstAsync<any>(
              `SELECT emotion_id FROM emotion_logs WHERE id = ?`,
              [tx.emotion_log_id]
            );
            if (log) setSelectedEmotionId(log.emotion_id);
          }
        }

        if (global.userID) {
           const user = await db.getFirstAsync<{ currency_code: string }>(
             `SELECT currency_code FROM users WHERE id = ?`,
             [global.userID]
           );
           if (user && user.currency_code) {
             setCurrency(user.currency_code);
           }
        }

      } catch (error) {
        console.error("Failed to load transaction for editing:", error);
        Alert.alert("Error", "Could not load transaction data.");
      } finally {
        setIsLoading(false);
      }
    }

    if (id) fetchTransactionData();
  }, [id]);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid number greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDb();
      
      // 1. Update the main transaction details
      await db.runAsync(
        `UPDATE transactions 
         SET amount = ?, merchant_name = ?, location = ?, note = ? 
         WHERE id = ?`,
        [parsedAmount, merchant, location, note, id]
      );

      // 2. Update the emotion log if an emotion is selected
      if (selectedEmotionId) {
        if (emotionLogId) {
          // Update existing log
          await db.runAsync(
            `UPDATE emotion_logs SET emotion_id = ? WHERE id = ?`,
            [selectedEmotionId, emotionLogId]
          );
        } else {
          // Edge case: if it didn't have an emotion log before, create one and link it
          const result = await db.runAsync(
            `INSERT INTO emotion_logs (emotion_id) VALUES (?)`,
            [selectedEmotionId]
          );
          await db.runAsync(
            `UPDATE transactions SET emotion_log_id = ? WHERE id = ?`,
            [result.lastInsertRowId, id]
          );
        }
      }

      router.back();
    } catch (error) {
      console.error("Failed to update transaction:", error);
      Alert.alert("Error", "Could not save your changes.");
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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} disabled={isSaving}>
            <Ionicons name="close" size={24} color="#1a1a1a" />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Expense</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Form */}
        <View style={styles.card}>
          
          {/* Amount Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount ({currency})</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>{currency}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#ccc"
              />
            </View>
          </View>

          {/* Merchant Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Merchant / Item</Text>
            <TextInput
              style={styles.textInput}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Where did you spend?"
              placeholderTextColor="#aaa"
            />
          </View>

          {/* Location Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.textInput}
              value={location}
              onChangeText={setLocation}
              placeholder="City, Store branch, etc."
              placeholderTextColor="#aaa"
            />
          </View>

          {/* Emotion Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>How did this make you feel?</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.emotionScroll}
            >
              {availableEmotions.map((emo) => {
                const isSelected = selectedEmotionId === emo.id;
                return (
                  <Pressable
                    key={emo.id}
                    style={[
                      styles.emotionPill,
                      isSelected && styles.emotionPillSelected,
                      isSelected && { backgroundColor: emo.color_hex || "#e0c8f8" }
                    ]}
                    onPress={() => setSelectedEmotionId(emo.id)}
                  >
                    <Text style={styles.emotionEmoji}>{emo.emoji}</Text>
                    <Text style={[styles.emotionName, isSelected && styles.emotionNameSelected]}>
                      {emo.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Notes Field */}
          <View style={[styles.inputGroup, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={note}
              onChangeText={setNote}
              placeholder="Add any extra details here..."
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
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
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf3ff",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  iconButton: {
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "RobotoSerif_700Bold",
    color: "#1a1a1a",
  },

  // Form Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  label: {
    fontSize: 13,
    fontFamily: "RobotoSerif_500Medium",
    color: "#888",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Amount specific
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 32,
    color: "#1a1a1a",
    fontFamily: "RobotoSerif_700Bold",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    color: "#9b72cf",
    fontFamily: "RobotoSerif_700Bold",
    padding: 0, 
  },

  // Text Inputs
  textInput: {
    fontSize: 16,
    fontFamily: "RobotoSerif_400Regular",
    color: "#333",
    backgroundColor: "#fdf3ff",
    padding: 14,
    borderRadius: 12,
  },
  textArea: {
    minHeight: 100,
  },

  // --- Emotion Styles ---
  emotionScroll: {
    gap: 12,
    paddingRight: 20,
  },
  emotionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fdf3ff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  emotionPillSelected: {
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  emotionEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  emotionName: {
    fontSize: 14,
    fontFamily: "RobotoSerif_500Medium",
    color: "#666",
  },
  emotionNameSelected: {
    color: "#1a1a1a",
    fontFamily: "RobotoSerif_700Bold",
  },

  // Save Button
  saveButton: {
    flexDirection: "row",
    backgroundColor: "#9b72cf",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#9b72cf",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "RobotoSerif_700Bold",
  },
});