/*import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function DatasetDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0a", padding: 24 }}>
      <Text style={{ color: "#fff", fontSize: 24 }}>Dataset Detail</Text>
      <Text style={{ color: "#999", marginTop: 12 }}>ID: {id}</Text>
    </View>
  );
}*/

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { apiCall } from "../../utils/api";

export default function DatasetDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuthStore();
  const [dataset, setDataset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && token) loadDataset();
  }, [id, token]);

  const loadDataset = async () => {
    try {
      const data = await apiCall(`/api/datasets/${id}`, {}, token);
      setDataset(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (!dataset) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Dataset not found</Text>
      </View>
    );
  }

  const rows = dataset.data || [];
  const columns = dataset.columns || [];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{dataset.name}</Text>
      <Text style={styles.meta}>{dataset.row_count} rows • {columns.length} columns</Text>

      <ScrollView horizontal>
        <View>
          <View style={styles.row}>
            {columns.map((col: any) => (
              <Text key={col.name} style={[styles.cell, styles.headerCell]}>
                {col.name}
              </Text>
            ))}
          </View>

          {rows.slice(0, 50).map((row: any, index: number) => (
            <View key={index} style={styles.row}>
              {columns.map((col: any) => (
                <Text key={col.name} style={styles.cell}>
                  {String(row[col.name] ?? "")}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  center: { flex: 1, backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center" },
  title: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  meta: { color: "#999", marginTop: 8, marginBottom: 20 },
  text: { color: "#fff" },
  row: { flexDirection: "row" },
  cell: {
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    padding: 10,
    minWidth: 140,
  },
  headerCell: {
    fontWeight: "bold",
    backgroundColor: "#1f2937",
  },
});