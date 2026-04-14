import React from "react";
import { Text, View, StyleSheet, Pressable, TextInput } from "react-native";
import { navigate } from "expo-router/build/global-state/routing";
import { getDb } from "@/database/db";

export default function Login() {
  let email: string;
  let username: string;
  let password: string;
  let passwordConfirm: string;
  return (
    <View style={{ flex: 1, flexDirection: "column" }}>
      <View style={{ flex: 1, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, marginBottom: 25 }}>Welcome to Awared!</Text>
        <TextInput style={styles.input} placeholder="Email" onChangeText={(value) => email = value} />
        <TextInput style={styles.input} placeholder="Username" onChangeText={(value) => username = value} />
        <TextInput style={styles.input} secureTextEntry={true} placeholder="Password" onChangeText={(value) => password = value} />
        <TextInput style={styles.input} secureTextEntry={true} placeholder="Confirm Password" onChangeText={(value) => passwordConfirm = value} />
        <Pressable style={styles.button} onPress={() => registerNewUser(email, username, password, passwordConfirm)}>
          <Text style={{ textAlign: "center" }}>Register</Text>
        </Pressable>

      </View>
      <View style={{ flex: 1 / 4, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Text>Already have an account?</Text>
        <Pressable style={styles.button} onPress={gotoLogin}>
          <Text style={{ textAlign: "center" }}>Login</Text>
        </Pressable>
      </View>
    </View>
  );
}

async function registerNewUser(email: string, username: string, password: string, passwordConfirm: string): Promise<void> {
  if (password != passwordConfirm) {
    alert("Passwords don't match!");
    return;
  }
  if (password == undefined) {
    alert("Password cannot be empty!");
    return;
  }
  let db = await getDb();
  let hash = btoa(password)
  await db.runAsync(
    "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
    [email, username, hash]
  );
  navigate("/(tabs)");
}

function gotoLogin() {
  navigate("/");
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
