import React, { useState } from "react";
import { Text, View, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { router } from "expo-router";
import { getDb } from "@/database/db";

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
      let db = await getDb();
      let hash = btoa(password); 
      
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
      <View style={styles.mainContent}>
        
        <Text style={styles.pageTitle}>Welcome Back!</Text>
        
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Email or Username</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. mindful@app.com" 
            placeholderTextColor="#bbb"
            value={email}
            onChangeText={setEmail}
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

          <Pressable onPress={() => Alert.alert("Forgot Password", "Password recovery coming soon.")}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={attemptLogin}>
            <Text style={styles.primaryButtonText}>Login</Text>
          </Pressable>
        </View>

      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New here?</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/register")}>
          <Text style={styles.secondaryButtonText}>Create an Account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  mainContent: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  
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
    flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 8,
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 12, backgroundColor: "#fafafa", paddingRight: 15
  },
  passwordInput: { flex: 1, height: 48, padding: 12, fontFamily: "RobotoSerif_400Regular" },
  toggleText: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold", fontSize: 13 },
  
  forgotPasswordText: { color: "#6b21a8", alignSelf: "flex-end", marginBottom: 24, fontSize: 13, fontFamily: "RobotoSerif_500Medium" },
  
  primaryButton: {
    height: 50, width: "100%", backgroundColor: "#9b72cf", borderRadius: 12,
    justifyContent: "center", alignItems: "center"
  },
  primaryButtonText: { color: "white", fontFamily: "RobotoSerif_700Bold", fontSize: 16 },

  footer: { paddingBottom: 40, justifyContent: "center", alignItems: "center", gap: 10 },
  footerText: { color: "#666", fontFamily: "RobotoSerif_400Regular" },
  secondaryButton: {
    height: 44, width: "60%", backgroundColor: "#e0c8f8", borderRadius: 12,
    justifyContent: "center", alignItems: "center"
  },
  secondaryButtonText: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold", fontSize: 15 },
});