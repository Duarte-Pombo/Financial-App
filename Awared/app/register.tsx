import React, { useState } from "react";
import {
  View,
  StyleSheet,
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

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const validatePassword = (pass: string) => {
    const minLength = 8;
    const hasNumber = /\d/;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;

    if (pass.length < minLength)
      return "Password must be at least 8 characters long.";
    if (!hasNumber.test(pass))
      return "Password must contain at least one number.";
    if (!hasSpecialChar.test(pass))
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

    setBusy(true);
    try {
      let db = await getDb();
      let hash = btoa(password);

      let insert = await db.runAsync(
        "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
        [email.trim(), username.trim(), hash],
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
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    email.trim().length > 0 &&
    username.trim().length > 0 &&
    password.length > 0 &&
    passwordConfirm.length > 0;

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
            kicker="SIGN UP"
            line1="Start taking control"
            line2="Be Awared"
          />

          <Field
            label="what should we call you"
            value={username}
            onChangeText={setUsername}
            placeholder="your handle"
            autoCapitalize="none"
          />

          <Field
            label="Email"
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
            placeholder="at least 8 characters"
            secureTextEntry
            showToggle
            showSecure={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
          />

          <Field
            label="Confirm password"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="••••••••"
            secureTextEntry
            showSecure={showPassword}
          />

          <PrimaryButton
            label="CREATE ACCOUNT"
            onPress={registerNewUser}
            disabled={!canSubmit}
            busy={busy}
          />

          <OrDivider />
          <AltSignInRow />

          <SwitchMode
            prompt="already have an account?"
            ctaLabel="log in"
            onPress={() => router.push("/")}
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
});
