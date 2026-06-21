import { View, Text } from "react-native";
import FailingTokenRow from "./FailingTokenRow";
import GlassCard from "./GlassCard";
import type { FailingToken } from "../stores/useVocabularyStore";

interface FailingTokensListProps {
  tokens: FailingToken[];
}

export default function FailingTokensList({ tokens }: FailingTokensListProps) {
  if (tokens.length === 0) {
    return (
      <View className="px-6 py-8 items-center">
        <Text className="text-neutral-600 text-sm">No failing tokens yet</Text>
      </View>
    );
  }

  return (
    <View className="px-6">
      <Text className="text-xl font-medium text-neutral-900 mb-3">
        Failing Tokens
      </Text>
      <GlassCard style={{ padding: 0 }}>
        {tokens.map((token, index) => (
          <View
            key={token.id}
            className={index < tokens.length - 1 ? "border-b border-neutral-100" : ""}
          >
            <FailingTokenRow token={token} />
          </View>
        ))}
      </GlassCard>
    </View>
  );
}
