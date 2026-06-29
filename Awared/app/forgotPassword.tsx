import React, { useMemo, useState } from "react";
import * as Crypto from "expo-crypto";
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { getDb } from "@/database/db";
import { Field, PrimaryButton, Headline } from "@/components/AuthForm";
import { useTheme } from "@/context/ThemeContext";
import { ThemeColors } from "@/theme/theme";
import Svg, { Path } from "react-native-svg";

export default function ForgotPassword() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [identifier, setIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleReset() {
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match.");
      return;
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert("Weak password", passwordError);
      return;
    }
    if (!identifier.trim() || !newPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setBusy(true);
    try {
      const db = await getDb();
      const user = await db.getFirstAsync<{ id: number; email: string }>(
        "SELECT id, email FROM users WHERE email = ? OR username = ?",
        [identifier.trim(), identifier.trim()]
      );
      if (!user) {
        Alert.alert("Not found", "No account with that email or username.");
        setBusy(false);
        return;
      }

      const salt = user.email.toLowerCase();
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        newPassword + salt
      );

      await db.runAsync(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        [hash, user.id]
      );
      Alert.alert("Done", "Password updated! You can now log in.", [
        { text: "Log in", onPress: () => router.replace("/") },
      ]);
    } catch (e) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "Password must be at least 8 characters long.";
    if (!/\d/.test(pass)) return "Password must contain at least one number.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return "Password must contain at least one special character.";
    return null;
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 6l-6 6 6 6"
                stroke={C.ink}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>

          <Headline
            kicker="ACCOUNT RECOVERY"
            line1="Reset your"
            line2="password."
          />

          <Field
            label="Email or username"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you@somewhere.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Field
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="at least 8 characters"
            secureTextEntry
            showToggle
            showSecure={showPassword}
            onToggleShow={() => setShowPassword(s => !s)}
          />

          <Field
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            showSecure={showPassword}
          />

          <PrimaryButton
            label="RESET PASSWORD"
            onPress={handleReset}
            disabled={!identifier.trim() || !newPassword || !confirmPassword || busy}
            busy={busy}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 16,
  },
  form: {
    paddingHorizontal: 28,
  },
  backBtn: {
    marginBottom: 8,
    alignSelf: "flex-start",
    padding: 4,
  },
});