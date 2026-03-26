import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { styles } from "./addPurchaseStyles";
import { KeyboardAvoidingView, Platform } from "react-native";
import { getEmotions, type Emotion } from "../../lib/repositories/emotions";
import React from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function getDateLabel(d: Date) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function getTimeLabel(d: Date) {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Determine text color based on background luminance
function getTextColor(hex: string | null): string {
  if (!hex) return "#333";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#333" : "#f3f0ff";
}

export default function AddPurchase() {
  const router = useRouter();

  const [rawDigits, setRawDigits] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [selectedEmotionIds, setSelectedEmotionIds] = useState<number[]>([]);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [now, setNow] = useState(new Date());
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load emotions once
  useEffect(() => {
    getEmotions().then(setEmotions).catch(console.error);
  }, []);

  // Start clock
  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  // Reset form on focus
  useFocusEffect(
    useCallback(() => {
      setRawDigits("");
      setItem("");
      setLocation("");
      setNote("");
      setSelectedEmotionIds([]);
    }, [])
  );

  const toggleEmotion = (id: number) => {
    setSelectedEmotionIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleAmountChange = (text: string) => {
    setRawDigits(text.replace(/[^0-9.,]/g, ""));
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{flex:1}} behavior="height">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color="#555" />
          </Pressable>
          <Text style={styles.headerText}>{getDateLabel(now)}</Text>
          <Text style={styles.headerTime}>{getTimeLabel(now)}</Text>
        </View>

        {/* Amount */}
        <Text style={styles.label}>How much was it?</Text>
        <View style={styles.centeredSection}>
          <View style={styles.amountRow}>
            <TextInput
              style={[styles.amountInput, { color: "#000" }]}
              keyboardType="decimal-pad"
              value={rawDigits}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor="#999"
            />
            <Text style={styles.currencySymbol}>$</Text>
          </View>
          <View style={styles.amountUnderline} />
        </View>

        {/* Item */}
        <Text style={styles.label}>What did you buy?</Text>
        <View style={styles.centeredSection}>
          <TextInput
            style={styles.itemInput}
            value={item}
            onChangeText={setItem}
            placeholder="e.g. Coffee"
            placeholderTextColor="#ccc"
          />
        </View>

        {/* Feelings */}
        <Text style={styles.label}>How were you feeling?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.feelingsScroll}
          contentContainerStyle={styles.feelingsScrollContent}
        >
          {emotions.map((emotion) => {
            const isSelected = selectedEmotionIds.includes(emotion.id);
            return (
              <Pressable
                key={emotion.id}
                style={[
                  styles.feelingChip,
                  { backgroundColor: emotion.color_hex ?? "#e0d4ea" },
                  isSelected && styles.selectedFeeling,
                ]}
                onPress={() => toggleEmotion(emotion.id)}
              >
                {emotion.emoji && <Text style={styles.feelingEmoji}>{emotion.emoji}</Text>}
                <Text style={[styles.feelingChipText, { color: getTextColor(emotion.color_hex) }]}>
                  {emotion.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Location */}
        <Text style={styles.label}>Where were you?</Text>
        <View style={styles.locationInputRow}>
          <Ionicons name="search-outline" size={14} color="#999" />
          <TextInput
            style={styles.locationInput}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. FEUP"
            placeholderTextColor="#bbb"
          />
        </View>
        <View style={styles.autoDetectWrapper}>
          <Pressable style={styles.autoDetectBadge}>
            <Text style={styles.autoDetectText}>Auto-detect?</Text>
          </Pressable>
        </View>

        {/* Note */}
        <Text style={styles.label}>Do you want to add something?</Text>
        <TextInput
          style={styles.noteInput}
          multiline
          value={note}
          onChangeText={setNote}
          placeholder="e.g. I was stressed so I bought coffee..."
          placeholderTextColor="#bbb"
        />

        {/* Submit */}
        <Pressable style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
} 