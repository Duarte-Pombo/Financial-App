import {
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  Keyboard,
} from "react-native";
import { Text } from "@/components/Text";
import { MaterialIcons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getDb } from "../../database/db";
import { insertTransaction } from "../../database/transactions";
import * as Location from "expo-location";
import React from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import MapView, { Region } from "react-native-maps";
import { styles } from "./addPurchaseStyles";
import { colors, fonts, spacing } from "@/constants/theme";

type Emotion = {
  id: number;
  name: string;
  emoji: string | null;
  color_hex: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getDateLabel(d: Date) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function getTimeLabel(d: Date) {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function getTextColor(hex: string | null): string {
  if (!hex) return colors.onSurface;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? colors.onSurface : "#ffffff";
}

// Decide which border color a mood pill needs (subtle tint)
function pillBorderColor(hex: string | null): string {
  if (!hex) return colors.outlineVariant;
  return `${hex}33`;
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

  function openEmotionSheet() {
    Keyboard.dismiss();
    setShowEmotionOverlay(true);
    sheetAnim.setValue(SHEET_H);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();
  }

  function closeEmotionSheet() {
    Animated.timing(sheetAnim, { toValue: SHEET_H, duration: 220, useNativeDriver: true }).start(
      () => setShowEmotionOverlay(false)
    );
  }

  // --- Map States ---
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 41.178,
    longitude: -8.598,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  useEffect(() => {
    getDb()
      .then((db) =>
        db.getAllAsync<Emotion>(
          "SELECT id, name, emoji, color_hex FROM emotions ORDER BY name ASC;"
        )
      )
      .then((data) => {
        setEmotions(data);
        if (data.length >= 3) {
          setVisibleEmotionIds([data[0].id, data[1].id, data[2].id]);
        } else {
          setVisibleEmotionIds(data.map((e) => e.id));
        }
      })
      .catch(console.error);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRawDigits("");
      setItem("");
      setLocation("");
      setNote("");
      setSelectedEmotionIds([]);
      setSaving(false);
      setDate(new Date());
      setEditingField(null);
    }, [])
  );

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setEditingField(null);
    if (selectedDate) setDate(selectedDate);
  };

  const toggleField = (field: "date" | "time") => {
    Keyboard.dismiss();
    setEditingField((prev) => (prev === field ? null : field));
  };

  const toggleEmotion = (id: number) => {
    setSelectedEmotionIds((prev) => (prev.includes(id) ? [] : [id]));
  };

  const handleSelectFromOverlay = (id: number) => {
    if (!visibleEmotionIds.includes(id)) {
      setVisibleEmotionIds((prev) => [id, prev[0], prev[1]]);
    }
    setSelectedEmotionIds([id]);
    setShowEmotionOverlay(false);
  };

  const handleAmountChange = (text: string) => {
    setRawDigits(text.replace(/[^0-9.,]/g, ""));
  };

  async function reverseGeocode(lat: number, lng: number) {
    const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (address.length > 0) {
      const p = address[0];
      return [p.street, p.name, p.city].filter(Boolean).join(", ");
    }
    return "";
  }

  async function handleAutoDetectLocation() {
    Keyboard.dismiss();
    try {
      setDetectingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Allow location access to use this feature.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const addr = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      setLocation(addr);
    } catch (err) {
      Alert.alert("Error", "Could not get location.");
    } finally {
      setDetectingLocation(false);
    }
  }

  const handleConfirmMapLocation = async () => {
    setDetectingLocation(true);
    setShowMap(false);
    try {
      const addr = await reverseGeocode(mapRegion.latitude, mapRegion.longitude);
      setLocation(addr);
    } catch (err) {
      Alert.alert("Error", "Could not resolve map address.");
    } finally {
      setDetectingLocation(false);
    }
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
    <View style={styles.container}>
      {/* Header (Close + "New Expense" + spacer) */}
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
        <Text style={styles.headerTitle}>New Expense</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.formContent}>
          {/* Display amount (huge purple) */}
          <View style={styles.displayAmountWrap}>
            <View style={styles.displayAmountRow}>
              <TextInput
                style={styles.displayAmount}
                keyboardType="decimal-pad"
                value={rawDigits}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="rgba(99,14,212,0.25)"
                returnKeyType="done"
              />
              <Text style={styles.displayCurrency}>€</Text>
            </View>
            {/* Subtle date/time link below amount */}
            <Pressable
              style={styles.dateTimeInlineRow}
              onPress={() => toggleField("date")}
            >
              <MaterialIcons name="schedule" size={14} color={colors.outline} />
              <Text style={styles.dateTimeInlineText}>
                {getDateLabel(date)} · {getTimeLabel(date)}
              </Text>
            </Pressable>
          </View>

          {editingField !== null && (
            <View style={styles.pickerWrap}>
              <View style={styles.pickerSwitch}>
                <Pressable
                  onPress={() => toggleField("date")}
                  style={[styles.pickerSwitchBtn, editingField === "date" && styles.pickerSwitchBtnActive]}
                >
                  <Text style={[styles.pickerSwitchText, editingField === "date" && styles.pickerSwitchTextActive]}>
                    Date
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleField("time")}
                  style={[styles.pickerSwitchBtn, editingField === "time" && styles.pickerSwitchBtnActive]}
                >
                  <Text style={[styles.pickerSwitchText, editingField === "time" && styles.pickerSwitchTextActive]}>
                    Time
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={date}
                mode={editingField}
                is24Hour={true}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onDateChange}
              />
            </View>
          )}

          {/* Form fields (no glass wrapper — directly on bg) */}
          <View style={styles.fieldsBlock}>
            {/* What did you buy? */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>What did you buy?</Text>
              <View style={styles.pillInputWrap}>
                <MaterialIcons
                  name="shopping-bag"
                  size={20}
                  color="rgba(99,14,212,0.5)"
                  style={styles.pillInputIcon}
                />
                <TextInput
                  style={styles.pillInput}
                  value={item}
                  onChangeText={setItem}
                  placeholder="e.g. Coffee"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
            </View>

            {/* How were you feeling? */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>How were you feeling?</Text>
              <View style={styles.moodRow}>
                {visibleEmotionIds.map((id) => {
                  const emotion = emotions.find((e) => e.id === id);
                  if (!emotion) return null;
                  const isSelected = selectedEmotionIds.includes(emotion.id);
                  const baseColor = emotion.color_hex ?? colors.primaryFixed;
                  const textColor = getTextColor(emotion.color_hex);
                  return (
                    <Pressable
                      key={emotion.id}
                      onPress={() => toggleEmotion(emotion.id)}
                      style={[
                        styles.moodPill,
                        {
                          backgroundColor: baseColor,
                          borderColor: pillBorderColor(emotion.color_hex),
                        },
                        isSelected && styles.moodPillSelected,
                      ]}
                    >
                      {emotion.emoji && (
                        <Text style={styles.moodPillEmoji}>{emotion.emoji}</Text>
                      )}
                      <Text style={[styles.moodPillLabel, { color: textColor }]}>
                        {emotion.name}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.moodPlusBtn} onPress={openEmotionSheet}>
                  <MaterialIcons name="add" size={20} color={colors.primary} />
                </Pressable>
              </View>
            </View>

            {/* Where were you? — pill input + 2 location buttons */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Where were you?</Text>
              <View style={styles.pillInputWrap}>
                <MaterialIcons
                  name="search"
                  size={18}
                  color="rgba(99,14,212,0.5)"
                  style={styles.pillInputIcon}
                />
                <TextInput
                  style={styles.pillInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. FEUP"
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
              <View style={styles.locationRow}>
                <Pressable
                  style={styles.locationBtn}
                  onPress={handleAutoDetectLocation}
                  disabled={detectingLocation}
                >
                  {detectingLocation ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <MaterialIcons
                      name="my-location"
                      size={22}
                      color="rgba(99,14,212,0.7)"
                    />
                  )}
                  <Text style={styles.locationBtnLabel}>Auto-detect</Text>
                </Pressable>
                <Pressable
                  style={styles.locationBtn}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowMap(true);
                  }}
                >
                  <MaterialIcons name="map" size={22} color="rgba(95,65,129,0.7)" />
                  <Text style={styles.locationBtnLabel}>Pick on Map</Text>
                </Pressable>
              </View>
            </View>

            {/* Note */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Do you want to add something?</Text>
              <View style={styles.noteWrap}>
                <MaterialIcons
                  name="edit-note"
                  size={22}
                  color="rgba(99,14,212,0.5)"
                  style={styles.noteIcon}
                />
                <TextInput
                  style={styles.noteInput}
                  multiline
                  value={note}
                  onChangeText={setNote}
                  placeholder="Notes, tags, or reflections..."
                  placeholderTextColor={colors.outlineVariant}
                />
              </View>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>

      {/* Done button — pinned to bottom, never moves */}
      <View style={styles.doneBtnWrap} pointerEvents="box-none">
        <Pressable
          disabled={saving}
          onPress={handleDone}
          style={({ pressed }) => [{ opacity: pressed || saving ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.doneBtn}
          >
            <MaterialIcons name="check-circle" size={22} color={colors.onPrimary} />
            <Text style={styles.doneBtnText}>{saving ? "Saving..." : "Done"}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* All Emotions Modal */}
      <Modal
        visible={showEmotionOverlay}
        animationType="none"
        transparent={true}
        onRequestClose={closeEmotionSheet}
      >
        <TouchableWithoutFeedback onPress={closeEmotionSheet}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.modalContent, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All Emotions</Text>
            <Pressable onPress={closeEmotionSheet}>
              <MaterialIcons name="close" size={24} color={colors.outlineVariant} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {emotions.map((emotion) => {
              const baseColor = emotion.color_hex ?? colors.primaryFixed;
              const textColor = getTextColor(emotion.color_hex);
              const isSelected = selectedEmotionIds.includes(emotion.id);
              return (
                <Pressable
                  key={emotion.id}
                  onPress={() => handleSelectFromOverlay(emotion.id)}
                  style={[
                    styles.emotionSquare,
                    { backgroundColor: baseColor },
                    isSelected ? styles.selectedSquare : styles.unselectedSquare,
                  ]}
                >
                  <Text style={styles.squareEmoji}>{emotion.emoji}</Text>
                  <Text style={[styles.squareText, { color: textColor }]} numberOfLines={1}>
                    {emotion.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* Map Selector Modal */}
      <Modal visible={showMap} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapHeaderText}>Pin Location</Text>
            <Pressable onPress={() => setShowMap(false)} style={styles.mapHeaderClose}>
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </Pressable>
          </View>

          <MapView
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            onRegionChangeComplete={setMapRegion}
            showsUserLocation={true}
          />

          <View style={styles.mapCenterPin}>
            <MaterialIcons name="location-on" size={44} color={colors.secondary} />
          </View>

          <View style={styles.mapOverlayControls}>
            <Pressable style={styles.mapConfirmBtn} onPress={handleConfirmMapLocation}>
              <Text style={styles.mapConfirmBtnText}>Confirm Location</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
