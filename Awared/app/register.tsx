import React, { useState } from "react";
import { Text, View, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { router } from "expo-router";
import { getDb } from "@/database/db";

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Password Security Validation
  const validatePassword = (pass: string) => {
    const minLength = 8;
    const hasNumber = /\d/;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;

    if (pass.length < minLength) return "Password must be at least 8 characters long.";
    if (!hasNumber.test(pass)) return "Password must contain at least one number.";
    if (!hasSpecialChar.test(pass)) return "Password must contain at least one special character.";
    return null; // Null means it passed validation
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
      console.log("UserID:" + global.userID);
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
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <Text style={styles.title}>Welcome to Awared!</Text>
        
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        
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

        <TextInput 
          style={styles.input} 
          secureTextEntry={!showPassword} 
          placeholder="Confirm Password" 
          value={passwordConfirm}
          onChangeText={setPasswordConfirm} 
        />

        <Pressable style={styles.button} onPress={registerNewUser}>
          <Text style={styles.buttonText}>Register</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text>Already have an account?</Text>
        <Pressable style={styles.buttonSecondary} onPress={() => router.push("/")}>
          <Text style={styles.buttonText}>Login</Text>
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
    height: 50, width: "100%", marginVertical: 8, borderWidth: 1,
    borderColor: "#ccc", borderRadius: 10, padding: 15, backgroundColor: "#fff"
  },
  passwordContainer: {
    flexDirection: "row", alignItems: "center", width: "100%", marginVertical: 8,
    borderWidth: 1, borderColor: "#ccc", borderRadius: 10, backgroundColor: "#fff", paddingRight: 15
  },
  passwordInput: { flex: 1, height: 50, padding: 15 },
  toggleText: { color: "#9b72cf", fontWeight: "bold" },
  button: {
    height: 50, width: "100%", backgroundColor: "#9b72cf", borderRadius: 10,
    justifyContent: "center", alignItems: "center", marginTop: 20
  },
  buttonSecondary: {
    height: 40, width: "50%", backgroundColor: "pink", borderRadius: 10,
    justifyContent: "center", alignItems: "center", marginTop: 10
  },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  footer: { flex: 0.2, justifyContent: "center", alignItems: "center" }
});