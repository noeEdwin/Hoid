import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { normalize, Dimens } from "../../lib/dimens";

export default function SettingsScreen() {
  const router = useRouter();
  const dailyReviewLimit = useSettingsStore((s) => s.dailyReviewLimit);
  const setDailyReviewLimit = useSettingsStore((s) => s.setDailyReviewLimit);

  const [limitText, setLimitText] = useState(String(dailyReviewLimit));

  const handleSave = () => {
    const num = parseInt(limitText, 10);
    if (!isNaN(num)) {
      setDailyReviewLimit(num);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>设置</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>复习设置</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>每日复习上限</Text>
                <Text style={styles.rowHint}>每张卡片显示的每日最大数量</Text>
              </View>
              <View style={styles.rowRight}>
                <TextInput
                  style={styles.input}
                  value={limitText}
                  onChangeText={setLimitText}
                  onBlur={handleSave}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.unit}>张</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Dimens.padding,
    paddingVertical: Dimens.gap,
  },
  backBtn: {
    paddingVertical: 8,
    width: 60,
  },
  backText: {
    fontSize: normalize(16),
    color: "#757575",
  },
  title: {
    fontSize: normalize(17),
    fontWeight: "600",
    color: "#1b1b1f",
  },
  content: {
    paddingHorizontal: Dimens.padding,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: normalize(13),
    fontWeight: "600",
    color: "#757575",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8e8ed",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: normalize(16),
    color: "#1b1b1f",
  },
  rowHint: {
    fontSize: normalize(13),
    color: "#757575",
    marginTop: 2,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    backgroundColor: "#f9f9ff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: normalize(16),
    fontWeight: "600",
    color: "#1b1b1f",
    width: 56,
    textAlign: "center",
  },
  unit: {
    fontSize: normalize(15),
    color: "#757575",
    marginLeft: 4,
  },
});
