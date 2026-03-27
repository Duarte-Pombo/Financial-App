import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

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
          bottom: 50,
          left: 70,
          right: 70,
          height: 60,
          borderRadius: 15,
          backgroundColor: "#e8d5f5",
          borderTopWidth: 0,
          shadowColor: "#9b72cf",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "home-sharp" : "home-outline"}
              color={focused ? "#6b21a8" : "#c4a8e0"}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="addPurchase"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "add-circle" : "add-circle-outline"}
              color={focused ? "#6b21a8" : "#c4a8e0"}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              color={focused ? "#6b21a8" : "#c4a8e0"}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "newspaper" : "newspaper-outline"}
              color={focused ? "#6b21a8" : "#c4a8e0"}
              size={22}
            />
          ),
        }}
      />
    </Tabs>
  );
}
