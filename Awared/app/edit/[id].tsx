import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text } from "@/components/Text";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getDb } from "@/database/db";
import { colors, fonts, radii, spacing, elevation } from "@/constants/theme";

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
  const [currency, setCurrency] = useState("EUR");

  // Emotion States
  const [availableEmotions, setAvailableEmotions] = useState<any[]>([]);
  const [selectedEmotionId, setSelectedEmotionId] = useState<number | null>(null);
  const [emotionLogId, setEmotionLogId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTransactionData() {
      try {
        const db = await getDb();

        const emotions = await db.getAllAsync(`SELECT * FROM emotions`);
        setAvailableEmotions(emotions);

        const tx = await db.getFirstAsync<any>(
          `SELECT * FROM transactions WHERE id = ?`,
          [id]
        );

        if (tx) {
          setAmount(tx.amount ? tx.amount.toString() : "");
          setMerchant(tx.merchant_name || "");
          setLocation(tx.location || "");
          setNote(tx.note || "");
          setCurrency(tx.currency_code || "EUR");
          setEmotionLogId(tx.emotion_log_id);

          if (tx.emotion_log_id) {
            const log = await db.getFirstAsync<any>(
              `SELECT emotion_id FROM emotion_logs WHERE id = ?`,
              [tx.emotion_log_id]
            );
            if (log) setSelectedEmotionId(log.emotion_id);
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
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid number greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDb();

      await db.runAsync(
        `UPDATE transactions
         SET amount = ?, merchant_name = ?, location = ?, note = ?
         WHERE id = ?`,
        [parsedAmount, merchant, location, note, id]
      );

      if (selectedEmotionId) {
        if (emotionLogId) {
          await db.runAsync(
            `UPDATE emotion_logs SET emotion_id = ? WHERE id = ?`,
            [selectedEmotionId, emotionLogId]
          );
        } else {
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} disabled={isSaving}>
            <Ionicons name="close" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit expense</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Form */}
        <View style={styles.card}>
          {/* Amount Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount ({currency === "EUR" ? "€" : currency})</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>{currency === "EUR" ? "€" : currency}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.outlineVariant}
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
              placeholderTextColor={colors.outline}
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
              placeholderTextColor={colors.outline}
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
                      isSelected && { backgroundColor: emo.color_hex || colors.surfaceContainerHighest },
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
              placeholderTextColor={colors.outline}
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
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
              <Text style={styles.saveButtonText}>Save changes</Text>
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
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: spacing.gutter,
    paddingTop: 60,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  iconButton: {
    width: 40, height: 40,
    backgroundColor: colors.surface,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...elevation.card,
  },
  inputGroup: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.outline,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    fontSize: 30,
    color: colors.outline,
    fontFamily: fonts.medium,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 38,
    color: colors.primary,
    fontFamily: fonts.bold,
    letterSpacing: -1,
    padding: 0,
  },

  textInput: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    borderRadius: radii.lg,
  },
  textArea: {
    minHeight: 100,
  },

  emotionScroll: {
    gap: 12,
    paddingRight: 20,
  },
  emotionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  emotionPillSelected: {
    borderColor: colors.primary,
    ...elevation.card,
  },
  emotionEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  emotionName: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.onSurfaceVariant,
  },
  emotionNameSelected: {
    color: colors.onSurface,
    fontFamily: fonts.bold,
  },

  saveButton: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...elevation.raised,
  },
  saveButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontFamily: fonts.bold,
    letterSpacing: 0.2,
  },
});
