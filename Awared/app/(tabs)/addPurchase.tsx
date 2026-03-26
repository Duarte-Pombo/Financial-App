import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { styles } from "./addPurchaseStyles";
import React from "react";

type Feeling = 
  "sad" 
  | "stress" 
  | "happy" 
  | "anxiety"
  | "joy"
  | "calm"
  | "tired"
  | "angry"
  | "bored"
  | "excited";

const defaultFeelings: Feeling[] = [
  "sad",
  "stress",
  "happy",
  "anxiety",
  "joy",
  "calm",
  "tired",
];

const extraFeelings: Feeling[] = [
  "angry",
  "bored",
  "excited",
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

const [showMoreFeelings, setShowMoreFeelings] = useState(false);

function getDateLabel(d: Date) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function getTimeLabel(d: Date) {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Formats raw digit string into "0.00" style — like a payment terminal
function formatAmount(digits: string): string {
  const padded = digits.padStart(3, "0");
  const cents = padded.slice(-2);
  const euros = padded.slice(0, -2).replace(/^0+/, "") || "0";
  return `${euros}.${cents}`;
}

export default function AddPurchase() {
  const router = useRouter();

  // Store only raw digits, e.g. "1050" → displays as "10.50"
  const [rawDigits, setRawDigits] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [selectedFeelings, setSelectedFeelings] = useState<Feeling[]>([]);

  // Live clock
  const [now, setNow] = useState(new Date());
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRawDigits("");
      setItem("");
      setLocation("");
      setNote("");
      setSelectedFeelings([]);
    }, [])
  );

  const toggleFeeling = (feeling: Feeling) => {
    setSelectedFeelings((prev) =>
      prev.includes(feeling)
        ? prev.filter((f) => f !== feeling)
        : [...prev, feeling]
    );
  };

  // Only accept digit keys, max 7 digits (99999.99)
  const handleAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 7);
    setRawDigits(digits);
  };

  const displayAmount = formatAmount(rawDigits);

  return (
    <View style={styles.container}>
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
            {/* Hidden real input captures keyboard */}
            <TextInput
              style={styles.amountInput}
              keyboardType="number-pad"
              value={displayAmount}
              onChangeText={handleAmountChange}
              placeholderTextColor="#ccc"
              caretHidden={true}
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
        <View style={styles.feelingsRow}>
          <Pressable style={styles.addFeelingBox}>
            <Ionicons name="add" size={18} color="#aaa" />
          </Pressable>
          <Pressable
            style={[styles.feelingBox, styles.feelingBoxBlue, selectedFeelings.includes("sad") && styles.selectedFeeling]}
            onPress={() => toggleFeeling("sad")}
          >
            <Text style={styles.feelingTextDark}>Sadness</Text>
          </Pressable>
          <Pressable
            style={[styles.feelingBox, styles.feelingBoxPurple, selectedFeelings.includes("stress") && styles.selectedFeeling]}
            onPress={() => toggleFeeling("stress")}
          >
            <Text style={styles.feelingTextLight}>Stress</Text>
          </Pressable>
          <Pressable
            style={[styles.feelingBox, styles.feelingBoxYellow, selectedFeelings.includes("happy") && styles.selectedFeeling]}
            onPress={() => toggleFeeling("happy")}
          >
            <Text style={styles.feelingTextYellow}>Happy</Text>
          </Pressable>
        </View>

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
    </View>
  );
}