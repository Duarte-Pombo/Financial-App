import React from "react";
import { View, StyleSheet, Pressable, Image, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/Text";
import { colors, fonts } from "@/constants/theme";

type TopAppBarProps = {
  avatarUri?: string | null;
  initials?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  onAvatarPress?: () => void;
};

// Fixed top app bar that mirrors the Stitch screens:
// avatar (left) · "Awared" extrabold logo (center) · optional right action.
export const TOP_APP_BAR_HEIGHT = Platform.OS === "ios" ? 92 : 76;

export function TopAppBar({
  avatarUri,
  initials = "?",
  rightIcon,
  onRightPress,
  onAvatarPress,
}: TopAppBarProps) {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.avatarBtn} onPress={onAvatarPress} disabled={!onAvatarPress}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitials}>{initials.toUpperCase()}</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.logo}>Awared</Text>

      {rightIcon && onRightPress ? (
        <Pressable style={styles.rightBtn} onPress={onRightPress}>
          <Ionicons name={rightIcon} size={22} color={colors.indigoText} />
        </Pressable>
      ) : (
        <View style={styles.rightBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 48 : 32,
    paddingBottom: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.navBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  avatarBtn: {
    width: 40,
    height: 40,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceVariant,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontFamily: fonts.bold,
    color: colors.primary,
    fontSize: 14,
  },
  logo: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    color: colors.indigoText,
    letterSpacing: -0.6,
  },
  rightBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
