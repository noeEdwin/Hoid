import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassDock from "../../components/GlassDock";
import { useNavigateOnce } from "../../lib/useNavigateOnce";

export default function PracticeScreen() {
  const router = useRouter();
  const navigateOnce = useNavigateOnce();

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>SPEAKING LAB</Text>
        <Text style={styles.title}>练习</Text>
        <Text style={styles.subtitle}>把学过的词，变成真正说得出口的中文。</Text>

        <Pressable
          onPress={() => navigateOnce(() => router.push("/roleplay"))}
          accessibilityRole="button"
          accessibilityLabel="进入角色扮演"
          style={({ pressed }) => [styles.cardShadow, pressed && styles.cardPressed]}
        >
          <LinearGradient
            colors={["#0a67c8", "#5d39d8", "#8424ba"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.roleplayCard}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.iconGlass}>
                <Ionicons name="chatbubbles" size={28} color="white" />
              </View>
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>可开始</Text>
              </View>
            </View>
            <View>
              <Text style={styles.cardKicker}>AI ROLEPLAY</Text>
              <Text style={styles.cardTitle}>角色扮演</Text>
              <Text style={styles.cardDescription}>
                在餐馆、酒店和街头场景中，用你的困难词完成真实对话。
              </Text>
            </View>
            <View style={styles.cardAction}>
              <Text style={styles.cardActionText}>选择场景</Text>
              <Ionicons name="arrow-forward" size={19} color="white" />
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.shadowingCard}>
          <View style={styles.shadowingIcon}>
            <Ionicons name="pulse" size={25} color="#895100" />
          </View>
          <View style={styles.shadowingCopy}>
            <Text style={styles.shadowingTitle}>跟读训练</Text>
            <Text style={styles.shadowingDescription}>对比声调曲线，打磨发音节奏。</Text>
          </View>
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>即将推出</Text>
          </View>
        </View>

        <View style={styles.tipRow}>
          <Ionicons name="sparkles-outline" size={17} color="#005bbd" />
          <Text style={styles.tipText}>每次对话都会优先练习你最容易忘记的词。</Text>
        </View>
      </ScrollView>
      <GlassDock />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f9f9ff", flex: 1 },
  content: { paddingBottom: 140, paddingHorizontal: 24, paddingTop: 36 },
  orbOne: {
    backgroundColor: "rgba(118,34,229,0.08)",
    borderRadius: 130,
    height: 260,
    left: -100,
    position: "absolute",
    top: -70,
    width: 260,
  },
  orbTwo: {
    backgroundColor: "rgba(0,91,189,0.07)",
    borderRadius: 140,
    height: 280,
    position: "absolute",
    right: -150,
    top: 300,
    width: 280,
  },
  eyebrow: { color: "#005bbd", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#172438", fontSize: 38, fontWeight: "700", marginTop: 6 },
  subtitle: { color: "#646879", fontSize: 16, lineHeight: 24, marginTop: 8, maxWidth: 310 },
  cardShadow: {
    borderRadius: 28,
    elevation: 10,
    marginTop: 34,
    shadowColor: "#3c35a4",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
  },
  cardPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  roleplayCard: { borderRadius: 28, minHeight: 318, overflow: "hidden", padding: 24 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between" },
  iconGlass: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 18,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  availableBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 99,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  availableDot: { backgroundColor: "#84f5b0", borderRadius: 4, height: 7, width: 7 },
  availableText: { color: "white", fontSize: 12, fontWeight: "700" },
  cardKicker: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "800", letterSpacing: 1.8, marginTop: 34 },
  cardTitle: { color: "white", fontSize: 31, fontWeight: "700", marginTop: 4 },
  cardDescription: { color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 23, marginTop: 10, maxWidth: 310 },
  cardAction: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 24 },
  cardActionText: { color: "white", fontSize: 15, fontWeight: "700" },
  shadowingCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.74)",
    borderColor: "white",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 18,
    padding: 18,
  },
  shadowingIcon: { alignItems: "center", backgroundColor: "#fff2d8", borderRadius: 15, height: 48, justifyContent: "center", width: 48 },
  shadowingCopy: { flex: 1, marginLeft: 13 },
  shadowingTitle: { color: "#30323a", fontSize: 16, fontWeight: "700" },
  shadowingDescription: { color: "#777984", fontSize: 12, lineHeight: 18, marginTop: 3 },
  soonBadge: { backgroundColor: "#f0edf5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  soonText: { color: "#77717d", fontSize: 10, fontWeight: "700" },
  tipRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 22, paddingHorizontal: 4 },
  tipText: { color: "#646879", flex: 1, fontSize: 12, lineHeight: 18 },
});
