import React from "react";
import { View, Text, Platform, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { withLayoutContext } from "expo-router";
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationOptions,
  MaterialTopTabNavigationEventMap,
} from "@react-navigation/material-top-tabs";
import {
  ParamListBase,
  TabNavigationState,
} from "@react-navigation/native";

const { Navigator } = createMaterialTopTabNavigator();

const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ORDER = ["index", "calendar", "addPurchase", "insights", "profile"] as const;
const TAB_META: Record<string, { idle: IconName; active: IconName; label: string; size?: number }> = {
  index: { idle: "home-outline", active: "home-sharp", label: "Home" },
  calendar: { idle: "calendar-outline", active: "calendar", label: "Calendar" },
  addPurchase: { idle: "add-circle-outline", active: "add-circle", label: "Add", size: 24 },
  insights: { idle: "stats-chart-outline", active: "stats-chart", label: "Insights" },
  profile: { idle: "person-outline", active: "person", label: "Profile" },
};

function CustomTabBar({ state, navigation }: any) {
  return (
    <View style={styles.bar}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const meta = TAB_META[route.name];
        if (!meta) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            android_ripple={null}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? meta.active : meta.idle}
                color={focused ? "#F9A8BB" : "#9CA3AF"}
                size={meta.size ?? 22}
              />
            </View>
            <Text
              style={[styles.label, { color: focused ? "#F9A8BB" : "#9CA3AF" }]}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        lazy: false,
      }}
    >
      {TAB_ORDER.map((name) => (
        <MaterialTopTabs.Screen key={name} name={name} />
      ))}
    </MaterialTopTabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    height: Platform.OS === "ios" ? 90 : 68,
    backgroundColor: "#F5F0E6",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 16,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  iconWrap: {
    width: 44,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
  },
  iconWrapActive: {
    backgroundColor: "rgba(249, 168, 187, 0.18)",
    paddingHorizontal: 12,
    width: "auto",
  },
  label: {
    fontSize: 10,
    fontFamily: "Manrope_600SemiBold",
    marginTop: -2,
  },
});
