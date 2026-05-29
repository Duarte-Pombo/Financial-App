import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
  Animated,
} from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { getDb } from "@/database/db";
import { router, useFocusEffect } from "expo-router";
import {
  loadAchievements,
  runAchievementEngine,
  AchievementWithStatus,
  ACHIEVEMENT_DEFS,
} from "@/database/achievementEngine";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

type ProfileStats = {
  username: string;
  avatarUri: string | null;
  totalPurchases: number;
  topEmotionName: string | null;
  topEmotionEmoji: string | null;
  topEmotionColor: string | null;
};

// ─────────────────────────────────────────────────────────────
//  DATA LOADERS
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
//  ACHIEVEMENT CARD COMPONENT
// ─────────────────────────────────────────────────────────────

function AchievementCard({ item }: { item: AchievementWithStatus }) {
  const hasProgress = item.progress !== undefined && !item.unlocked;

  return (
    <View style={[styles.achievementCard, !item.unlocked && styles.achievementCardLocked]}>
      {/* Emoji badge */}
      <View style={[styles.achievementEmojiBadge, !item.unlocked && styles.achievementEmojiBadgeLocked]}>
        <Text style={[styles.achievementEmoji, !item.unlocked && { opacity: 0.3 }]}>
          {item.emoji}
        </Text>
        {item.unlocked && (
          <View style={styles.unlockedCheckmark}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>

      {/* Text */}
      <View style={styles.achievementTextWrap}>
        <Text style={[styles.achievementTitle, !item.unlocked && styles.achievementTitleLocked]}>
          {item.title}
        </Text>
        <Text style={[styles.achievementDesc, !item.unlocked && styles.achievementDescLocked]}>
          {item.description}
        </Text>

        {/* Progress bar for countable achievements */}
        {hasProgress && (
          <View style={styles.progressBarWrap}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${item.progress}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>
              {item.current}/{item.target}
            </Text>
          </View>
        )}
      </View>

      {/* Status tag */}
      {item.unlocked ? (
        <View style={styles.unlockedBadge}>
          <Text style={styles.unlockedBadgeText}>✓</Text>
        </View>
      ) : (
        <View style={styles.lockedBadge}>
          <Ionicons name="lock-closed" size={12} color="#c4a8e0" />
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function Profile() {
  const navigation = useNavigation();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [achievementsExpanded, setAchievementsExpanded] = useState(false);

  const load = useCallback(async () => {
    const [data] = await Promise.all([loadProfileStats(global.userID)]);
    setStats(data);

    // Run engine (unlocks newly earned), then load display state
    await runAchievementEngine(global.userID);
    const all = await loadAchievements(global.userID);
    // Sort: unlocked first, then by definition order
    const sorted = [
      ...all.filter((a) => a.unlocked),
      ...all.filter((a) => !a.unlocked),
    ];
    setAchievements(sorted);
  }, []);

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
      setStats((prev) => (prev ? { ...prev, avatarUri: uri } : prev));
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
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = ACHIEVEMENT_DEFS.length;

  // Show first 4 by default, all when expanded
  const visibleAchievements = achievementsExpanded ? achievements : achievements.slice(0, 4);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Settings Button ── */}
      <Pressable style={styles.settingsButton} onPress={() => router.push("/settings")}>
        <Ionicons name="settings-outline" size={26} color="#1a1a1a" />
      </Pressable>

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

      {/* ── Achievements ── */}
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.achievementsHeader}>
          <View>
            <Text style={styles.cardTitle}>Achievements</Text>
            <Text style={styles.achievementsSubtitle}>
              {unlockedCount} of {totalCount} unlocked
            </Text>
          </View>
          {/* Overall progress ring (simple pill) */}
          <View style={styles.achievementsPillWrap}>
            <View style={styles.achievementsPill}>
              <View
                style={[
                  styles.achievementsPillFill,
                  { width: `${Math.round((unlockedCount / totalCount) * 100)}%` as any },
                ]}
              />
            </View>
            <Text style={styles.achievementsPillText}>
              {Math.round((unlockedCount / totalCount) * 100)}%
            </Text>
          </View>
        </View>

        {/* Achievement list */}
        {achievements.length === 0 ? (
          <View style={styles.achievementsEmpty}>
            <Ionicons name="trophy-outline" size={36} color="#d4b8f0" />
            <Text style={styles.placeholderText}>Start logging to earn achievements!</Text>
          </View>
        ) : (
          <>
            {visibleAchievements.map((item) => (
              <AchievementCard key={item.id} item={item} />
            ))}

            {achievements.length > 4 && (
              <Pressable
                style={styles.expandButton}
                onPress={() => setAchievementsExpanded((v) => !v)}
              >
                <Text style={styles.expandButtonText}>
                  {achievementsExpanded
                    ? "Show less"
                    : `Show all ${totalCount} achievements`}
                </Text>
                <Ionicons
                  name={achievementsExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#6b21a8"
                />
              </Pressable>
            )}
          </>
        )}
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

// ─────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  content: { padding: 20, paddingTop: 70 },

  settingsButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },

  // ── Avatar ──────────────────────────────────────────────────
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: "#6b21a8" },
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

  // ── Cards ───────────────────────────────────────────────────
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontFamily: "RobotoSerif_600SemiBold", color: "#444", marginBottom: 4 },

  // ── Stats ───────────────────────────────────────────────────
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 32, fontFamily: "RobotoSerif_700Bold", color: "#1a1a1a" },
  statEmoji: { fontSize: 36 },
  statEmotionName: { fontSize: 14, fontFamily: "RobotoSerif_600SemiBold", textAlign: "center" },
  statLabel: { fontSize: 12, color: "#888", textAlign: "center", fontFamily: "RobotoSerif_500Medium" },
  statSubLabel: { fontSize: 10, color: "#bbb", textAlign: "center" },
  statDivider: { width: 1, height: 60, backgroundColor: "#f0f0f0" },

  // ── Achievements header ─────────────────────────────────────
  achievementsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  achievementsSubtitle: {
    fontSize: 12,
    color: "#aaa",
    fontFamily: "RobotoSerif_400Regular",
    marginTop: 2,
  },
  achievementsPillWrap: { alignItems: "flex-end", gap: 4 },
  achievementsPill: {
    width: 80,
    height: 6,
    backgroundColor: "#f0e6ff",
    borderRadius: 3,
    overflow: "hidden",
  },
  achievementsPillFill: {
    height: "100%",
    backgroundColor: "#9b72cf",
    borderRadius: 3,
  },
  achievementsPillText: {
    fontSize: 11,
    color: "#9b72cf",
    fontFamily: "RobotoSerif_600SemiBold",
  },

  // ── Achievement card ─────────────────────────────────────────
  achievementCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f0ff",
    gap: 12,
  },
  achievementCardLocked: {
    opacity: 0.55,
  },
  achievementEmojiBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#f3e8ff",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  achievementEmojiBadgeLocked: {
    backgroundColor: "#f5f5f5",
  },
  achievementEmoji: { fontSize: 22 },
  unlockedCheckmark: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#4caf50",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  achievementTextWrap: { flex: 1 },
  achievementTitle: {
    fontSize: 14,
    fontFamily: "RobotoSerif_600SemiBold",
    color: "#2a2a2a",
    marginBottom: 2,
  },
  achievementTitleLocked: { color: "#999" },
  achievementDesc: {
    fontSize: 12,
    fontFamily: "RobotoSerif_400Regular",
    color: "#666",
    lineHeight: 17,
  },
  achievementDescLocked: { color: "#bbb" },

  // Progress bar inside achievement card
  progressBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: "#f0e6ff",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#9b72cf",
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 10,
    color: "#9b72cf",
    fontFamily: "RobotoSerif_600SemiBold",
    minWidth: 28,
    textAlign: "right",
  },

  // Status badges
  unlockedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  unlockedBadgeText: {
    fontSize: 12,
    color: "#4caf50",
    fontFamily: "RobotoSerif_700Bold",
  },
  lockedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty + expand
  achievementsEmpty: { alignItems: "center", paddingVertical: 20, gap: 10 },
  placeholderText: { fontSize: 13, color: "#c4a8e0", fontFamily: "RobotoSerif_500Medium" },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  expandButtonText: {
    fontSize: 14,
    color: "#6b21a8",
    fontFamily: "RobotoSerif_600SemiBold",
  },

  // ── Account actions ─────────────────────────────────────────
  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4 },
  actionIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 15, fontFamily: "RobotoSerif_500Medium", color: "#333" },
  actionDivider: { height: 1, backgroundColor: "#f5f5f5", marginVertical: 10 },
});