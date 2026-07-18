import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import GlassDock from "../../components/GlassDock";
import { fetchSrsHealth, type ApiSrsHealth } from "../../lib/api";
import { formatReviewInterval } from "../../lib/srs";

export default function ProgressScreen() {
  const [health, setHealth] = useState<ApiSrsHealth | null>(null);
  const [error, setError] = useState("");

  const loadHealth = useCallback(async () => {
    try {
      setError("");
      setHealth(await fetchSrsHealth());
    } catch {
      setError("无法加载服务器 SRS 数据");
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHealth(); }, [loadHealth]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
        <Text className="text-3xl font-bold text-neutral-900 mb-1">SRS 健康</Text>
        <Text className="text-sm text-neutral-500 mb-5">服务器时区：{health?.timezone ?? "加载中"}</Text>
        {error ? <Text className="text-red-600 mb-4">{error}</Text> : null}
        {health ? (
          <>
            <View className="flex-row flex-wrap gap-3 mb-5">
              {[
                ["今日到期", health.due_today],
                ["明日到期", health.due_tomorrow],
                ["已排程", health.scheduled_cards],
                ["未排程旧卡", health.unscheduled_reviewed_cards],
              ].map(([label, value]) => (
                <View key={String(label)} className="bg-white rounded-2xl p-4 w-[47%]">
                  <Text className="text-2xl font-bold text-primary">{value}</Text>
                  <Text className="text-neutral-600 mt-1">{label}</Text>
                </View>
              ))}
            </View>
            <Text className="text-lg font-semibold text-neutral-900 mb-3">最难的到期卡片</Text>
            {health.hardest_due.map((card) => (
              <View key={card.flashcard_id} className="bg-white rounded-2xl p-4 mb-2">
                <Text className="text-lg text-neutral-900">{card.answer}</Text>
                <Text className="text-sm text-neutral-500" numberOfLines={1}>{card.sentence}</Text>
                <Text className="text-xs text-neutral-500 mt-2">难度 {card.difficulty_score.toFixed(3)} · 失败 {card.total_failures} · 间隔 {formatReviewInterval(card.srs_interval)}</Text>
              </View>
            ))}
            <Text className="text-lg font-semibold text-neutral-900 mt-5 mb-3">最近复习</Text>
            {health.recently_reviewed.map((card) => (
              <View key={`${card.flashcard_id}-recent`} className="bg-white rounded-2xl p-4 mb-2">
                <Text className="text-neutral-900">{card.answer} · {card.total_reviews} 次</Text>
                <Text className="text-xs text-neutral-500 mt-1">
                  下次：{card.next_review_at ? new Date(card.next_review_at).toLocaleString() : "立即"}
                </Text>
              </View>
            ))}
            <Pressable onPress={loadHealth} className="bg-primary rounded-2xl py-3 items-center mt-4">
              <Text className="text-white font-semibold">刷新</Text>
            </Pressable>
          </>
        ) : <Text className="text-neutral-500">正在加载 SRS 数据...</Text>}
      </ScrollView>
      <GlassDock />
    </SafeAreaView>
  );
}
