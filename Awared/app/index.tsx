import React from "react";
import { Text, View, StyleSheet, Pressable, TextInput } from "react-native";
import { navigate } from "expo-router/build/global-state/routing";
import { getDb } from "@/database/db";

export default function Login() {
  let email: string;
  let password: string;
  return (
    <View style={{ flex: 1, flexDirection: "column" }}>
      <View style={{ flex: 1, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, marginBottom: 25 }}>Welcome Back!</Text>
        <TextInput style={styles.input} placeholder="Email or Username" onChangeText={(value) => email = value} />
        <TextInput style={styles.input} placeholder="Password" secureTextEntry={true} onChangeText={(value) => password = value} />
        <Pressable style={styles.button} onPress={() => attemptLogin(email, password)}>
          <Text style={{ textAlign: "center" }}>Login</Text>
        </Pressable>

      </View>
      <View style={{ flex: 1 / 4, flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Text>New here?</Text>
        <Pressable style={styles.button} onPress={gotoRegister}>
          <Text style={{ textAlign: "center" }}>Register</Text>
        </Pressable>
      </View>
    </View>
  );
}

async function attemptLogin(email: string, password: string): Promise<void> {
  let db = await getDb();
  let hash = btoa(password);
  const user = await db.getFirstAsync(
    "SELECT email, username, password_hash FROM users WHERE (email = ? or username = ?) AND password_hash = ?",
    [email, email, hash]
  );
  if (user != null)
    navigate("/(tabs)");
  else alert("Wrong Credentials");
}

function gotoRegister() {
  navigate("/register");
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
