import React, { useState } from "react";
import { Text, View, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (password !== passwordConfirm) {
      alert("Passwords don't match!");
      return;
    }
    if (!password) {
      alert("Password cannot be empty!");
      return;
    }
    const success = await register(email, username, password);
    if (success) {
      router.replace("/(tabs)");
    } else {
      alert("Registration failed. Email or username may already exist.");
    }
  };

  return (
    <View style={{ flex: 1, flexDirection: "column" }}>
      <View style={{ flex: 1, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, marginBottom: 25 }}>Welcome to Awared!</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          secureTextEntry={true}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          secureTextEntry={true}
          placeholder="Confirm Password"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
        />
        <Pressable style={styles.button} onPress={handleRegister}>
          <Text style={{ textAlign: "center" }}>Register</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 / 4, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Text>Already have an account?</Text>
        <Pressable style={styles.button} onPress={() => router.push("/")}>
          <Text style={{ textAlign: "center" }}>Login</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 50,
    width: "80%",
    margin: 10,
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
  },
  button: {
    height: 40,
    width: "40%",
    margin: 12,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
    backgroundColor: "pink",
  }
});
