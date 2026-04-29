import React, { useState } from "react";
import { Text, View, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { router } from "expo-router"; // Use router for better navigation
import { getDb } from "@/database/db";

export default function Login() {
  // 1. Use State to store input values reliably
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
      // Note: btoa is Base64 encoding, not a true secure hash (like bcrypt), 
      // but we are keeping it to match your current database setup.
      let hash = btoa(password); 
      
      const user = await db.getFirstAsync(
        "SELECT id, email, username, password_hash FROM users WHERE (email = ? or username = ?) AND password_hash = ?",
        [email, email, hash]
      );

      if (user != null) {
        global.userID = user.id;
        console.log("UserID: " + global.userID);
        router.replace("/(tabs)"); // replace prevents the user from swiping back to login
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
        <Text style={styles.title}>Welcome Back!</Text>
        
        <TextInput 
          style={styles.input} 
          placeholder="Email or Username" 
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        
        <View style={styles.passwordContainer}>
          <TextInput 
            style={styles.passwordInput} 
            placeholder="Password" 
            secureTextEntry={!showPassword} 
            value={password}
            onChangeText={setPassword} 
          />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => Alert.alert("Forgot Password", "Password recovery is not implemented yet.")}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={attemptLogin}>
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text>New here?</Text>
        <Pressable style={styles.buttonSecondary} onPress={() => router.push("/register")}>
          <Text style={styles.buttonText}>Register</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  mainContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 30, color: "#333" },
  input: {
    height: 50, width: "100%", marginVertical: 10, borderWidth: 1,
    borderColor: "#ccc", borderRadius: 10, padding: 15, backgroundColor: "#fff"
  },
  passwordContainer: {
    flexDirection: "row", alignItems: "center", width: "100%", marginVertical: 10,
    borderWidth: 1, borderColor: "#ccc", borderRadius: 10, backgroundColor: "#fff", paddingRight: 15
  },
  passwordInput: { flex: 1, height: 50, padding: 15 },
  toggleText: { color: "#9b72cf", fontWeight: "bold" },
  forgotPasswordText: { color: "#9b72cf", alignSelf: "flex-end", marginTop: 5, marginBottom: 20 },
  button: {
    height: 50, width: "100%", backgroundColor: "#9b72cf", borderRadius: 10,
    justifyContent: "center", alignItems: "center", marginTop: 10
  },
  buttonSecondary: {
    height: 40, width: "50%", backgroundColor: "pink", borderRadius: 10,
    justifyContent: "center", alignItems: "center", marginTop: 10
  },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  footer: { flex: 0.2, justifyContent: "center", alignItems: "center" }
});