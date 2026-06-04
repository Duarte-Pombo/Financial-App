import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Image,
  Platform,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { Text } from "@/components/Text";
import {
  EmotionGlyph,
  emotionColor,
  hasEmotionGlyph,
} from "@/components/EmotionGlyph";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { getDb } from "@/database/db";
import { router, useFocusEffect } from "expo-router";

// ─── Editorial paper palette (matches Home / Insights design system) ──────────
const C = {
  bg: "#F5F1EA",
  panel: "#FAF6EF",
  ink: "#1F1B16",
  inkSoft: "#5E574E",
  inkMute: "#9C9489",
  rule: "rgba(31,27,22,0.10)",
  ruleSoft: "rgba(31,27,22,0.06)",
  purple: "#9B82C9",
  purpleDeep: "#7E64B3",
  danger: "#C24A3A",
};

const FONT = {
  displayItalic: "PlayfairDisplay_700Bold_Italic",
  serif: "PlayfairDisplay_400Regular",
  labelItalic: "PlayfairDisplay_400Regular_Italic",
  sans: "Manrope_500Medium",
  sansSemi: "Manrope_600SemiBold",
  mono: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
};

type ProfileStats = {
  username: string;
  avatarUri: string | null;
  totalPurchases: number;
  topEmotionName: string | null;
  topEmotionEmoji: string | null;
  topEmotionColor: string | null;
  memberSince: string | null;
};

// ─── Count-up easing (mirrors the design's Home/Profile animation) ────────────
function useCountUp(target: number, ms = 850): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(eased * target);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function formatMemberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const mon = d.toLocaleString("en-US", { month: "short" }).toLowerCase();
  return `member since · ${mon} ${d.getFullYear()}`;
}

async function loadProfileStats(userId: string | number): Promise<ProfileStats> {
  const db = await getDb();

  const user = await db.getFirstAsync<{
    username: string;
    avatar_url: string | null;
    created_at: string | null;
  }>(
    "SELECT username, avatar_url, created_at FROM users WHERE id = ?",
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
    memberSince: formatMemberSince(user?.created_at),
  };
}

async function saveAvatarUri(userId: string | number, uri: string) {
  const db = await getDb();
  await db.runAsync("UPDATE users SET avatar_url = ? WHERE id = ?", [uri, userId]);
}

// ─── Line-art icons (thin editorial strokes, matching the design) ─────────────
function GearIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.2} stroke={C.inkSoft} strokeWidth={1.5} />
      <Path
        d="M12 2.6 L12 5 M12 19 L12 21.4 M21.4 12 L19 12 M5 12 L2.6 12 M18.6 5.4 L17 7 M7 17 L5.4 18.6 M18.6 18.6 L17 17 M7 7 L5.4 5.4"
        stroke={C.inkSoft}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CameraIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8 L7 8 L9 5.5 L15 5.5 L17 8 L20 8 L20 18 L4 18 Z"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12.5} r={3.1} stroke="#fff" strokeWidth={1.8} />
    </Svg>
  );
}

function TrophyIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4 L17 4 L17 9 A5 5 0 0 1 7 9 Z"
        stroke={C.purple}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 5 L4 5 L4 7 A3 3 0 0 0 7 10 M17 5 L20 5 L20 7 A3 3 0 0 1 17 10"
        stroke={C.purple}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 14 L12 17 M9 20 L15 20 M10 17 L14 17"
        stroke={C.purple}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SwapIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8 L17 8 M14 5 L17 8 L14 11 M20 16 L7 16 M10 13 L7 16 L10 19"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LogoutIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 4 L6 4 L6 20 L14 20 M10 12 L20 12 M16 8 L20 12 L16 16"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6 L15 12 L9 18"
        stroke={C.inkMute}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Account action row ───────────────────────────────────────────────────────
