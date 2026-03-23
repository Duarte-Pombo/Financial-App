import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
import { styles } from "./addPurchaseStyles";
import React from "react";

export default function AddPurchase() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);

  const handleSubmit = () => {
    // 👉 later: save to storage / DB here
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="arrow-back" size={24} />
          <Text style={styles.headerText}>Monday, 12 March</Text>
          <Text style={styles.headerTime}>9:30</Text>
        </View>

        {/* Amount */}
        <Text style={styles.label}>How much was it?</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="e.g. 8.50"
          placeholderTextColor="#999"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Item */}
        <Text style={styles.label}>What did you buy?</Text>
        <TextInput
          style={styles.itemInput}
          placeholder="e.g. coffee"
          placeholderTextColor="#999"
          value={item}
          onChangeText={setItem}
        />

        {/* Feelings */}
        <Text style={styles.label}>How were you feeling?</Text>
        <View style={styles.feelingsRow}>
          <Pressable
            style={[
              styles.feelingBox,
              selectedFeeling === "sad" && styles.selected,
            ]}
            onPress={() => setSelectedFeeling("sad")}
          >
            <Text>Sadness</Text>
          </Pressable>

          <Pressable
            style={[
              styles.feelingBoxPurple,
              selectedFeeling === "stress" && styles.selected,
            ]}
            onPress={() => setSelectedFeeling("stress")}
          >
            <Text style={{ color: "#fff" }}>Stress</Text>
          </Pressable>

          <Pressable
            style={[
              styles.feelingBoxYellow,
              selectedFeeling === "happy" && styles.selected,
            ]}
            onPress={() => setSelectedFeeling("happy")}
          >
            <Text>Happy</Text>
          </Pressable>
        </View>

        {/* Location */}
        <Text style={styles.label}>Where were you?</Text>
        <TextInput
          style={styles.locationInput}
          placeholder="e.g. FEUP"
          placeholderTextColor="#999"
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.autoDetect}>Auto-detect?</Text>

        {/* Notes */}
        <Text style={styles.label}>Do you want to add something?</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder="e.g. I was stressed so I bought coffee..."
          placeholderTextColor="#999"
          value={note}
          onChangeText={setNote}
        />

        {/* Button */}
        <Pressable style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}