import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "./context/AuthContext";
import { apiFetch } from "@/api";
import {
  AUTH_C,
  Field,
  PrimaryButton,
  OrDivider,
  AltSignInRow,
  SwitchMode,
  Headline,
} from "@/components/AuthForm";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function attemptLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setBusy(true);
    try {
      const data = await apiFetch<{
        ok: boolean;
        token: string;
        userId: string;
        username: string;
        currency_code: string;
      }>("/api/users/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      await login({ userId: data.userId, token: data.token, username: data.username, currency_code: data.currency_code });
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("[login]", error);
      if (error.message?.includes("401") || error.message?.includes("Invalid")) {
        Alert.alert("Login Failed", "Wrong credentials. Please try again.");
      } else {
        Alert.alert("Error", "Something went wrong during login.");
      }
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0;

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
          <Headline
            kicker="WELCOME BACK — LOG IN"
            line1="Good to see"
            line2="you again."
          />

          <Field
            label="Email or username"
            value={email}
            onChangeText={setEmail}
            placeholder="you@somewhere.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            showToggle
            showSecure={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
          />

          <View style={styles.forgotRow}>
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Forgot Password",
                  "Password recovery coming soon.",
                )
              }
              hitSlop={6}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </Pressable>
          </View>

          <PrimaryButton
            label="LOG IN"
            onPress={attemptLogin}
            disabled={!canSubmit}
            busy={busy}
          />

          <OrDivider />
          <AltSignInRow />

          <SwitchMode
            prompt="New here?"
            ctaLabel="Sign up"
            onPress={() => router.push("/register")}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH_C.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 16,
  },
  form: {
    paddingHorizontal: 28,
  },
  forgotRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 10,
  },
  forgotText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 13,
    color: AUTH_C.inkSoft,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(31,27,22,0.25)",
    paddingBottom: 1,
  },
});
