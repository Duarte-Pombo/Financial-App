import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { getDb } from "@/database/db";

export default function Settings() {
  const navigation = useNavigation();

  // Profile State
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [currency, setCurrency] = useState("€");

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Load current user data when the screen opens
  useEffect(() => {
    async function loadUserData() {
      try {
        const db = await getDb();
        // ✅ Now fetching currency_code as well
        const user = await db.getFirstAsync<{ email: string; username: string; currency_code: string }>(
          "SELECT email, username, currency_code FROM users WHERE id = ?",
          [global.userID]
        );
        if (user) {
          setEmail(user.email);
          setUsername(user.username);
          setCurrency(user.currency_code || "€"); // Fallback to € just in case
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
      }
    }
    loadUserData();
  }, []);

  async function handleUpdateProfile() {
    if (!email || !username || !currency) {
      Alert.alert("Error", "Fields cannot be empty.");
      return;
    }

    try {
      const db = await getDb();
      // ✅ Now saving the currency code to the database
      await db.runAsync(
        "UPDATE users SET email = ?, username = ?, currency_code = ? WHERE id = ?",
        [email.trim(), username.trim(), currency.trim(), global.userID]
      );
      Alert.alert("Success", "Your profile has been updated!");
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("UNIQUE constraint failed")) {
        Alert.alert("Error", "That email or username is already taken by another account.");
      } else {
        Alert.alert("Error", "Failed to update profile.");
      }
    }
  }

  async function handleCurrencyChange(newSymbol: string) {
    setCurrency(newSymbol); // Update UI instantly
    
    try {
      const db = await getDb();
      await db.runAsync(
        "UPDATE users SET currency_code = ? WHERE id = ?",
        [newSymbol.trim(), global.userID]
      );
    } catch (error) {
      console.error("Failed to auto-save currency:", error);
    }
  }

  const validatePassword = (pass: string) => {
    const minLength = 8;
    const hasNumber = /\d/;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;

    if (pass.length < minLength) return "Password must be at least 8 characters long.";
    if (!hasNumber.test(pass)) return "Password must contain at least one number.";
    if (!hasSpecialChar.test(pass)) return "Password must contain at least one special character.";
    return null;
  };

  async function handleUpdatePassword() {
    // ... (Keep your existing password logic unchanged)
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please fill in both the current and new password.");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert("Weak Password", passwordError);
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
      await db.runAsync(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        [hashNew, global.userID]
      );

      Alert.alert("Success", "Your password has been changed securely!");
      setCurrentPassword("");
      setNewPassword("");
      setShowPassword(false);
    } catch (error) {
      console.error("Failed to update password:", error);
      Alert.alert("Error", "Something went wrong while updating your password.");
    }
  }

  async function handleDeleteAccount() {
    // ... (Keep your existing delete logic unchanged)
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This will permanently delete your account and all associated data. This action cannot be undone.",
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
              console.error("Failed to delete account:", error);
              Alert.alert("Error", "Something went wrong while trying to delete your account.");
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.chromeButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={C.inkSoft} />
        </Pressable>
        <Text style={styles.pageTitle}>settings</Text>
      </View>

      {/* ── Preferences (Currency) ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferences</Text>
        <Text style={styles.inputLabel}>currency symbol</Text>

        <View style={styles.currencyRow}>
          {/* Quick Select Buttons */}
          {["€", "$", "£", "¥"].map((sym) => {
            const active = currency === sym;
            return (
              <Pressable
                key={sym}
                style={[styles.currencyBtn, active && styles.currencyBtnActive]}
                onPress={() => handleCurrencyChange(sym)}
              >
                <Text style={[styles.currencyBtnText, active && styles.currencyBtnTextActive]}>
                  {sym}
                </Text>
              </Pressable>
            );
          })}
          {/* Custom Input for other symbols */}
          <TextInput
            style={styles.currencyInput}
            value={currency}
            onChangeText={setCurrency}
            onBlur={() => handleCurrencyChange(currency)} // Auto-save on blur
            maxLength={3}
            placeholder="Other"
            placeholderTextColor={C.inkMute}
          />
        </View>
      </View>

      {/* ── Edit Profile Info ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Details</Text>

        <Text style={styles.inputLabel}>email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={C.inkMute}
        />

        <Text style={styles.inputLabel}>username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholderTextColor={C.inkMute}
        />

        <Pressable style={styles.saveButton} onPress={handleUpdateProfile}>
          <Text style={styles.saveButtonText}>Save Account Details</Text>
        </Pressable>
      </View>

      {/* ── Change Password ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Security</Text>

        <Text style={styles.inputLabel}>current password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry={!showPassword}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="••••••••"
          placeholderTextColor={C.inkMute}
        />

        <Text style={styles.inputLabel}>new password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            placeholderTextColor={C.inkMute}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
            <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.saveButton} onPress={handleUpdatePassword}>
          <Text style={styles.saveButtonText}>Update Password</Text>
        </Pressable>
      </View>

      {/* ── Danger Zone ── */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color: C.danger }]}>Danger Zone</Text>
        <Pressable style={styles.actionRow} onPress={handleDeleteAccount}>
          <View style={styles.actionIcon}>
            <Ionicons name="trash-outline" size={17} color={C.danger} />
          </View>
          <Text style={styles.actionLabel}>Delete Account</Text>
          <Ionicons name="chevron-forward" size={16} color={C.inkMute} />
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Editorial paper palette (matches Log Expense redesign) ──
const C = {
  bg: "#F5F1EA",
  panel: "#FAF6EF",
  ink: "#1F1B16",
  inkSoft: "#5E574E",
  inkMute: "#9C9489",
  rule: "rgba(31,27,22,0.10)",
  fieldBg: "rgba(31,27,22,0.02)",
  purpleDeep: "#7E64B3",
  purpleSoft: "rgba(155,130,201,0.14)",
  danger: "#C24A3A",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  chromeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    color: C.ink,
    letterSpacing: -0.3,
  },

  // Cards
  card: {
    backgroundColor: C.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.rule,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 14,
    marginBottom: 11,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    color: C.ink,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: C.inkSoft,
    marginBottom: 4,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
  },

  // Inputs
  input: {
    width: "100%",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: C.fieldBg,
    fontSize: 15,
    fontFamily: "Manrope_400Regular",
    color: C.ink,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 12,
    backgroundColor: C.fieldBg,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Manrope_400Regular",
    color: C.ink,
  },
  toggleText: {
    color: C.purpleDeep,
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
  },

  // Soft button
  saveButton: {
    width: "100%",
    paddingVertical: 11,
    backgroundColor: C.purpleSoft,
    borderWidth: 1,
    borderColor: "rgba(126,100,179,0.26)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  saveButtonText: {
    color: C.purpleDeep,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 15.5,
  },

  // Danger zone row
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 2,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,74,58,0.10)",
    borderWidth: 1,
    borderColor: "rgba(194,74,58,0.22)",
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Manrope_600SemiBold",
    color: C.danger,
  },

  // Currency row
  currencyRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  currencyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.fieldBg,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyBtnActive: {
    backgroundColor: C.purpleSoft,
    borderColor: "rgba(126,100,179,0.5)",
  },
  currencyBtnText: {
    fontSize: 19,
    color: C.inkSoft,
    fontFamily: "PlayfairDisplay_400Regular",
  },
  currencyBtnTextActive: {
    color: C.purpleDeep,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  currencyInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: C.rule,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: C.fieldBg,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "PlayfairDisplay_400Regular",
    color: C.ink,
  },
});