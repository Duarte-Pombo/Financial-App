import React from "react";
import { View, Text, Platform, StyleSheet, Pressable } from "react-native";
import { BlurView } from "expo-blur";
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
import { useTheme } from "@/context/ThemeContext";
import { ThemeColors } from "@/theme/theme";

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
  const { colors: C, isDark } = useTheme();
  const styles = React.useMemo(() => makeStyles(C, isDark), [C, isDark]);
  const activeColor = C.purpleDeep;
  const idleColor = C.inkMute;
  return (
    <View style={styles.barWrap} pointerEvents="box-none">
      <View style={styles.pill}>
        <BlurView
          intensity={Platform.OS === "ios" ? 60 : 80}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glassTint} pointerEvents="none" />
        <View style={styles.glassHighlight} pointerEvents="none" />
        <View style={styles.glassBorder} pointerEvents="none" />

        <View style={styles.row}>
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
                    color={focused ? activeColor : idleColor}
                    size={meta.size ?? 22}
                  />
                </View>
                <Text
                  style={[
                    styles.label,
                    { color: focused ? activeColor : idleColor },
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors: C } = useTheme();
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <CustomTabBar {...props} />}
      style={{ backgroundColor: C.bg }}
      sceneContainerStyle={{ backgroundColor: C.bg }}
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

const PILL_HEIGHT = 64;
const PILL_RADIUS = PILL_HEIGHT / 2;

const makeStyles = (C: ThemeColors, isDark: boolean) => StyleSheet.create({
  barWrap: {
    height: Platform.OS === "ios" ? 96 : 84,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    backgroundColor: "transparent",
    alignItems: "stretch",
    justifyContent: "flex-end",
  },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    overflow: "hidden",
    backgroundColor: isDark
      ? Platform.OS === "android"
        ? "rgba(33,27,21,0.78)"
        : "rgba(33,27,21,0.45)"
      : Platform.OS === "android"
        ? "rgba(255,255,255,0.55)"
        : "rgba(255,255,255,0.28)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.3 : 0.12,
    shadowRadius: 24,
    elevation: 18,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.18)",
  },
  glassHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: PILL_HEIGHT / 2,
    borderTopLeftRadius: PILL_RADIUS,
    borderTopRightRadius: PILL_RADIUS,
    backgroundColor: isDark ? "rgba(255,255,255,0.00)" : "rgba(255,255,255,0.22)",
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.55)",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    overflow: "hidden",
  },
  iconWrapActive: {
    backgroundColor: C.purpleSoft,
  },
  label: {
    fontSize: 10,
    fontFamily: "Manrope_600SemiBold",
    marginTop: 1,
  },
});
