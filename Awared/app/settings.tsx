import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { Text } from "@/components/Text";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { getDb } from "@/database/db";
import { TopAppBar, TOP_APP_BAR_HEIGHT } from "@/components/TopAppBar";
import { colors, fonts, radii, spacing, glassCard } from "@/constants/theme";

type RowProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  sub?: string;
  onPress?: () => void;
  rightToggle?: { value: boolean; onChange: () => void };
  isLast?: boolean;
};

function Row({ icon, iconBg, iconColor, title, sub, onPress, rightToggle, isLast }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !rightToggle}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {sub && <Text style={styles.rowSub}>{sub}</Text>}
        </View>
      </View>
      {rightToggle ? (
        <Pressable onPress={rightToggle.onChange} style={styles.toggleTrack(rightToggle.value)}>
          <View style={styles.toggleThumb(rightToggle.value)} />
        </Pressable>
      ) : (
        <MaterialIcons name="chevron-right" size={22} color={colors.outlineVariant} />
      )}
    </Pressable>
  );
}

export default function Settings() {
  const navigation = useNavigation();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [smartAlerts, setSmartAlerts] = useState(true);
  const [biometric, setBiometric] = useState(false);

  // Modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingEmail, setEditingEmail] = useState("");
  const [editingUsername, setEditingUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function loadUserData() {
      try {
        const db = await getDb();
        const user = await db.getFirstAsync<{ email: string; username: string }>(
          "SELECT email, username FROM users WHERE id = ?",
          [global.userID]
        );
        if (user) {
          setEmail(user.email);
          setUsername(user.username);
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
      }
    }
    loadUserData();
  }, []);

  function openEmailModal() {
    setEditingEmail(email);
    setEditingUsername(username);
    setShowEmailModal(true);
  }

  async function handleUpdateProfile() {
    if (!editingEmail || !editingUsername) {
      Alert.alert("Error", "Email and Username cannot be empty.");
      return;
    }
    try {
      const db = await getDb();
      await db.runAsync("UPDATE users SET email = ?, username = ? WHERE id = ?", [
        editingEmail.trim(),
        editingUsername.trim(),
        global.userID,
      ]);
      setEmail(editingEmail.trim());
      setUsername(editingUsername.trim());
      setShowEmailModal(false);
      Alert.alert("Success", "Your profile has been updated!");
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("UNIQUE constraint failed")) {
        Alert.alert("Error", "That email or username is already taken.");
      } else {
        Alert.alert("Error", "Failed to update profile.");
      }
    }
  }

  function validatePassword(pass: string) {
    if (pass.length < 8) return "Password must be at least 8 characters long.";
    if (!/\d/.test(pass)) return "Password must contain at least one number.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass))
      return "Password must contain at least one special character.";
    return null;
  }

  async function handleUpdatePassword() {
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please fill in both fields.");
      return;
    }
    const err = validatePassword(newPassword);
    if (err) {
      Alert.alert("Weak Password", err);
      return;
    }
    try {
      const db = await getDb();
      const hashOld = btoa(currentPassword);
      const user = await db.getFirstAsync(
        "SELECT id FROM users WHERE id = ? AND password_hash = ?",
        [global.userID, hashOld]
      );
      if (!user) {
        Alert.alert("Error", "Your current password is incorrect.");
        return;
      }
      const hashNew = btoa(newPassword);
      await db.runAsync("UPDATE users SET password_hash = ? WHERE id = ?", [
        hashNew,
        global.userID,
      ]);
      setCurrentPassword("");
      setNewPassword("");
      setShowPassword(false);
      setShowPasswordModal(false);
      Alert.alert("Success", "Your password has been changed.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not update password.");
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This will permanently delete your account and all data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDb();
              await db.runAsync("DELETE FROM users WHERE id = ?", [global.userID]);
              global.userID = undefined;
              navigation.getParent()?.reset({ index: 0, routes: [{ name: "index" }] });
            } catch (error) {
              console.error("Failed to delete:", error);
              Alert.alert("Error", "Could not delete account.");
            }
          },
        },
      ]
    );
  }

  function handleLogout() {
    Alert.alert("Log out", "Are you sure?", [
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

  return (
    <View style={styles.container}>
      <TopAppBar rightIcon="arrow-back" onRightPress={() => router.back()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSub}>Manage your account preferences and emotional data.</Text>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>ACCOUNT</Text>
          <View style={[styles.sectionCard, glassCard]}>
            <Row
              icon="mail"
              iconBg="rgba(124,58,237,0.10)"
              iconColor={colors.primaryContainer}
              title="Email Address"
              sub={email || "—"}
              onPress={openEmailModal}
            />
            <Row
              icon="lock"
              iconBg="rgba(124,58,237,0.10)"
              iconColor={colors.primaryContainer}
              title="Password"
              sub="Update your security credentials"
              onPress={() => setShowPasswordModal(true)}
            />
            <Row
              icon="payments"
              iconBg="rgba(124,58,237,0.10)"
              iconColor={colors.primaryContainer}
              title="Currency"
              sub="EUR (€)"
              onPress={() => Alert.alert("Currency", "Currency settings coming soon")}
              isLast
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>NOTIFICATIONS</Text>
          <View style={[styles.sectionCard, glassCard]}>
            <Row
              icon="notifications-active"
              iconBg="rgba(180,19,109,0.10)"
              iconColor={colors.secondary}
              title="Smart Alerts"
              sub="Spending patterns and mood nudges"
              rightToggle={{ value: smartAlerts, onChange: () => setSmartAlerts((v) => !v) }}
              isLast
            />
          </View>
        </View>

        {/* Privacy & Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.tertiary }]}>PRIVACY & SECURITY</Text>
          <View style={[styles.sectionCard, glassCard]}>
            <Row
              icon="shield"
              iconBg="rgba(95,65,129,0.10)"
              iconColor={colors.tertiary}
              title="Data Privacy"
              sub="Control how your emotional data is used"
              onPress={() => Alert.alert("Data Privacy", "Coming soon")}
            />
            <Row
              icon="fingerprint"
              iconBg="rgba(95,65,129,0.10)"
              iconColor={colors.tertiary}
              title="Biometric Login"
              sub="Use FaceID or TouchID"
              rightToggle={{ value: biometric, onChange: () => setBiometric((v) => !v) }}
              isLast
            />
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>SUPPORT</Text>
          <View style={[styles.sectionCard, glassCard]}>
            <Row
              icon="help"
              iconBg={colors.surfaceVariant}
              iconColor={colors.onSurfaceVariant}
              title="Help Center"
              sub="FAQs and contact support"
              onPress={() => Alert.alert("Help", "Coming soon")}
            />
            <Row
              icon="info"
              iconBg={colors.surfaceVariant}
              iconColor={colors.onSurfaceVariant}
              title="About Awared"
              sub="Version 1.0.0"
              onPress={() => Alert.alert("Awared", "Mindful Finance · v1.0.0")}
              isLast
            />
          </View>
        </View>

        {/* Log out */}
        <Pressable style={[styles.logoutBtn, glassCard]} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        {/* Danger zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.error }]}>DANGER ZONE</Text>
          <View style={[styles.sectionCard, glassCard, { borderColor: colors.errorContainer }]}>
            <Row
              icon="delete-forever"
              iconBg={colors.errorContainer}
              iconColor={colors.error}
              title="Delete Account"
              sub="Permanently remove your account"
              onPress={handleDeleteAccount}
              isLast
            />
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Email modal */}
      <Modal visible={showEmailModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowEmailModal(false)} />
          <View style={[styles.modalSheet, glassCard]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Account Details</Text>

            <Text style={styles.modalLabel}>Email</Text>
            <TextInput
              style={styles.modalInput}
              value={editingEmail}
              onChangeText={setEditingEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.outline}
            />

            <Text style={styles.modalLabel}>Username</Text>
            <TextInput
              style={styles.modalInput}
              value={editingUsername}
              onChangeText={setEditingUsername}
              autoCapitalize="none"
              placeholderTextColor={colors.outline}
            />

            <Pressable style={styles.modalSaveBtn} onPress={handleUpdateProfile}>
              <Text style={styles.modalSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Password modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPasswordModal(false)} />
          <View style={[styles.modalSheet, glassCard]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.modalLabel}>Current Password</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry={!showPassword}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholderTextColor={colors.outline}
            />

            <Text style={styles.modalLabel}>New Password</Text>
            <View style={styles.modalPwdWrap}>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholderTextColor={colors.outline}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)}>
                <Text style={styles.toggleShow}>{showPassword ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>

            <Pressable style={styles.modalSaveBtn} onPress={handleUpdatePassword}>
              <Text style={styles.modalSaveText}>Update Password</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: TOP_APP_BAR_HEIGHT + spacing.md,
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: 60,
    gap: spacing.lg,
  },

  headerSection: {
    gap: spacing.sm,
  },
  pageTitle: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.onSurface,
    letterSpacing: -0.32,
  },
  pageSub: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },

  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    letterSpacing: 1.4,
    paddingLeft: spacing.xs,
  },
  sectionCard: {
    borderRadius: radii.lg,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.onSurface,
  },
  rowSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },

  // Toggle (custom switch)
  toggleTrack: ((on: boolean) => ({
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: on ? colors.secondary : colors.surfaceVariant,
    justifyContent: "center" as const,
    paddingHorizontal: 2,
  })) as any,
  toggleThumb: ((on: boolean) => ({
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignSelf: on ? "flex-end" : "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  })) as any,

  logoutBtn: {
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.errorContainer,
  },
  logoutText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.error,
    letterSpacing: 0.14,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(21,28,39,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: spacing.lg,
  },
  modalLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.outline,
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  modalInput: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.base,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  modalPwdWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.base,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  toggleShow: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  modalSaveText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.onPrimary,
    letterSpacing: 0.14,
  },
});
