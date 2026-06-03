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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
      </Pressable>

      <Text style={styles.pageTitle}>Settings</Text>

      {/* ── Preferences (Currency) ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferences</Text>
        <Text style={styles.inputLabel}>Currency Symbol</Text>
        
        <View style={styles.currencyRow}>
          {/* Quick Select Buttons */}
          {["€", "$", "£", "¥"].map((sym) => (
            <Pressable 
              key={sym} 
              style={[styles.currencyBtn, currency === sym && styles.currencyBtnActive]}
              onPress={() => handleCurrencyChange(sym)}
            >
              <Text style={[styles.currencyBtnText, currency === sym && styles.currencyBtnTextActive]}>
                {sym}
              </Text>
            </Pressable>
          ))}
          {/* Custom Input for other symbols */}
          <TextInput 
            style={styles.currencyInput} 
            value={currency} 
            onChangeText={setCurrency} 
            onBlur={() => handleCurrencyChange(currency)} // Auto-save on blur
            maxLength={3}
            placeholder="Other"
            placeholderTextColor="#ccc"
          />
        </View>
      </View>

      {/* ── Edit Profile Info ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Details</Text>
        
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput 
          style={styles.input} 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none" 
          keyboardType="email-address"
        />

        <Text style={styles.inputLabel}>Username</Text>
        <TextInput 
          style={styles.input} 
          value={username} 
          onChangeText={setUsername} 
          autoCapitalize="none"
        />

        <Pressable style={styles.saveButton} onPress={handleUpdateProfile}>
          <Text style={styles.saveButtonText}>Save Account Details</Text>
        </Pressable>
      </View>

      {/* ── Change Password ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Security</Text>
        {/* ... (Keep your existing password fields unchanged) ... */}
        <Text style={styles.inputLabel}>Current Password</Text>
        <TextInput style={styles.input} secureTextEntry={!showPassword} value={currentPassword} onChangeText={setCurrentPassword} />
        <Text style={styles.inputLabel}>New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput style={styles.passwordInput} secureTextEntry={!showPassword} value={newPassword} onChangeText={setNewPassword} />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.saveButton} onPress={handleUpdatePassword}>
          <Text style={styles.saveButtonText}>Update Password</Text>
        </Pressable>
      </View>

      {/* ── Danger Zone ── */}
      <View style={[styles.card, { borderColor: "#fdecea", borderWidth: 1 }]}>
        <Text style={[styles.cardTitle, { color: "#e53935" }]}>Danger Zone</Text>
        <Pressable style={styles.actionRow} onPress={handleDeleteAccount}>
          <View style={[styles.actionIcon, { backgroundColor: "#fdecea" }]}>
            <Ionicons name="trash-outline" size={20} color="#e53935" />
          </View>
          <Text style={[styles.actionLabel, { color: "#e53935" }]}>Delete Account</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ... (Keep your existing styles) ...
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  content: { padding: 20, paddingTop: 60 },
  backButton: { width: 40, height: 40, backgroundColor: "#fff", borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, },
  pageTitle: { fontSize: 28, fontFamily: "RobotoSerif_700Bold", color: "#1a1a1a", marginBottom: 24, },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, },
  cardTitle: { fontSize: 16, fontFamily: "RobotoSerif_600SemiBold", color: "#444", marginBottom: 16 },
  inputLabel: { fontSize: 13, color: "#666", marginBottom: 6, marginLeft: 4, fontFamily: "RobotoSerif_500Medium" },
  input: { height: 48, width: "100%", marginBottom: 16, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 12, padding: 12, backgroundColor: "#fafafa" },
  passwordContainer: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 16, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 12, backgroundColor: "#fafafa", paddingRight: 15 },
  passwordInput: { flex: 1, height: 48, padding: 12 },
  toggleText: { color: "#9b72cf", fontWeight: "bold" },
  saveButton: { height: 44, width: "100%", backgroundColor: "#e0c8f8", borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 4 },
  saveButtonText: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold", fontSize: 15 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4 },
  actionIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 15, fontFamily: "RobotoSerif_500Medium", color: "#333" },

  // ✅ New styles for the currency row
  currencyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "center"
  },
  currencyBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
  },
  currencyBtnActive: {
    backgroundColor: "#e0c8f8",
    borderColor: "#9b72cf",
  },
  currencyBtnText: {
    fontSize: 18,
    color: "#666",
    fontFamily: "RobotoSerif_500Medium",
  },
  currencyBtnTextActive: {
    color: "#6b21a8",
    fontFamily: "RobotoSerif_700Bold",
  },
  currencyInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fafafa",
    textAlign: "center",
    fontSize: 18,
    fontFamily: "RobotoSerif_500Medium",
    color: "#333"
  }
});