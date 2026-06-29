import {
  View, TextInput, Pressable, KeyboardAvoidingView,
  Platform, Alert, Modal,
  Keyboard, Text, StyleSheet,
} from "react-native";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { getDb } from "../../database/db";
import { insertTransaction } from "../../database/transactions";
import * as Location from "expo-location";
import React from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Svg, { Path, Circle } from "react-native-svg";
import { EmotionGlyph, emotionColor } from "../../components/EmotionGlyph";
import LocationPickerMap, { LatLng } from "../../components/LocationPickerMap";
import LocationPreviewMap from "../../components/LocationPreviewMap";
import { useTheme } from "@/context/ThemeContext";
import { ThemeColors } from "@/theme/theme";
import { useNotification } from "@/context/NotificationContext";
import { runAchievementEngine, ACHIEVEMENT_DEFS } from "../../database/achievementEngine";

type Emotion = {
  id: number;
  name: string;
  emoji: string | null;
  color_hex: string | null;
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Default map center — Porto, Portugal.
const PORTO = { latitude: 41.1496, longitude: -8.6109 };

function getDateLabel(d: Date) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function getTimeLabel(d: Date) {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function AddPurchase() {
  const { notification, expoPushToken, devicePushToken, error } = useNotification();
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);

  const [detectingLocation, setDetectingLocation] = useState(false);
  const [rawDigits, setRawDigits] = useState("");
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [coordinate, setCoordinate] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [userCurrency, setUserCurrency] = useState("€");
  const [date, setDate] = useState(new Date());
  const [editingField, setEditingField] = useState<"date" | "time" | null>(null);

  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [selectedEmotionIds, setSelectedEmotionIds] = useState<number[]>([]);

  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng>(PORTO);

  useEffect(() => {
    getDb()
      .then(db => db.getAllAsync<Emotion>("SELECT id, name, emoji, color_hex FROM emotions ORDER BY id ASC;"))
      .then(setEmotions)
      .catch(console.error);
  }, []);

  useFocusEffect(useCallback(() => {
    setRawDigits(""); setItem(""); setLocation(""); setCoordinate(null);
    setSelectedEmotionIds([]); setSaving(false); setDate(new Date()); setEditingField(null);

    async function fetchCurrency() {
      if (!global.userID) return;
      try {
        const db = await getDb();
        const user = await db.getFirstAsync<{ currency_code: string }>(
          "SELECT currency_code FROM users WHERE id = ?",
          [global.userID]
        );
        if (user && user.currency_code) {
          setUserCurrency(user.currency_code);
        }
      } catch (error) {
        console.error("Failed to load currency:", error);
      }
    }
    fetchCurrency();
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
      setCoordinate({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocation(await reverseGeocode(loc.coords.latitude, loc.coords.longitude));
    } catch { Alert.alert("Error", "Could not get location."); }
    finally { setDetectingLocation(false); }
  }

  function openMap() {
    Keyboard.dismiss();
    setMapCenter(PORTO); // always open centered on Porto
    setShowMap(true);
  }

  async function handleConfirmMapLocation() {
    setShowMap(false);
    setCoordinate(mapCenter);
    setDetectingLocation(true);
    try { setLocation(await reverseGeocode(mapCenter.latitude, mapCenter.longitude)); }
    catch { Alert.alert("Error", "Could not resolve address."); }
    finally { setDetectingLocation(false); }
  }

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
        location: location || undefined,
        emotion_ids: selectedEmotionIds,
        currency_code: userCurrency,
        type: "cash",
        transacted_at: date.toISOString(),
      });

      const newlyUnlocked = await runAchievementEngine(global.userID);

      let db = await getDb();

      const user = await db.getFirstAsync(
        "SELECT username FROM users WHERE (id = ?)",
        [global.userID],
      );
      const username = user['username']

      try {
        const response = await fetch("PLACEHOLDER/savePurchase", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user: username, token: expoPushToken, time: Date.now() / 1000 }),
        });
      } catch (e) {
        console.log("Error: could not connnect to notifications server")
      }

      router.navigate({ pathname: "/", params: { added: "true", unlockedAchievements: newlyUnlocked.length > 0 ? JSON.stringify(newlyUnlocked) : undefined, timestamp: Date.now() } });

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
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>log expense</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* ── Price ── */}
        <View style={s.priceWrap}>
          <View style={s.priceRow}>
            <Text style={[s.currency, !hasAmount && { color: C.inkMute }]}>{userCurrency}</Text>
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
                const ringColor = isSel ? color : C.rule;
                return (
                  <Pressable
                    key={em.id}
                    style={s.emotionCell}
                    onPress={() => handleSelectEmotion(em.id)}
                  >
                    <View style={[
                      s.emotionCircle,
                      {
                        borderColor: ringColor, backgroundColor: isSel ? color + "22" : "transparent",
                        borderWidth: isSel ? 1.5 : 1.2
                      },
                    ]}>
                      <EmotionGlyph emotion={lower} color={isSel ? color : C.inkSoft} size={22} />
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
              <Pressable onPress={openMap} hitSlop={8} style={s.mapLink}>
                <Svg width={13} height={13} viewBox="0 0 24 24">
                  <Path
                    d="M9 4 L3 6 V20 L9 18 L15 20 L21 18 V4 L15 6 L9 4 Z"
                    fill="none" stroke={C.inkSoft} strokeWidth={1.6} strokeLinejoin="round"
                  />
                  <Path d="M9 4 V18 M15 6 V20" fill="none" stroke={C.inkSoft} strokeWidth={1.6} />
                </Svg>
                <Text style={s.mapLinkText}>pick on map</Text>
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

            {coordinate ? (
              <View style={s.mapPreviewWrap}>
                <LocationPreviewMap coordinate={coordinate} style={s.mapPreview} />
              </View>
            ) : (
              <Pressable
                onPress={openMap}
                style={[s.mapPreviewWrap, s.mapPlaceholder]}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  <Path
                    d="M12 2 C7 2 4 6 4 10 C4 16 12 22 12 22 C12 22 20 16 20 10 C20 6 17 2 12 2 Z"
                    fill="none" stroke={C.inkMute} strokeWidth={1.6}
                  />
                  <Circle cx={12} cy={10} r={3} fill="none" stroke={C.inkMute} strokeWidth={1.6} />
                </Svg>
                <Text style={s.mapPlaceholderText}>no location yet</Text>
              </Pressable>
            )}
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

      {/* ── Map Modal (native Apple Maps on iOS, Leaflet/OSM on Android) ── */}
      <Modal visible={showMap} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setShowMap(false)}>
        <View style={s.mapRoot}>
          {showMap && (
            <LocationPickerMap
              initial={mapCenter}
              onRegionChange={setMapCenter}
              style={{ flex: 1 }}
            />
          )}

          {/* Controls float over the full-screen map. */}
          <View style={s.mapOverlayControls}>
            <Pressable style={s.mapConfirmBtn} onPress={handleConfirmMapLocation}>
              <Text style={s.ctaText}>confirm location</Text>
            </Pressable>
            <Pressable style={s.mapCancelBtn} onPress={() => setShowMap(false)}>
              <Text style={s.mapCancelBtnText}>cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingTop: 56,
    paddingBottom: 6,
    paddingHorizontal: 24,
    alignItems: "flex-start",
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.3,
  },

  // Price
  priceWrap: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12 },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  currency: {
    fontFamily: "LibreCaslonText_700Bold",
    fontSize: 26,
    color: C.ink,
    marginRight: 2,
  },
  priceInput: {
    fontFamily: "LibreCaslonText_700Bold",
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
  pillIdle: { borderColor: C.rule, backgroundColor: "transparent" },
  pillActive: { borderColor: C.ink, backgroundColor: C.ink },
  pillTextIdle: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: C.ink,
  },
  pillTextActive: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: C.bg,
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
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  mapLinkText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 13,
    color: C.inkSoft,
  },
  mapPreviewWrap: {
    marginTop: 10,
    height: 164,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.rule,
  },
  mapPreview: { flex: 1 },
  mapPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.fieldBg,
    borderStyle: "dashed",
  },
  mapPlaceholderText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 13,
    color: C.inkMute,
  },

  // Map modal — controls float over the full-screen map
  mapRoot: { flex: 1, backgroundColor: C.bg },
  mapOverlayControls: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 44 : 28,
    left: 20,
    right: 20,
    gap: 10,
  },
  mapConfirmBtn: {
    backgroundColor: C.blackBtn,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  mapCancelBtn: {
    backgroundColor: C.panel,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.rule,
  },
  mapCancelBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: C.inkSoft,
    letterSpacing: 1,
    textTransform: "uppercase",
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

});