function ActionRow({
  icon,
  label,
  danger,
  last,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionRow, !last && styles.actionRowDivider]}
    >
      <View
        style={[
          styles.actionIcon,
          {
            backgroundColor: danger ? "rgba(194,74,58,0.10)" : "rgba(126,100,179,0.10)",
            borderColor: danger ? "rgba(194,74,58,0.22)" : "rgba(126,100,179,0.22)",
          },
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.actionLabel, danger && { color: C.danger }]}>{label}</Text>
      <ChevronIcon />
    </Pressable>
  );
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

  const initials = stats?.username?.slice(0, 2).toUpperCase() ?? "··";
  const ringColor = stats?.topEmotionName
    ? stats.topEmotionColor ?? emotionColor(stats.topEmotionName)
    : C.purple;
  const animatedCount = Math.round(useCountUp(stats?.totalPurchases ?? 0));

  return (
    <View style={[styles.container, styles.content]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>profile</Text>
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push("/settings")}
          accessibilityLabel="settings"
        >
          <GearIcon />
        </Pressable>
      </View>

      {/* ── Avatar + identity ── */}
      <View style={styles.identity}>
        <Pressable style={styles.avatarWrap} onPress={handlePickPhoto}>
          {stats?.avatarUri ? (
            <Image
              source={{ uri: stats.avatarUri }}
              style={[styles.avatar, { borderColor: ringColor }]}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { borderColor: ringColor }]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <CameraIcon />
          </View>
        </Pressable>
        <Text style={styles.username}>{stats?.username ?? "—"}</Text>
        {stats?.memberSince && (
          <Text style={styles.memberSince}>{stats.memberSince}</Text>
        )}
      </View>

      {/* ── Your stats ── */}
      <View style={styles.card}>
        <Text style={styles.eyebrow}>YOUR STATS</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{animatedCount}</Text>
            <Text style={styles.statLabel}>purchases{"\n"}registered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            {stats?.topEmotionName ? (
              <>
                <View
                  style={[
                    styles.emotionBubble,
                    {
                      backgroundColor: (stats.topEmotionColor ?? emotionColor(stats.topEmotionName)) + "1F",
                      borderColor: (stats.topEmotionColor ?? emotionColor(stats.topEmotionName)) + "55",
                    },
                  ]}
                >
                  {hasEmotionGlyph(stats.topEmotionName) ? (
                    <EmotionGlyph
                      emotion={stats.topEmotionName}
                      color={stats.topEmotionColor ?? emotionColor(stats.topEmotionName)}
                      size={22}
                    />
                  ) : (
                    <Text style={{ fontSize: 18 }}>{stats.topEmotionEmoji}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.emotionName,
                    { color: stats.topEmotionColor ?? emotionColor(stats.topEmotionName) },
                  ]}
                >
                  {stats.topEmotionName}
                </Text>
                <Text style={styles.statLabel}>top emotion ever</Text>
              </>
            ) : (
              <>
                <Text style={styles.statNumber}>—</Text>
                <Text style={styles.statLabel}>top emotion</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── Achievements (coming soon) ── */}
      <View style={styles.card}>
        <View style={styles.cardLabelRow}>
          <Text style={styles.eyebrow}>ACHIEVEMENTS</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>coming soon</Text>
          </View>
        </View>
        <View style={styles.achievementsPlaceholder}>
          <TrophyIcon />
          <Text style={styles.placeholderText}>your milestones are on their way</Text>
        </View>
      </View>

      {/* ── Account actions ── */}
      <View style={[styles.card, styles.cardFlush]}>
        <ActionRow
          icon={<SwapIcon color={C.purpleDeep} />}
          label="Switch account"
          onPress={handleSwitchAccount}
        />
        <ActionRow
          icon={<LogoutIcon color={C.danger} />}
          label="Log out"
          danger
          last
          onPress={handleLogout}
        />
      </View>

      <View style={{ height: 104 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 20 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  headerTitle: {
    fontFamily: FONT.displayItalic,
    fontSize: 28,
    letterSpacing: -0.3,
    color: C.ink,
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
  },

  // Identity
  identity: { alignItems: "center", paddingTop: 14, paddingBottom: 6 },
  avatarWrap: { position: "relative", width: 112, height: 112 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
  },
  avatarPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(155,130,201,0.16)",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontFamily: FONT.displayItalic,
    fontSize: 38,
    color: C.purpleDeep,
    letterSpacing: 0.5,
  },
  avatarBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.purple,
    borderWidth: 2,
    borderColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    fontFamily: FONT.displayItalic,
    fontSize: 26,
    letterSpacing: -0.3,
    color: C.ink,
    marginTop: 14,
  },
  memberSince: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: C.inkMute,
    marginTop: 4,
  },

  // Card shell
  card: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 18,
    padding: 18,
    marginTop: 14,
  },
  cardFlush: { padding: 0, overflow: "hidden" },

  eyebrow: {
    fontFamily: FONT.sans,
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: C.inkMute,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  cardLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  comingSoonBadge: {
    backgroundColor: "rgba(126,100,179,0.10)",
    borderWidth: 1,
    borderColor: "rgba(126,100,179,0.28)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 12,
  },
  comingSoonText: {
    fontFamily: FONT.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: C.purpleDeep,
    textTransform: "uppercase",
  },

  // Stats
  statsRow: { flexDirection: "row", alignItems: "stretch" },
  statItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  statNumber: {
    fontFamily: FONT.serif,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1,
    color: C.ink,
  },
  statLabel: {
    fontFamily: FONT.labelItalic,
    fontSize: 13.5,
    color: C.inkSoft,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  statDivider: { width: 1, backgroundColor: C.rule },
  emotionBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emotionName: {
    fontFamily: FONT.displayItalic,
    fontSize: 22,
    lineHeight: 24,
    textTransform: "capitalize",
  },

  // Achievements
  achievementsPlaceholder: {
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    paddingBottom: 4,
  },
  placeholderText: {
    fontFamily: FONT.displayItalic,
    fontSize: 16,
    color: C.purpleDeep,
    textAlign: "center",
  },

  // Account actions
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  actionRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.ruleSoft,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontFamily: FONT.sansSemi,
    fontSize: 15,
    color: C.ink,
  },
});
