import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";
import { EmotionGlyph, emotionColor, hasEmotionGlyph } from "@/components/EmotionGlyph";
import { useTheme } from "@/context/ThemeContext";
import { ThemeColors } from "@/theme/theme";

export default function EditTransaction() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

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
        <ActivityIndicator size="large" color={C.purpleDeep} />
      </View>
    );
  }

  const hasAmount = !!amount && parseFloat(amount.replace(',', '.')) > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.chromeButton} disabled={isSaving}>
          <Ionicons name="close" size={20} color={C.inkSoft} />
        </Pressable>
        <Text style={styles.headerTitle}>edit expense</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Amount Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>{currency}</Text>
            <TextInput
              style={[styles.amountInput, !hasAmount && styles.amountInputEmpty]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={C.inkMute}
            />
          </View>
          <View style={styles.amountUnderline} />
        </View>

        {/* Merchant Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>merchant / item</Text>
          <TextInput
            style={styles.textInput}
            value={merchant}
            onChangeText={setMerchant}
            placeholder="e.g. Nespresso Bar"
            placeholderTextColor={C.inkMute}
          />
          <View style={styles.underline} />
        </View>

        {/* Location Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>location</Text>
          <TextInput
            style={styles.textInput}
            value={location}
            onChangeText={setLocation}
            placeholder="city, store branch, etc."
            placeholderTextColor={C.inkMute}
          />
          <View style={styles.underline} />
        </View>

        {/* Emotion Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>how did this make you feel?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emotionScroll}
          >
            {availableEmotions.map((emo) => {
              const isSelected = selectedEmotionId === emo.id;
              const lower = (emo.name || "").toLowerCase();
              const color = emotionColor(lower, emo.color_hex || C.purple);
              const showGlyph = hasEmotionGlyph(lower);
              return (
                <Pressable
                  key={emo.id}
                  style={[
                    styles.emotionPill,
                    { borderColor: isSelected ? color : C.rule },
                    isSelected && { backgroundColor: color + "1F" },
                  ]}
                  onPress={() => setSelectedEmotionId(emo.id)}
                >
                  {showGlyph ? (
                    <EmotionGlyph emotion={lower} color={isSelected ? color : C.inkMute} size={17} />
                  ) : (
                    <Text style={styles.emotionEmoji}>{emo.emoji}</Text>
                  )}
                  <Text style={[styles.emotionName, { color: isSelected ? color : C.inkSoft }]}>
                    {emo.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Notes Field */}
        <View style={[styles.inputGroup, { borderBottomWidth: 0 }]}>
          <Text style={styles.label}>notes</Text>
          <TextInput
            style={styles.textArea}
            value={note}
            onChangeText={setNote}
            placeholder="add any extra details here…"
            placeholderTextColor={C.inkMute}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveWrap}>
        <Pressable
          style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FAF6EF" />
          ) : (
            <Text style={styles.saveButtonText}>save changes</Text>
          )}
        </Pressable>
      </View>

    </KeyboardAvoidingView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 24,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  chromeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 23,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    color: C.ink,
    letterSpacing: -0.3,
  },

  // Form
  inputGroup: {
    marginTop: 22,
  },
  label: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: C.inkSoft,
    marginBottom: 8,
  },

  // Amount specific
  amountContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  currencySymbol: {
    fontSize: 30,
    color: C.ink,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 46,
    color: C.purpleDeep,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    padding: 0,
  },
  amountInputEmpty: {
    color: C.inkMute,
  },
  amountUnderline: {
    height: 1.5,
    backgroundColor: C.ink,
    marginTop: 8,
  },

  // Text Inputs
  textInput: {
    fontSize: 15,
    fontFamily: "Manrope_400Regular",
    color: C.ink,
    paddingVertical: 4,
    paddingBottom: 8,
  },
  underline: {
    height: 1,
    backgroundColor: C.rule,
  },
  textArea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope_400Regular",
    color: C.ink,
  },

  // --- Emotion Styles ---
  emotionScroll: {
    gap: 8,
    paddingBottom: 4,
    paddingRight: 12,
  },
  emotionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 7,
    paddingLeft: 9,
    paddingRight: 13,
    borderRadius: 999,
    borderWidth: 1,
  },
  emotionEmoji: {
    fontSize: 17,
  },
  emotionName: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    textTransform: "capitalize",
  },

  // Save Button
  saveWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    backgroundColor: C.bg,
  },
  saveButton: {
    backgroundColor: C.blackBtn,
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FAF6EF",
    fontSize: 13,
    fontFamily: "Manrope_600SemiBold",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
