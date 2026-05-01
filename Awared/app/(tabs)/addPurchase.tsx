import {
  View, TextInput, Pressable, ScrollView, KeyboardAvoidingView,
  Platform, Alert, ActivityIndicator, Modal, Animated,
  TouchableWithoutFeedback, Dimensions, Keyboard, Text, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { getDb } from "../../database/db";
import { insertTransaction } from "../../database/transactions";
import * as Location from "expo-location";
import React from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import MapView, { Region } from "react-native-maps";

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
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
function getTextColor(hex: string | null): string {
  if (!hex) return "#524346";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#333" : "#fff8f7";
}

export default function AddPurchase() {
  const router = useRouter();

  const [detectingLocation, setDetectingLocation] = useState(false);
  const [rawDigits, setRawDigits] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date());
  const [editingField, setEditingField] = useState<"date" | "time" | null>(null);

  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [selectedEmotionIds, setSelectedEmotionIds] = useState<number[]>([]);
  const [visibleEmotionIds, setVisibleEmotionIds] = useState<number[]>([]);
  const [showEmotionOverlay, setShowEmotionOverlay] = useState(false);

  const SHEET_H = Dimensions.get("window").height * 0.6;
  const sheetAnim = useRef(new Animated.Value(SHEET_H)).current;

  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 41.178, longitude: -8.598, latitudeDelta: 0.005, longitudeDelta: 0.005,
  });

  function openEmotionSheet() {
    Keyboard.dismiss();
    setShowEmotionOverlay(true);
    sheetAnim.setValue(SHEET_H);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();
  }
  function closeEmotionSheet() {
    Animated.timing(sheetAnim, { toValue: SHEET_H, duration: 220, useNativeDriver: true })
      .start(() => setShowEmotionOverlay(false));
  }

  useEffect(() => {
    getDb()
      .then(db => db.getAllAsync<Emotion>("SELECT id, name, emoji, color_hex FROM emotions ORDER BY name ASC;"))
      .then(data => {
        setEmotions(data);
        setVisibleEmotionIds(data.length >= 3 ? [data[0].id, data[1].id, data[2].id] : data.map(e => e.id));
      })
      .catch(console.error);
  }, []);

  useFocusEffect(useCallback(() => {
    setRawDigits(""); setItem(""); setLocation(""); setNote("");
    setSelectedEmotionIds([]); setSaving(false); setDate(new Date()); setEditingField(null);
  }, []));

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setEditingField(null);
    if (selectedDate) setDate(selectedDate);
  };
  const toggleField = (field: "date" | "time") => {
    Keyboard.dismiss();
    setEditingField(prev => prev === field ? null : field);
  };
  const toggleEmotion = (id: number) =>
    setSelectedEmotionIds(prev => prev.includes(id) ? [] : [id]);
  const handleSelectFromOverlay = (id: number) => {
    if (!visibleEmotionIds.includes(id))
      setVisibleEmotionIds(prev => [id, prev[0], prev[1]]);
    setSelectedEmotionIds([id]);
    setShowEmotionOverlay(false);
  };
  const handleAmountChange = (text: string) =>
    setRawDigits(text.replace(/[^0-9.,]/g, ""));

  async function reverseGeocode(lat: number, lng: number) {
    const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (res.length > 0) {
      const p = res[0];
      return [p.street, p.name, p.city].filter(Boolean).join(", ");
    }
    return "";
  }

  async function handleAutoDetectLocation() {
    Keyboard.dismiss();
    try {
      setDetectingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission denied", "Allow location access."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(await reverseGeocode(loc.coords.latitude, loc.coords.longitude));
    } catch { Alert.alert("Error", "Could not get location."); }
    finally { setDetectingLocation(false); }
  }

  const handleConfirmMapLocation = async () => {
    setDetectingLocation(true); setShowMap(false);
    try { setLocation(await reverseGeocode(mapRegion.latitude, mapRegion.longitude)); }
    catch { Alert.alert("Error", "Could not resolve address."); }
    finally { setDetectingLocation(false); }
  };

  const handleDone = async () => {
    const amount = parseFloat(rawDigits.replace(",", "."));
    if (!rawDigits || isNaN(amount) || amount <= 0) {
      Alert.alert("Missing amount", "Please enter how much you spent."); return;
    }
    if (!global.userID) { Alert.alert("Error", "User not logged in."); return; }
    setSaving(true);
    try {
      await insertTransaction({
        user_id: global.userID, amount,
        merchant_name: item || undefined,
        note: note || undefined,
        location: location || undefined,
        emotion_ids: selectedEmotionIds,
        currency_code: "EUR", type: "cash",
        transacted_at: date.toISOString(),
      });
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save the purchase.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.homeBtn} onPress={() => router.back()}>
          <Ionicons name="home-outline" size={19} color="#524346" />
        </Pressable>
        <Text style={s.headerTitle}>Add Purchase</Text>
        <View style={s.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.content}>
          {/* ── Amount ── */}
          <View style={s.amountSection}>
            <Text style={s.currencySymbol}>€</Text>
            <TextInput
              style={s.amountInput}
              keyboardType="decimal-pad"
              value={rawDigits}
              onChangeText={handleAmountChange}
              placeholder="0,00"
              placeholderTextColor="#d6c1c5"
              underlineColorAndroid="transparent"
              returnKeyType="done"
            />
          </View>

          {/* ── Details Card ── */}
          <View style={s.card}>
            {/* Merchant */}
            <Text style={s.cardLabel}>What did you buy ?</Text>
            <View style={s.inputRow}>
              <View style={s.inputIconWrap}>
                <Ionicons name="grid-outline" size={17} color="#847376" />
              </View>
              <TextInput
                style={s.textInput}
                value={item}
                onChangeText={setItem}
                placeholder="Coffee, Groceries, etc..."
                placeholderTextColor="#d6c1c5"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            <View style={s.divider} />

            {/* Emotions */}
            <Text style={s.cardLabel}>How were you feeling ?</Text>
            <View style={s.emotionRow}>
              {visibleEmotionIds.map(id => {
                const em = emotions.find(e => e.id === id);
                if (!em) return null;
                const selected = selectedEmotionIds.includes(em.id);
                const bg = em.color_hex ?? "#f8ebec";
                return (
                  <Pressable
                    key={em.id}
                    style={[s.emotionCell, { backgroundColor: bg },
                      selected && { borderWidth: 2, borderColor: "#8b4b5c" }]}
                    onPress={() => toggleEmotion(em.id)}
                  >
                    {em.emoji ? <Text style={s.emotionEmoji}>{em.emoji}</Text> : null}
                    <Text style={[s.emotionName, { color: getTextColor(em.color_hex) }]} numberOfLines={1}>
                      {em.name}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable style={[s.emotionCell, s.emotionMore]} onPress={openEmotionSheet}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#524346" />
                <Text style={[s.emotionName, { color: "#524346" }]}>More</Text>
              </Pressable>
            </View>

            <View style={s.divider} />

            {/* Date / Time */}
            <View style={s.dateTimeRow}>
              <Pressable
                style={[s.dateChip, editingField === "date" && s.dateChipActive]}
                onPress={() => toggleField("date")}
              >
                <Ionicons name="calendar-outline" size={13}
                  color={editingField === "date" ? "#8b4b5c" : "#524346"} />
                <Text style={[s.dateChipText, editingField === "date" && s.dateChipTextActive]}
                  numberOfLines={1}>
                  {getDateLabel(date)}
                </Text>
              </Pressable>
              <Pressable
                style={[s.timeChip, editingField === "time" && s.dateChipActive]}
                onPress={() => toggleField("time")}
              >
                <Ionicons name="time-outline" size={13}
                  color={editingField === "time" ? "#8b4b5c" : "#524346"} />
                <Text style={[s.dateChipText, editingField === "time" && s.dateChipTextActive]}>
                  {getTimeLabel(date)}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Date/Time Picker ── */}
          {editingField !== null && (
            <View style={[s.card, { padding: 8 }]}>
              <DateTimePicker
                value={date} mode={editingField} is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onDateChange}
              />
            </View>
          )}

          {/* ── Location Card ── */}
          <View style={s.card}>
            <View style={s.locationHeader}>
              <Text style={s.cardLabel}>Location</Text>
              <View style={s.locationActions}>
                <Pressable style={s.locationBadgeGreen} onPress={handleAutoDetectLocation} disabled={detectingLocation}>
                  {detectingLocation
                    ? <ActivityIndicator size="small" color="#2a7a2a" />
                    : <><Ionicons name="location-outline" size={12} color="#2a7a2a" />
                      <Text style={s.locationBadgeTextGreen}> Detect</Text></>}
                </Pressable>
                <Pressable style={s.locationBadgeBlue} onPress={() => { Keyboard.dismiss(); setShowMap(true); }}>
                  <Ionicons name="map-outline" size={12} color="#0066cc" />
                  <Text style={s.locationBadgeTextBlue}> Map</Text>
                </Pressable>
              </View>
            </View>
            <View style={s.inputRow}>
              <View style={s.inputIconWrap}>
                <Ionicons name="location-outline" size={17} color="#847376" />
              </View>
              <TextInput
                style={s.textInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Add location..."
                placeholderTextColor="#d6c1c5"
              />
            </View>
          </View>

          {/* ── Note Card ── */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Any thoughts?</Text>
            <TextInput
              style={s.noteInput}
              multiline value={note} onChangeText={setNote}
              placeholder="e.g. I was stressed..."
              placeholderTextColor="#d6c1c5"
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

        </View>
      </KeyboardAvoidingView>

      {/* ── CTA ── */}
      <View style={s.ctaWrap}>
        <Pressable
          style={[s.ctaBtn, saving && { opacity: 0.6 }]}
          onPress={handleDone}
          disabled={saving}
        >
          <Ionicons name="checkmark" size={20} color="#773a4b" />
          <Text style={s.ctaBtnText}>{saving ? "Saving..." : "Confirm Purchase"}</Text>
        </Pressable>
      </View>

      {/* ── All Emotions Sheet ── */}
      <Modal visible={showEmotionOverlay} animationType="none" transparent onRequestClose={closeEmotionSheet}>
        <TouchableWithoutFeedback onPress={closeEmotionSheet}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.4)" }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={[s.sheet, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>All Emotions</Text>
            <Pressable onPress={closeEmotionSheet}>
              <Ionicons name="close-circle" size={28} color="#e0e0e0" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.sheetGrid} showsVerticalScrollIndicator={false}>
            {emotions.map(em => (
              <Pressable
                key={em.id}
                onPress={() => handleSelectFromOverlay(em.id)}
                style={[s.sheetEmotionCell, { backgroundColor: em.color_hex ?? "#e0d4ea" },
                  selectedEmotionIds.includes(em.id) && s.sheetEmotionSelected]}
              >
                <Text style={s.emotionEmoji}>{em.emoji}</Text>
                <Text style={[s.emotionName, { color: getTextColor(em.color_hex) }]} numberOfLines={1}>
                  {em.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* ── Map Modal ── */}
      <Modal visible={showMap} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={s.mapHeader}>
            <Text style={s.mapHeaderTitle}>Pin Location</Text>
            <Pressable onPress={() => setShowMap(false)} style={s.mapCloseBtn}>
              <Ionicons name="close" size={24} color="#333" />
            </Pressable>
          </View>
          <MapView
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            onRegionChangeComplete={setMapRegion}
            showsUserLocation
          />
          <View style={s.mapPin}>
            <Ionicons name="location" size={44} color="#ff4444" />
          </View>
          <View style={s.mapConfirmWrap}>
            <Pressable style={s.mapConfirmBtn} onPress={handleConfirmMapLocation}>
              <Text style={s.mapConfirmText}>Confirm Location</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const CARD_SHADOW = {
  shadowColor: "#8b4b5c",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 14,
  elevation: 3,
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff8f7" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingVertical: 20, backgroundColor: "#fff8f7",
  },
  homeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center",
    shadowColor: "#8b4b5c", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 14, elevation: 3,
  },
  headerSpacer: { width: 40 },
  headerTitle: {
    fontFamily: "Manrope_600SemiBold", fontSize: 24,
    color: "#201a1b", letterSpacing: -0.3,
  },

  // Content (replaces ScrollView)
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },

  // Amount
  amountSection: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingTop: 0, paddingBottom: 24,
  },
  currencySymbol: {
    fontFamily: "Manrope_600SemiBold", fontSize: 28,
    color: "#d6c1c5", marginRight: 8,
  },
  amountInput: {
    fontFamily: "Manrope_700Bold", fontSize: 52,
    color: "#201a1b", letterSpacing: -1,
    minWidth: 60, padding: 0, textAlign: "center",
  },

  // Card
  card: {
    backgroundColor: "#ffffff", borderRadius: 24, padding: 24,
    marginBottom: 16, ...CARD_SHADOW,
  },
  cardLabel: {
    fontFamily: "Manrope_600SemiBold", fontSize: 13,
    color: "#524346", letterSpacing: 0.5, marginBottom: 12,
  },

  // Generic input row
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8ebec", borderRadius: 16,
    paddingRight: 16,
  },
  inputIconWrap: {
    width: 48, alignItems: "center", justifyContent: "center",
  },
  textInput: {
    flex: 1, fontFamily: "Manrope_400Regular",
    fontSize: 16, color: "#201a1b", paddingVertical: 14,
  },

  // Divider
  divider: {
    height: 1, backgroundColor: "#d6c1c5",
    opacity: 0.5, marginVertical: 20,
  },

  // Emotion grid
  emotionRow: { flexDirection: "row", gap: 12 },
  emotionCell: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: 16, gap: 4, minHeight: 76,
  },
  emotionMore: { backgroundColor: "#f8ebec" },
  emotionEmoji: { fontSize: 20 },
  emotionName: {
    fontFamily: "Manrope_600SemiBold", fontSize: 11,
    textAlign: "center",
  },

  // Date/Time row
  dateTimeRow: { flexDirection: "row", gap: 10 },
  dateChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: "#f8ebec", borderRadius: 999,
  },
  timeChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: "#f8ebec", borderRadius: 999,
  },
  dateChipActive: { backgroundColor: "rgba(249,168,187,0.25)" },
  dateChipText: {
    fontFamily: "Manrope_400Regular", fontSize: 12, color: "#524346",
  },
  dateChipTextActive: { fontFamily: "Manrope_600SemiBold", color: "#8b4b5c" },

  // Location
  locationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  locationActions: { flexDirection: "row", gap: 8 },
  locationBadgeGreen: {
    flexDirection: "row", alignItems: "center", paddingVertical: 5,
    paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#e8f5e9",
  },
  locationBadgeBlue: {
    flexDirection: "row", alignItems: "center", paddingVertical: 5,
    paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#e0f0ff",
  },
  locationBadgeTextGreen: { fontFamily: "Manrope_600SemiBold", fontSize: 11, color: "#2a7a2a" },
  locationBadgeTextBlue: { fontFamily: "Manrope_600SemiBold", fontSize: 11, color: "#0066cc" },

  // Note
  noteInput: {
    fontFamily: "Manrope_400Regular", fontSize: 14,
    color: "#201a1b", height: 28, textAlignVertical: "top",
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: 24, paddingBottom: 24, paddingTop: 10,
    backgroundColor: "#fff8f7",
  },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#f9a8bb",
    paddingVertical: 16, borderRadius: 999,
    shadowColor: "#8b4b5c", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14, shadowRadius: 24, elevation: 6,
  },
  ctaBtnText: {
    fontFamily: "Manrope_600SemiBold", fontSize: 15,
    color: "#773a4b", letterSpacing: 0.3,
  },

  // Emotion sheet
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, maxHeight: "85%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  sheetTitle: { fontFamily: "Manrope_700Bold", fontSize: 20, color: "#201a1b" },
  sheetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", paddingBottom: 40 },
  sheetEmotionCell: {
    width: "30%", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, borderRadius: 18,
  },
  sheetEmotionSelected: { borderWidth: 3, borderColor: "#201a1b" },

  // Map
  mapHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 16, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  mapHeaderTitle: { fontFamily: "Manrope_700Bold", fontSize: 18, color: "#1a1a1a" },
  mapCloseBtn: { position: "absolute", right: 16, padding: 4 },
  mapPin: {
    position: "absolute", top: "50%", left: "50%",
    transform: [{ translateX: -22 }, { translateY: -44 }],
  },
  mapConfirmWrap: { position: "absolute", bottom: 40, left: 24, right: 24 },
  mapConfirmBtn: {
    backgroundColor: "#1a1a1a", padding: 18,
    borderRadius: 16, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  mapConfirmText: { color: "#fff", fontFamily: "Manrope_700Bold", fontSize: 16 },
});
