import {
  View, TextInput, Pressable, ScrollView, KeyboardAvoidingView,
  Platform, Alert, ActivityIndicator, Modal, StyleSheet, Animated,
  TouchableWithoutFeedback, Dimensions, Keyboard
} from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { getDb } from "../../database/db";
import { insertTransaction } from "../../database/transactions";
import * as Location from "expo-location";
import React from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import MapView, { Region } from "react-native-maps";
import { styles } from "./addPurchaseStyles";

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
  const [saving, setSaving] = useState(false);
  
  const [date, setDate] = useState(new Date());
  const [editingField, setEditingField] = useState<'date' | 'time' | null>(null);

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
    Animated.timing(sheetAnim, { toValue: SHEET_H, duration: 220, useNativeDriver: true })
      .start(() => setShowEmotionOverlay(false));
  }

  // --- Map States ---
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 41.1780, 
    longitude: -8.5980,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  useEffect(() => {
    getDb()
      .then((db) => db.getAllAsync<Emotion>("SELECT id, name, emoji, color_hex FROM emotions ORDER BY name ASC;"))
      .then((data) => {
        setEmotions(data);
        if (data.length >= 3) {
          setVisibleEmotionIds([data[0].id, data[1].id, data[2].id]);
        } else {
          setVisibleEmotionIds(data.map(e => e.id));
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
    if (Platform.OS === 'android') setEditingField(null);
    if (selectedDate) setDate(selectedDate);
  };

  const toggleField = (field: 'date' | 'time') => {
    Keyboard.dismiss();
    setEditingField((prev) => (prev === field ? null : field));
  };

  const toggleEmotion = (id: number) => {
    setSelectedEmotionIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleSelectFromOverlay = (id: number) => {
    if (!visibleEmotionIds.includes(id)) {
      setVisibleEmotionIds((prev) => [id, prev[0], prev[1]]);
    }
    if (!selectedEmotionIds.includes(id)) {
      toggleEmotion(id);
    }
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" 
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => toggleField('date')} style={styles.dateTimeBtn}>
              <Text style={[styles.headerText, editingField === 'date' && styles.headerTextEditing]}>
                {getDateLabel(date)}
              </Text>
              {editingField === 'date' && (
                <Ionicons name="checkmark-circle" size={16} color="#6b21a8" style={{ marginLeft: 6 }} />
              )}
            </Pressable>
            <Pressable onPress={() => toggleField('time')} style={styles.dateTimeBtn}>
              <Text style={[styles.headerTime, editingField === 'time' && styles.headerTextEditing]}>
                {getTimeLabel(date)}
              </Text>
              {editingField === 'time' && (
                <Ionicons name="checkmark-circle" size={16} color="#6b21a8" style={{ marginLeft: 6 }} />
              )}
            </Pressable>
          </View>

          {editingField !== null && (
            <View style={styles.pickerContainer}>
              <DateTimePicker value={date} mode={editingField} is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} />
            </View>
          )}

          {/* Amount Section */}
          <Text style={styles.label}>How much was it?</Text>
          <View style={styles.centeredSection}>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                value={rawDigits}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#ccc"
                underlineColorAndroid="transparent"
                returnKeyType="done"
              />
              <Text style={styles.currencySymbol}>€</Text>
            </View>
            <View style={styles.inputUnderline} />
          </View>

          {/* Item Name */}
          <Text style={styles.label}>What did you buy?</Text>
          <View style={styles.centeredSection}>
            <TextInput 
              style={styles.itemInput} 
              value={item} 
              onChangeText={setItem} 
              placeholder="e.g. Coffee" 
              placeholderTextColor="#ccc" 
            />
            <View style={[styles.inputUnderline, { width: "60%" }]} />
          </View>

          {/* Emotions Section */}
          <Text style={styles.label}>How were you feeling?</Text>
          <View style={styles.emotionGrid}>
            {visibleEmotionIds.map((id) => {
              const emotion = emotions.find(e => e.id === id);
              if (!emotion) return null;
              const isSelected = selectedEmotionIds.includes(emotion.id);
              const baseColor = emotion.color_hex ?? "#e0d4ea";

              return (
                <Pressable
                  key={emotion.id}
                  style={({ pressed }) => [
                    styles.emotionSquare,
                    { backgroundColor: pressed ? `${baseColor}BB` : baseColor },
                    isSelected ? styles.selectedSquare : styles.unselectedSquare,
                  ]}
                  onPress={() => toggleEmotion(emotion.id)}
                >
                  {emotion.emoji && <Text style={styles.squareEmoji}>{emotion.emoji}</Text>}
                  <Text style={[styles.squareText, { color: getTextColor(emotion.color_hex) }]} numberOfLines={1}>
                    {emotion.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.plusSquare} onPress={openEmotionSheet}>
              <Ionicons name="add" size={28} color="#999" />
            </Pressable>
          </View>

          {/* Location Section */}
          <Text style={styles.label}>Where were you?</Text>
          <View style={styles.locationInputRow}>
            <Ionicons name="search-outline" size={16} color="#999" />
            <TextInput 
              style={styles.locationInput} 
              value={location} 
              onChangeText={setLocation} 
              placeholder="e.g. FEUP" 
              placeholderTextColor="#bbb" 
            />
          </View>

          <View style={styles.autoDetectWrapper}>
            <Pressable style={styles.autoDetectBadge} onPress={handleAutoDetectLocation} disabled={detectingLocation}>
              {detectingLocation ? <ActivityIndicator size="small" color="#2a7a2a" /> : (
                <><Ionicons name="location-outline" size={14} color="#2a7a2a" /><Text style={styles.autoDetectText}> Auto-detect</Text></>
              )}
            </Pressable>
            
            <Pressable style={[styles.autoDetectBadge, { backgroundColor: '#e0f0ff' }]} onPress={() => { Keyboard.dismiss(); setShowMap(true); }}>
              <Ionicons name="map-outline" size={14} color="#0066cc" />
              <Text style={[styles.autoDetectText, { color: '#0066cc' }]}> Pick on Map</Text>
            </Pressable>
          </View>

          {/* Note Section */}
          <Text style={styles.label}>Do you want to add something?</Text>
          <TextInput 
            style={styles.noteInput} 
            multiline 
            value={note} 
            onChangeText={setNote} 
            placeholder="e.g. I was stressed..." 
            placeholderTextColor="#bbb" 
          />

          {/* Done Button */}
          <Pressable style={[styles.button, saving && { opacity: 0.6 }]} onPress={handleDone} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? "Saving..." : "Done"}</Text>
          </Pressable>

          {/* Spacer for scroll visibility */}
          <View style={{ height: 40 }} />

        </ScrollView>
      </KeyboardAvoidingView>

      {/* All Emotions Modal */}
      <Modal visible={showEmotionOverlay} animationType="none" transparent={true} onRequestClose={closeEmotionSheet}>
        <TouchableWithoutFeedback onPress={closeEmotionSheet}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.modalContent, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All Emotions</Text>
            <Pressable onPress={closeEmotionSheet}><Ionicons name="close-circle" size={28} color="#e0e0e0" /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {emotions.map((emotion) => (
              <Pressable key={emotion.id} onPress={() => handleSelectFromOverlay(emotion.id)}
                style={[styles.emotionSquare, { backgroundColor: emotion.color_hex ?? "#e0d4ea", width: '30%' }, selectedEmotionIds.includes(emotion.id) ? styles.selectedSquare : styles.unselectedSquare]}
              >
                <Text style={styles.squareEmoji}>{emotion.emoji}</Text>
                <Text style={styles.squareText} numberOfLines={1}>{emotion.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* Map Selector Modal */}
      <Modal visible={showMap} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {/* Map Header */}
          <View style={styles.mapHeader}>
            <Text style={styles.mapHeaderText}>Pin Location</Text>
            <Pressable onPress={() => setShowMap(false)} style={styles.mapHeaderClose}>
              <Ionicons name="close" size={24} color="#333" />
            </Pressable>
          </View>

          <MapView 
            style={{ flex: 1 }} 
            initialRegion={mapRegion} 
            onRegionChangeComplete={setMapRegion}
            showsUserLocation={true}
          />
          
          <View style={styles.mapCenterPin}>
            <Ionicons name="location" size={44} color="#ff4444" />
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