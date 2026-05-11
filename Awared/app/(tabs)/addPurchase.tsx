import {
  View, TextInput, Pressable, KeyboardAvoidingView,
  Platform, Alert, Modal, TouchableWithoutFeedback,
  Keyboard, Text, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback, useEffect } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { getDb } from "../../database/db";
import { insertTransaction } from "../../database/transactions";
import * as Location from "expo-location";
import React from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import MapView, { Region } from "react-native-maps";
import Svg, { Path, Circle } from "react-native-svg";
import { EmotionGlyph, emotionColor } from "../../components/EmotionGlyph";

type Emotion = {
  id: number;
  name: string;
  emoji: string | null;
  color_hex: string | null;
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const C = {
  bg: "#FAF6EF",
  ink: "#1F1B16",
  inkMute: "rgba(31,27,22,0.45)",
  inkSoft: "#7A7268",
  rule: "rgba(0,0,0,0.10)",
  blackBtn: "#1F1B16",
  purple: "#9B82C9",
};

function getDateLabel(d: Date) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function getTimeLabel(d: Date) {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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

  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 41.178, longitude: -8.598, latitudeDelta: 0.005, longitudeDelta: 0.005,
  });

  useEffect(() => {
    getDb()
      .then(db => db.getAllAsync<Emotion>("SELECT id, name, emoji, color_hex FROM emotions ORDER BY id ASC;"))
      .then(setEmotions)
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
  const handleSelectEmotion = (id: number) => {
    setSelectedEmotionIds(prev => prev.includes(id) ? [] : [id]);
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

  const amount = parseFloat(rawDigits.replace(",", "."));
  const hasAmount = !isNaN(amount) && amount > 0;
  const canConfirm = hasAmount && item.trim().length > 0 && selectedEmotionIds.length > 0;

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>log expense</Text>
        <Pressable hitSlop={8} onPress={() => router.back()} style={s.headerClose}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M6 6 L18 18 M18 6 L6 18" stroke={C.ink} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* ── Price ── */}
        <View style={s.priceWrap}>
          <View style={s.priceRow}>
            <Text style={[s.currency, !hasAmount && { color: C.inkMute }]}>€</Text>
            <TextInput
              style={[s.priceInput, !hasAmount && { color: C.inkMute }]}
              keyboardType="decimal-pad"
              value={rawDigits}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor={C.inkMute}
              underlineColorAndroid="transparent"
              returnKeyType="done"
            />
          </View>
          <View style={s.priceUnderline} />
        </View>

        <View style={s.body}>
          {/* what did you buy */}
          <View>
            <Text style={s.label}>what did you buy?</Text>
            <TextInput
              value={item}
              onChangeText={setItem}
              placeholder="e.g. starbucks, uber, groceries…"
              placeholderTextColor={C.inkMute}
              style={s.textInputLine}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <View style={s.underline} />
          </View>

          {/* emotions */}
          <View>
            <Text style={s.label}>how were you feeling?</Text>
            <View style={s.emotionGrid}>
              {emotions.map(em => {
                const isSel = selectedEmotionIds.includes(em.id);
                const lower = em.name.toLowerCase();
                const color = emotionColor(lower);
                const ringColor = isSel ? color : "rgba(31,27,22,0.18)";
                return (
                  <Pressable
                    key={em.id}
                    style={s.emotionCell}
                    onPress={() => handleSelectEmotion(em.id)}
                  >
                    <View style={[
                      s.emotionCircle,
                      { borderColor: ringColor, backgroundColor: isSel ? color + "22" : "transparent",
                        borderWidth: isSel ? 1.5 : 1.2 },
                    ]}>
                      <EmotionGlyph emotion={lower} color={isSel ? color : "#7A7268"} size={22} />
                    </View>
                    <Text style={[s.emotionLabel, { color: isSel ? color : C.inkSoft }]} numberOfLines={1}>
                      {lower}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* when */}
          <View>
            <Text style={s.label}>when did you buy?</Text>
            <View style={s.pillRow}>
              <Pressable
                style={[s.pill, editingField === "date" ? s.pillActive : s.pillIdle]}
                onPress={() => toggleField("date")}
              >
                <Text style={editingField === "date" ? s.pillTextActive : s.pillTextIdle}>
                  {getDateLabel(date)}
                </Text>
              </Pressable>
              <Pressable
                style={[s.pill, editingField === "time" ? s.pillActive : s.pillIdle]}
                onPress={() => toggleField("time")}
              >
                <Text style={editingField === "time" ? s.pillTextActive : s.pillTextIdle}>
                  {getTimeLabel(date)}
                </Text>
              </Pressable>
            </View>
            {editingField !== null && (
              <View style={s.pickerWrap}>
                <DateTimePicker
                  value={date} mode={editingField} is24Hour
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                />
              </View>
            )}
          </View>

          {/* where */}
          <View>
            <View style={s.whereHeader}>
              <Text style={[s.label, { marginBottom: 0 }]}>where?</Text>
              <Pressable
                style={[s.pillSm, s.pillIdle]}
                onPress={() => { Keyboard.dismiss(); setShowMap(true); }}
              >
                <Svg width={14} height={12} viewBox="0 0 24 20">
                  <Path
                    d="M2 4 L8 2 L16 4 L22 2 L22 16 L16 18 L8 16 L2 18 Z M8 2 L8 16 M16 4 L16 18"
                    fill="none" stroke={C.ink} strokeWidth={1.6} strokeLinejoin="round"
                  />
                </Svg>
                <Text style={s.pillTextIdle}>map</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={handleAutoDetectLocation}
              disabled={detectingLocation}
              style={s.detectRow}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Circle cx={12} cy={10} r={3} fill="none"
                  stroke={location ? C.ink : C.inkSoft} strokeWidth={1.6} />
                <Path
                  d="M12 2 C7 2 4 6 4 10 C4 16 12 22 12 22 C12 22 20 16 20 10 C20 6 17 2 12 2 Z"
                  fill="none" stroke={location ? C.ink : C.inkSoft} strokeWidth={1.6}
                />
              </Svg>
              <Text
                style={[s.detectText, { color: location ? C.ink : C.inkMute }]}
                numberOfLines={1}
              >
                {detectingLocation ? "detecting…" : (location || "detect location")}
              </Text>
            </Pressable>
            <View style={s.underline} />
          </View>

          {/* notes */}
          <View style={{ flex: 1, minHeight: 80 }}>
            <Text style={s.label}>any thoughts?</Text>
            <TextInput
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="what was going through your head?"
              placeholderTextColor={C.inkMute}
              style={s.notesInput}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
        </View>

        {/* CTA */}
        <View style={s.ctaWrap}>
          <Pressable
            style={[s.ctaBtn, !canConfirm && s.ctaDisabled, saving && { opacity: 0.6 }]}
            onPress={handleDone}
            disabled={!canConfirm || saving}
          >
            <Text style={s.ctaText}>
              {saving ? "saving…" : "confirm purchase"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Map bottom sheet ── */}
      <Modal
        visible={showMap}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMap(false)}
      >
        <View style={s.mapOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowMap(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={s.mapSheet}>
            <View style={s.mapDragHandle} />
            <View style={s.mapHeaderRow}>
              <Text style={s.mapTitle}>Pick a place</Text>
              <Pressable onPress={() => setShowMap(false)} hitSlop={8}>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path d="M6 6 L18 18 M18 6 L6 18" stroke={C.ink} strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
            <View style={s.mapWrap}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={mapRegion}
                onRegionChangeComplete={setMapRegion}
                showsUserLocation
              />
              <View style={s.mapPin} pointerEvents="none">
                <Svg width={28} height={36} viewBox="0 0 28 36">
                  <Path
                    d="M14 1 C7 1 2 6 2 13 C2 22 14 35 14 35 C14 35 26 22 26 13 C26 6 21 1 14 1 Z"
                    fill={C.purple} stroke={C.ink} strokeWidth={1.4}
                  />
                  <Circle cx={14} cy={13} r={4.5} fill={C.bg} />
                </Svg>
              </View>
              <View style={s.mapHint} pointerEvents="none">
                <Text style={s.mapHintText}>drag the map to position the pin</Text>
              </View>
            </View>
            <Pressable style={s.mapConfirmBtn} onPress={handleConfirmMapLocation}>
              <Text style={s.mapConfirmText}>use this place</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 13,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 30,
    color: C.ink,
    letterSpacing: -0.3,
  },
  headerClose: { padding: 4 },

  // Price
  priceWrap: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12 },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  currency: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: C.ink,
    marginRight: 2,
  },
  priceInput: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 52,
    color: C.ink,
    textAlign: "center",
    padding: 0,
    minWidth: 120,
  },
  priceUnderline: { height: 1.5, backgroundColor: C.ink, marginTop: 8 },

  // Body
  body: { flex: 1, paddingHorizontal: 24, gap: 14 },
  label: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 13,
    color: C.inkSoft,
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  // What did you buy
  textInputLine: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 15,
    color: C.ink,
    paddingVertical: 4,
    paddingBottom: 8,
  },
  underline: { height: 1, backgroundColor: C.rule },

  // Emotion grid
  emotionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 4,
  },
  emotionCell: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 4,
    gap: 6,
  },
  emotionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emotionLabel: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 12.5,
  },

  // Pills
  pillRow: { flexDirection: "row", gap: 8 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillSm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillIdle: { borderColor: "rgba(31,27,22,0.22)", backgroundColor: "transparent" },
  pillActive: { borderColor: C.ink, backgroundColor: C.ink },
  pillTextIdle: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: C.ink,
  },
  pillTextActive: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: "#FAF6EF",
  },
  pickerWrap: { marginTop: 4 },

  // Where
  whereHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingBottom: 8,
  },
  detectText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 14,
    flex: 1,
  },

  // Notes
  notesInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: C.ink,
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: "PlayfairDisplay_400Regular",
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: C.bg,
  },
  ctaBtn: {
    backgroundColor: C.blackBtn,
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.35 },
  ctaText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#FAF6EF",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // Map sheet
  mapOverlay: {
    flex: 1,
    backgroundColor: "rgba(31,27,22,0.35)",
    justifyContent: "flex-end",
  },
  mapSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
    maxHeight: "90%",
  },
  mapDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignSelf: "center",
    marginBottom: 12,
  },
  mapHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mapTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 20,
    color: C.ink,
  },
  mapWrap: {
    height: 440,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  mapPin: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -14 }, { translateY: -32 }],
  },
  mapHint: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    backgroundColor: "rgba(255,252,246,0.85)",
  },
  mapHintText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 10.5,
    color: C.inkSoft,
  },
  mapConfirmBtn: {
    backgroundColor: C.blackBtn,
    paddingVertical: 14,
    marginTop: 14,
    borderRadius: 4,
    alignItems: "center",
  },
  mapConfirmText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 12,
    color: "#FAF6EF",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
