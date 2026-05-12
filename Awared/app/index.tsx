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
import { getDb } from "@/database/db";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function attemptLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email/username and password.");
      return;
    }

    setBusy(true);
    try {
      let db = await getDb();
      let hash = btoa(password);

      const user = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM users WHERE (email = ? or username = ?) AND password_hash = ?",
        [email.trim(), email.trim(), hash],
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
