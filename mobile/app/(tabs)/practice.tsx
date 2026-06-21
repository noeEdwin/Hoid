import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import GlassDock from "../../components/GlassDock";

export default function PracticeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <StatusBar style="dark" />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-6xl mb-4">🎙️</Text>
        <Text className="text-2xl font-bold text-neutral-900 mb-2">
          练习
        </Text>
        <Text className="text-base text-neutral-600 text-center">
          Roleplay & Shadowing
        </Text>
        <Text className="text-sm text-neutral-600/60 mt-1">Coming Soon</Text>
      </View>
      <GlassDock />
    </SafeAreaView>
  );
}
