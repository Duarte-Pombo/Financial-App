import { View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { styles } from "./addPurchaseStyles";
import { getDb } from "../../database/db";
import { insertTransaction } from "../../database/transactions";
import * as Location from "expo-location";
import { ActivityIndicator } from "react-native";
import React from "react";

type Emotion = {
  id: number;
  name: string;
  emoji: string | null;
  color_hex: string | null;
};

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

  const [detectingLocation, setDetectingLocation] = useState(false);
  const [rawDigits, setRawDigits] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [selectedEmotionIds, setSelectedEmotionIds] = useState<number[]>([]);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function handleAutoDetectLocation() {
    try {
      setDetectingLocation(true);

      // Ask permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission denied", "Allow location access to use this feature.");
        setDetectingLocation(false);
        return;
      }

      const lastLoc = await Location.getLastKnownPositionAsync();

      if (lastLoc) {
        const address = await Location.reverseGeocodeAsync({
          latitude: lastLoc.coords.latitude,
          longitude: lastLoc.coords.longitude,
        });

        if (address.length > 0) {
          const place = address[0];
          const formatted = [
            place.street,
            place.city,
          ].filter(Boolean).join(", ");

          setLocation(formatted);
        }
      }

      // Get current position
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, 
      });

      // Convert to readable address
      const address = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (address.length > 0) {
        const place = address[0];

        // Build a readable string
        const formatted = [
          place.street,
          place.name,
          place.city,
        ].filter(Boolean).join(", ");

        setLocation(formatted); 
      }

    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not get location.");
    } finally {
      setDetectingLocation(false);
    }
  }


  // Load emotions
  useEffect(() => {
    getDb()
      .then((db) => db.getAllAsync<Emotion>("SELECT id, name, emoji, color_hex FROM emotions ORDER BY name ASC;"))
      .then(setEmotions)
      .catch(console.error);
  }, []);

  // Live clock
  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  // Reset form on focus
  useFocusEffect(
    useCallback(() => {
      setRawDigits("");
      setItem("");
      setLocation("");
      setNote("");
      setSelectedEmotionIds([]);
      setSaving(false);
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

  const handleDone = async () => {
    const amount = parseFloat(rawDigits.replace(",", "."));

    if (!rawDigits || isNaN(amount) || amount <= 0) {
      Alert.alert("Missing amount", "Please enter how much you spent.");
      return;
    }

    if (!global.userID) {
      Alert.alert("Error", "User not logged in.");
      return;
    }

    setSaving(true);
    try {
      await insertTransaction({
        user_id: global.userID, 
        amount,
        merchant_name: item || undefined,
        note: note || undefined,
        location: location || undefined,
        emotion_ids: selectedEmotionIds,
        currency_code: "EUR",
        type: "cash",
      });

      router.back(); // ✅ cleaner than replace
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save the purchase.");
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={16} color="#555" />
            </Pressable>
            <Text style={styles.headerText}>{getDateLabel(now)}</Text>
            <Text style={styles.headerTime}>{getTimeLabel(now)}</Text>
          </View>

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
              <Text style={styles.currencySymbol}>€</Text>
            </View>
            <View style={styles.amountUnderline} />
          </View>

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
            <Pressable style={styles.autoDetectBadge} onPress={handleAutoDetectLocation}>
              {detectingLocation ? (
                <ActivityIndicator size="small" color="#2a7a2a" />
              ) : (
                <>
                  <Ionicons name="location-outline" size={12} color="#2a7a2a" />
                  <Text style={styles.autoDetectText}> Auto-detect</Text>
                </>
              )}
            </Pressable>
          </View>

          <Text style={styles.label}>Do you want to add something?</Text>
          <TextInput
            style={styles.noteInput}
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="e.g. I was stressed so I bought coffee..."
            placeholderTextColor="#bbb"
          />

          <Pressable
            style={[styles.button, saving && { opacity: 0.6 }]}
            onPress={handleDone}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? "Saving..." : "Done"}</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}