import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, Alert, ScrollView } from "react-native";
import { Text } from "@/components/Text";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getDb } from "@/database/db";
import { colors, fonts, radii, spacing, glassCard, elevation } from "@/constants/theme";

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "Password must be at least 8 characters long.";
    if (!/\d/.test(pass)) return "Password must contain at least one number.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass))
      return "Password must contain at least one special character.";
    return null;
  };

  async function registerNewUser() {
    if (!email || !username || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert("Error", "Passwords don't match!");
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert("Weak Password", passwordError);
      return;
    }
    try {
      const db = await getDb();
      const hash = btoa(password);
      const insert = await db.runAsync(
        "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
        [email.trim(), username.trim(), hash]
      );
      global.userID = insert.lastInsertRowId;
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("UNIQUE constraint failed")) {
        Alert.alert("Error", "Email or Username already exists.");
      } else {
        Alert.alert("Registration Failed", "Something went wrong.");
      }
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>Awared</Text>
        <Text style={styles.tagline}>Mindful spending starts here.</Text>
      </View>

      <View style={[styles.card, glassCard]}>
        <Text style={styles.title}>Create your account</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="mindful@app.com"
          placeholderTextColor={colors.outline}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Your handle"
          placeholderTextColor={colors.outline}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.pwdRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
            placeholder="••••••••"
            placeholderTextColor={colors.outline}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)}>
            <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry={!showPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.outline}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
        />

        <Pressable onPress={registerNewUser} style={{ marginTop: spacing.sm }}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Create account</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Pressable onPress={() => router.push("/")}>
          <Text style={styles.footerCta}>Login here</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.containerMargin,
    paddingTop: 64,
    paddingBottom: 48,
    gap: spacing.lg,
  },
  brandBlock: { alignItems: "center", gap: 8 },
  brand: {
    fontFamily: fonts.extrabold,
    fontSize: 36,
    color: colors.indigoText,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: spacing.lg,
    letterSpacing: -0.32,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.outline,
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  input: {
    height: 48,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.base,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceContainerLow,
    fontFamily: fonts.regular,
    color: colors.onSurface,
    fontSize: 16,
  },
  pwdRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.base,
    backgroundColor: colors.surfaceContainerLow,
    paddingRight: 14,
  },
  toggleText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.raised,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    color: colors.onSurfaceVariant,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  footerCta: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});
