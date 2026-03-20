import { Tabs } from "expo-router";
import IonIcons from "@expo/vector-icons/Ionicons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '000',
        headerStyle: {
          backgroundColor: '#fdf3ff',
        },
        headerShadowVisible: false,
        headerTintColor: '#000',
        tabBarStyle: {
          backgroundColor: '#fdf3ff',
        },

      }}
    >
      <Tabs.Screen name="index" options={{
        title: 'Home',
        tabBarIcon: ({ color, focused }) => (
          <IonIcons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
        )
      }} />
    </Tabs>

  )
}
