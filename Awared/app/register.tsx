import React, { useState } from "react";
import { Text, View, StyleSheet, Pressable, TextInput, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { getDb } from "@/database/db";

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = (pass: string) => {
    const minLength = 8;
    const hasNumber = /\d/;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;

    if (pass.length < minLength) return "Password must be at least 8 characters long.";
    if (!hasNumber.test(pass)) return "Password must contain at least one number.";
    if (!hasSpecialChar.test(pass)) return "Password must contain at least one special character.";
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
      let db = await getDb();
      let hash = btoa(password);
      
      let insert = await db.runAsync(
        "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
        [email.trim(), username.trim(), hash]
      );
      
      global.userID = insert.lastInsertRowId;
      
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error(error);
      if (error.message.includes("UNIQUE constraint failed")) {
        Alert.alert("Error", "Email or Username already exists.");
      } else {
        Alert.alert("Registration Failed", "Something went wrong.");
      }
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.mainContent}>
        
        <Text style={styles.pageTitle}>Welcome to Awared!</Text>
        
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput 
            style={styles.input} 
            placeholder="mindful@app.com" 
            placeholderTextColor="#bbb"
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none" 
            keyboardType="email-address" 
          />
          
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Your handle" 
            placeholderTextColor="#bbb"
            value={username} 
            onChangeText={setUsername} 
            autoCapitalize="none" 
          />
          
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput 
              style={styles.passwordInput} 
              placeholder="••••••••" 
              placeholderTextColor="#bbb"
              secureTextEntry={!showPassword} 
              value={password}
              onChangeText={setPassword} 
            />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Confirm Password</Text>
          <TextInput 
            style={styles.input} 
            secureTextEntry={!showPassword} 
            placeholder="••••••••" 
            placeholderTextColor="#bbb"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm} 
          />

          <Pressable style={styles.primaryButton} onPress={registerNewUser}>
            <Text style={styles.primaryButtonText}>Register</Text>
          </Pressable>
        </View>

      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/")}>
          <Text style={styles.secondaryButtonText}>Login here</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  scrollContent: { flexGrow: 1 },
  mainContent: { flex: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: 40 },
  
  pageTitle: {
    fontSize: 28, fontFamily: "RobotoSerif_700Bold", color: "#1a1a1a",
    marginBottom: 24, textAlign: "center"
  },

  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 20,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },

  inputLabel: { fontSize: 13, color: "#666", marginBottom: 6, marginLeft: 4, fontFamily: "RobotoSerif_500Medium" },
  input: {
    height: 48, width: "100%", marginBottom: 16, borderWidth: 1,
    borderColor: "#e0e0e0", borderRadius: 12, padding: 12, backgroundColor: "#fafafa",
    fontFamily: "RobotoSerif_400Regular"
  },
  
  passwordContainer: {
    flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 16,
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 12, backgroundColor: "#fafafa", paddingRight: 15
  },
  passwordInput: { flex: 1, height: 48, padding: 12, fontFamily: "RobotoSerif_400Regular" },
  toggleText: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold", fontSize: 13 },
  
  primaryButton: {
    height: 50, width: "100%", backgroundColor: "#9b72cf", borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginTop: 10
  },
  primaryButtonText: { color: "white", fontFamily: "RobotoSerif_700Bold", fontSize: 16 },

  footer: { paddingVertical: 40, justifyContent: "center", alignItems: "center", gap: 10 },
  footerText: { color: "#666", fontFamily: "RobotoSerif_400Regular" },
  secondaryButton: {
    height: 44, width: "60%", backgroundColor: "#e0c8f8", borderRadius: 12,
    justifyContent: "center", alignItems: "center"
  },
  secondaryButtonText: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold", fontSize: 15 },
});