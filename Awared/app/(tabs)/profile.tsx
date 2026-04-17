import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
} from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { getDb } from "@/database/db";
import { useFocusEffect } from "expo-router";

type ProfileStats = {
  username: string;
  avatarUri: string | null;
  totalPurchases: number;
  topEmotionName: string | null;
  topEmotionEmoji: string | null;
  topEmotionColor: string | null;
};

async function loadProfileStats(userId: string | number): Promise<ProfileStats> {
  const db = await getDb();

  const user = await db.getFirstAsync<{ username: string; avatar_url: string | null }>(
    "SELECT username, avatar_url FROM users WHERE id = ?",
    [userId]
  );

  const countRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM transactions WHERE user_id = ?",
    [userId]
  );

  const topEmotion = await db.getFirstAsync<{ name: string; emoji: string; color_hex: string }>(
    `SELECT e.name, e.emoji, e.color_hex
     FROM emotion_logs el
     JOIN emotions e ON e.id = el.emotion_id
     WHERE el.user_id = ?
     GROUP BY el.emotion_id
     ORDER BY COUNT(*) DESC
     LIMIT 1`,
    [userId]
  );

  return {
    username: user?.username ?? "User",
    avatarUri: user?.avatar_url ?? null,
    totalPurchases: countRow?.count ?? 0,
    topEmotionName: topEmotion?.name ?? null,
    topEmotionEmoji: topEmotion?.emoji ?? null,
    topEmotionColor: topEmotion?.color_hex ?? null,
  };
}

async function saveAvatarUri(userId: string | number, uri: string) {
  const db = await getDb();
  await db.runAsync("UPDATE users SET avatar_url = ? WHERE id = ?", [uri, userId]);
}

export default function Profile() {
  const navigation = useNavigation();
  const [stats, setStats] = useState<ProfileStats | null>(null);

  const load = async () => {
    const data = await loadProfileStats(global.userID);
    setStats(data);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow access to your photo library to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      await saveAvatarUri(global.userID, uri);
      setStats((prev) => prev ? { ...prev, avatarUri: uri } : prev);
    }
  }

  function handleLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          global.userID = undefined;
          navigation.getParent()?.reset({ index: 0, routes: [{ name: "index" }] });
        },
      },
    ]);
  }

  function handleSwitchAccount() {
    Alert.alert("Switch account", "This will take you back to the login screen.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Switch",
        onPress: () => {
          global.userID = undefined;
          navigation.getParent()?.reset({ index: 0, routes: [{ name: "index" }] });
        },
      },
    ]);
  }

  const initials = stats?.username?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Avatar + name ── */}
      <View style={styles.avatarSection}>
        <Pressable style={styles.avatarWrap} onPress={handlePickPhoto}>
          {stats?.avatarUri ? (
            <Image source={{ uri: stats.avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </Pressable>
        <Text style={styles.username}>{stats?.username ?? "—"}</Text>
      </View>

      {/* ── Stats card ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.totalPurchases ?? "—"}</Text>
            <Text style={styles.statLabel}>Purchases{"\n"}registered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            {stats?.topEmotionEmoji ? (
              <>
                <Text style={styles.statEmoji}>{stats.topEmotionEmoji}</Text>
                <Text style={[styles.statEmotionName, { color: stats.topEmotionColor ?? "#888" }]}>
                  {stats.topEmotionName}
                </Text>
                <Text style={styles.statSubLabel}>top emotion ever</Text>
              </>
            ) : (
              <>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>top emotion</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── Achievements placeholder ── */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Achievements</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>coming soon</Text>
          </View>
        </View>
        <View style={styles.achievementsPlaceholder}>
          <Ionicons name="trophy-outline" size={36} color="#d4b8f0" />
          <Text style={styles.placeholderText}>Achievements are on their way</Text>
        </View>
      </View>

      {/* ── Account actions ── */}
      <View style={styles.card}>
        <Pressable style={styles.actionRow} onPress={handleSwitchAccount}>
          <View style={[styles.actionIcon, { backgroundColor: "#e8f4fd" }]}>
            <Ionicons name="swap-horizontal" size={20} color="#2196F3" />
          </View>
          <Text style={styles.actionLabel}>Switch account</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </Pressable>

        <View style={styles.actionDivider} />

        <Pressable style={styles.actionRow} onPress={handleLogout}>
          <View style={[styles.actionIcon, { backgroundColor: "#fdecea" }]}>
            <Ionicons name="log-out-outline" size={20} color="#e53935" />
          </View>
          <Text style={[styles.actionLabel, { color: "#e53935" }]}>Log out</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </Pressable>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  content: { padding: 20, paddingTop: 70 },

  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatarImage: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: "#6b21a8",
  },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "#e0c8f8",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#6b21a8",
  },
  avatarInitials: { fontSize: 32, fontFamily: "RobotoSerif_700Bold", color: "#6b21a8" },
  avatarBadge: {
    position: "absolute", bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#6b21a8",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fdf3ff",
  },
  username: { fontSize: 22, fontFamily: "RobotoSerif_700Bold", color: "#1a1a1a" },

  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontFamily: "RobotoSerif_600SemiBold", color: "#444", marginBottom: 16 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 },
  comingSoonBadge: {
    backgroundColor: "#f3e8ff", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  comingSoonText: { fontSize: 10, color: "#6b21a8", fontFamily: "RobotoSerif_500Medium" },

  statsRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 32, fontFamily: "RobotoSerif_700Bold", color: "#1a1a1a" },
  statEmoji: { fontSize: 36 },
  statEmotionName: { fontSize: 14, fontFamily: "RobotoSerif_600SemiBold", textAlign: "center" },
  statLabel: { fontSize: 12, color: "#888", textAlign: "center", fontFamily: "RobotoSerif_500Medium" },
  statSubLabel: { fontSize: 10, color: "#bbb", textAlign: "center" },
  statDivider: { width: 1, height: 60, backgroundColor: "#f0f0f0" },

  achievementsPlaceholder: {
    alignItems: "center", paddingVertical: 20, gap: 10,
  },
  placeholderText: { fontSize: 13, color: "#c4a8e0", fontFamily: "RobotoSerif_500Medium" },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4 },
  actionIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 15, fontFamily: "RobotoSerif_500Medium", color: "#333" },
  actionDivider: { height: 1, backgroundColor: "#f5f5f5", marginVertical: 10 },
});
