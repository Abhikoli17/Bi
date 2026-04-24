import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function DatasetDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0a", padding: 24 }}>
      <Text style={{ color: "#fff", fontSize: 24 }}>Dataset Detail</Text>
      <Text style={{ color: "#999", marginTop: 12 }}>ID: {id}</Text>
    </View>
  );
}