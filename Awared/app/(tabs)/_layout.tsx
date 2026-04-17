import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import React from "react";

type IconProps = { focused: boolean; name: [string, string]; size?: number };

function TabIcon({ focused, name, size = 28 }: IconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={focused ? name[0] : name[1]}
        color={focused ? "#6b21a8" : "#c4a8e0"}
        size={size}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#6b21a8",
        tabBarInactiveTintColor: "#c4a8e0",
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: Platform.OS === "ios" ? 85 : 72,
          backgroundColor: "#f3e8ff",
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: "#9b72cf",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 16,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          paddingTop: 10,
        },
        tabBarItemStyle: {
          height: "100%",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name={["home-sharp", "home-outline"]} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name={["calendar", "calendar-outline"]} />
          ),
        }}
      />
      <Tabs.Screen
        name="addPurchase"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name={["add-circle", "add-circle-outline"]} size={32} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name={["newspaper", "newspaper-outline"]} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name={["person", "person-outline"]} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 52,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  iconWrapActive: {
    backgroundColor: "#e0c8f8",
  },
});
