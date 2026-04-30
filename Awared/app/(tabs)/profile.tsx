import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Image } from "react-native";
import { Text } from "@/components/Text";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { getDb } from "@/database/db";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { TopAppBar, TOP_APP_BAR_HEIGHT } from "@/components/TopAppBar";
import { colors, fonts, radii, spacing, glassCard, elevation } from "@/constants/theme";

type ProfileStats = {
  username: string;
  avatarUri: string | null;
  totalPurchases: number;
  totalAmount: number;
  topEmotionName: string | null;
  topEmotionEmoji: string | null;
  topEmotionColor: string | null;
  topEmotionPct: number;
  memberSince: string;
};

async function loadProfileStats(userId: string | number): Promise<ProfileStats> {
  const db = await getDb();

  const user = await db.getFirstAsync<{
    username: string;
    avatar_url: string | null;
    created_at: string;
  }>("SELECT username, avatar_url, created_at FROM users WHERE id = ?", [userId]);

  const countRow = await db.getFirstAsync<{ count: number; total: number }>(
    "SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type != 'refunded'",
    [userId]
  );

  const topEmotion = await db.getFirstAsync<{
    name: string;
    emoji: string;
    color_hex: string;
    cnt: number;
    total: number;
  }>(
    `SELECT e.name, e.emoji, e.color_hex, COUNT(*) as cnt,
            (SELECT COUNT(*) FROM emotion_logs WHERE user_id = ?) as total
     FROM emotion_logs el
     JOIN emotions e ON e.id = el.emotion_id
     WHERE el.user_id = ?
     GROUP BY el.emotion_id
     ORDER BY cnt DESC
     LIMIT 1`,
    [userId, userId]
  );

  const memberDate = user?.created_at ? new Date(user.created_at) : new Date();
  const memberSince = `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][memberDate.getMonth()]} ${memberDate.getFullYear()}`;

  const pct =
    topEmotion && topEmotion.total > 0
      ? Math.round((topEmotion.cnt / topEmotion.total) * 100)
      : 0;

  return {
    username: user?.username ?? "User",
    avatarUri: user?.avatar_url ?? null,
    totalPurchases: countRow?.count ?? 0,
    totalAmount: countRow?.total ?? 0,
    topEmotionName: topEmotion?.name ?? null,
    topEmotionEmoji: topEmotion?.emoji ?? null,
    topEmotionColor: topEmotion?.color_hex ?? null,
    topEmotionPct: pct,
    memberSince,
  };
}

async function saveAvatarUri(userId: string | number, uri: string) {
  const db = await getDb();
  await db.runAsync("UPDATE users SET avatar_url = ? WHERE id = ?", [uri, userId]);
}

