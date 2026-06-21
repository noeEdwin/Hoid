import { View, Text } from "react-native";

interface CategoryTagProps {
  type: string;
  count: number;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Particles: { bg: "bg-primary/10", text: "text-primary" },
  Verbs: { bg: "bg-secondary/10", text: "text-secondary" },
  Nouns: { bg: "bg-tertiary/10", text: "text-tertiary" },
  Adjectives: { bg: "bg-primary/10", text: "text-primary" },
  Pronouns: { bg: "bg-secondary/10", text: "text-secondary" },
  Expressions: { bg: "bg-tertiary/10", text: "text-tertiary" },
};

export default function CategoryTag({ type, count }: CategoryTagProps) {
  const colors = TYPE_COLORS[type] || { bg: "bg-neutral-200", text: "text-neutral-700" };

  return (
    <View className={`${colors.bg} px-4 py-2 rounded-2xl mr-2`}>
      <Text className={`${colors.text} text-sm font-medium`}>
        {type}{" "}
        <Text className="opacity-60">{count}</Text>
      </Text>
    </View>
  );
}
