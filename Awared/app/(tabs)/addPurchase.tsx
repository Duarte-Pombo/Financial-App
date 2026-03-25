import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { styles } from "./addPurchaseStyles";
import React from "react";

type Feeling = "sad" | "stress" | "happy";

export default function AddPurchase() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [selectedFeelings, setSelectedFeelings] = useState<Feeling[]>([]);

  useFocusEffect(
    useCallback(() => {
      setAmount("");
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

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

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
          <Text style={styles.headerText}>Monday, 12 March</Text>
          <Text style={styles.headerTime}>9:30</Text>
        </View>

        {/* Amount */}
        <Text style={styles.label}>How much was it?</Text>
        <View style={styles.centeredSection}>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor="#ccc"
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