export default function Profile() {
  const navigation = useNavigation();
  const [stats, setStats] = useState<ProfileStats | null>(null);

  const load = useCallback(async () => {
    const data = await loadProfileStats(global.userID);
    setStats(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Allow access to your photo library to set a profile picture."
      );
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

  const initials = stats?.username?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <View style={styles.container}>
      <TopAppBar avatarUri={stats?.avatarUri ?? null} initials={initials} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* ── Profile Header (gradient avatar ring) ── */}
        <View style={styles.profileHeader}>
          <Pressable onPress={handlePickPhoto}>
            <LinearGradient
              colors={[colors.primary, colors.secondaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                {stats?.avatarUri ? (
                  <Image source={{ uri: stats.avatarUri }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
              </View>
              <View style={styles.editBadge}>
                <MaterialIcons name="edit" size={14} color={colors.primary} />
              </View>
            </LinearGradient>
          </Pressable>
          <Text style={styles.username}>{stats?.username ?? "—"}</Text>
          <Text style={styles.memberSince}>Member since {stats?.memberSince ?? "—"}</Text>
        </View>

        {/* ── Yearly Summary Bento ── */}
        <Text style={styles.sectionTitle}>Yearly Summary</Text>
        <View style={styles.bentoRow}>
          {/* Total Spent */}
          <View style={[styles.bentoCard, glassCard, { overflow: "hidden" }]}>
            <View style={styles.bentoBlobPrimary} />
            <View style={styles.bentoCardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: "rgba(124,58,237,0.1)" }]}>
                <MaterialIcons name="account-balance-wallet" size={20} color={colors.primary} />
              </View>
              <Text style={styles.bentoCardLabel}>Total Spent</Text>
            </View>
            <View>
              <Text style={styles.bentoCardValue}>€{stats?.totalAmount.toFixed(0) ?? 0}</Text>
              <View style={styles.deltaRow}>
                <MaterialIcons name="trending-up" size={14} color={colors.secondary} />
                <Text style={styles.deltaText}>{stats?.totalPurchases ?? 0} purchases</Text>
              </View>
            </View>
          </View>

          {/* Dominant Emotion */}
          <View style={[styles.bentoCard, glassCard, { overflow: "hidden" }]}>
            <View style={styles.bentoBlobSecondary} />
            <View style={styles.bentoCardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: "rgba(180,19,109,0.1)" }]}>
                <MaterialIcons name="mood" size={20} color={colors.secondary} />
              </View>
              <Text style={styles.bentoCardLabel}>Dominant Emotion</Text>
            </View>
            <View style={styles.emotionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.emotionName}>{stats?.topEmotionName ?? "—"}</Text>
                <Text style={styles.deltaText}>
                  {stats?.topEmotionPct ?? 0}% of entries
                </Text>
              </View>
              <View
                style={[
                  styles.emotionBubble,
                  {
                    backgroundColor: stats?.topEmotionColor
                      ? `${stats.topEmotionColor}33`
                      : "rgba(180,19,109,0.1)",
                  },
                ]}
              >
                <Text style={{ fontSize: 28 }}>{stats?.topEmotionEmoji ?? "🌊"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Menu list (Achievements / Trends / Settings) ── */}
        <View style={{ gap: spacing.sm }}>
          <Pressable style={[styles.menuRow, glassCard]} onPress={() => Alert.alert("Coming soon")}>
            <View style={[styles.menuIcon, { backgroundColor: colors.tertiaryFixed }]}>
              <MaterialIcons name="military-tech" size={20} color={colors.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>My Achievements</Text>
              <Text style={styles.menuSub}>View your milestones and badges</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
          </Pressable>

          <Pressable
            style={[styles.menuRow, glassCard]}
            onPress={() => router.push("/(tabs)/insights")}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.primaryFixed }]}>
              <MaterialIcons name="monitor" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Emotional Trends</Text>
              <Text style={styles.menuSub}>Deep dive into your emotional data</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
          </Pressable>

          <Pressable style={[styles.menuRow, glassCard]} onPress={() => router.push("/settings")}>
            <View style={[styles.menuIcon, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialIcons name="manage-accounts" size={20} color={colors.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Account Settings</Text>
              <Text style={styles.menuSub}>Manage profile and preferences</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
          </Pressable>

          <Pressable style={[styles.menuRow, glassCard]} onPress={handleLogout}>
            <View style={[styles.menuIcon, { backgroundColor: colors.errorContainer }]}>
              <MaterialIcons name="logout" size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuTitle, { color: colors.error }]}>Log out</Text>
              <Text style={styles.menuSub}>You can come back any time</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
          </Pressable>
        </View>

        {/* ── Premium CTA banner ── */}
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumBanner}
        >
          <View style={styles.premiumBlob1} />
          <View style={styles.premiumBlob2} />
          <View style={styles.premiumContent}>
            <View style={styles.premiumHeaderRow}>
              <MaterialIcons name="star" size={20} color="#fde047" />
              <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
            </View>
            <Text style={styles.premiumSub}>
              Unlock advanced insights, custom emotional trackers, and export features.
            </Text>
            <Pressable
              style={styles.premiumCta}
              onPress={() => Alert.alert("Premium", "Coming soon")}
            >
              <Text style={styles.premiumCtaText}>Get Premium</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: TOP_APP_BAR_HEIGHT + spacing.md,
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: 60,
  },

  // Profile header
  profileHeader: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatarRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.raised,
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 64,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: colors.surface,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontFamily: fonts.extrabold,
    fontSize: 36,
    color: colors.primary,
  },
  editBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.card,
  },
  username: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.onSurface,
    marginTop: spacing.md,
    letterSpacing: -0.32,
  },
  memberSince: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.outline,
    marginTop: 4,
  },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },

  // Bento row
  bentoRow: {
    gap: spacing.gutter,
    marginBottom: spacing.lg,
  },
  bentoCard: {
    borderRadius: radii.base,
    padding: spacing.md,
    overflow: "hidden",
  },
  bentoBlobPrimary: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.primaryFixedDim,
    opacity: 0.5,
  },
  bentoBlobSecondary: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.secondaryFixedDim,
    opacity: 0.5,
  },
  bentoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bentoCardLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  bentoCardValue: {
    fontFamily: fonts.extrabold,
    fontSize: 40,
    color: colors.onSurface,
    letterSpacing: -0.8,
    lineHeight: 46,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  deltaText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.outline,
  },
  emotionRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  emotionName: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.onSurface,
    letterSpacing: -0.32,
    marginBottom: 4,
  },
  emotionBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // Menu rows
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.base,
    gap: spacing.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
    letterSpacing: 0.14,
  },
  menuSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.outline,
    marginTop: 2,
  },

  // Premium banner
  premiumBanner: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    overflow: "hidden",
    ...elevation.raised,
  },
  premiumBlob1: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  premiumBlob2: {
    position: "absolute",
    bottom: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  premiumContent: {
    gap: spacing.md,
  },
  premiumHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  premiumTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.onPrimary,
  },
  premiumSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20,
  },
  premiumCta: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  premiumCtaText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.14,
  },
});
