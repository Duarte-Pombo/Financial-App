import React, { useState } from "react";
import { Text, View, StyleSheet, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    const success = await login(email, password);
    if (success) {
      router.replace("/(tabs)");
    } else {
      alert("Invalid credentials");
    }
  };

  return (
    <View style={{ flex: 1, flexDirection: "column" }}>
      <View style={{ flex: 1, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, marginBottom: 25 }}>Welcome Back!</Text>
        <TextInput
          style={styles.input}
          placeholder="Email or Username"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry={true}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.button} onPress={handleLogin}>
          <Text style={{ textAlign: "center" }}>Login</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 / 4, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Text>New here?</Text>
        <Pressable style={styles.button} onPress={() => router.push("/register")}>
          <Text style={{ textAlign: "center" }}>Register</Text>
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
