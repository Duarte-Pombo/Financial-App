import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { Text } from "@/components/Text";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getDb } from "@/database/db";
import { colors, fonts, radii, spacing, glassCard, elevation } from "@/constants/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function attemptLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email/username and password.");
      return;
    }
    try {
      const db = await getDb();
      const hash = btoa(password);
      const user = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM users WHERE (email = ? or username = ?) AND password_hash = ?",
        [email.trim(), email.trim(), hash]
      );
      if (user != null) {
        global.userID = user.id;
        router.replace("/(tabs)");
      } else {
        Alert.alert("Login Failed", "Wrong Credentials. Please try again.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Something went wrong during login.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>Awared</Text>
        <Text style={styles.tagline}>Steady financial flow, clear mind.</Text>
      </View>

      <View style={[styles.card, glassCard]}>
        <Text style={styles.title}>Welcome back</Text>

        <Text style={styles.label}>Email or username</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. mindful@app.com"
          placeholderTextColor={colors.outline}
          value={email}
          onChangeText={setEmail}
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

        <Pressable
          onPress={() => Alert.alert("Forgot Password", "Coming soon.")}
          style={{ alignSelf: "flex-end" }}
        >
          <Text style={styles.forgot}>Forgot password?</Text>
        </Pressable>

        <Pressable onPress={attemptLogin} style={{ marginTop: spacing.md }}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Login</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New here?</Text>
        <Pressable onPress={() => router.push("/register")}>
          <Text style={styles.footerCta}>Create an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.containerMargin,
    paddingTop: 96,
    paddingBottom: 48,
    justifyContent: "space-between",
  },
  brandBlock: {
    alignItems: "center",
    gap: 8,
  },
  brand: {
    fontFamily: fonts.extrabold,
    fontSize: 40,
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
    fontSize: 24,
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
    width: "100%",
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
    width: "100%",
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
  forgot: {
    color: colors.primary,
    fontFamily: fonts.medium,
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
