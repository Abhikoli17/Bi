import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { apiCall } from "../../utils/api";

export default function DatasetDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuthStore();

  const [dataset, setDataset] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && token) loadDataset();
  }, [id, token]);

  const loadDataset = async () => {
    try {
      const data = await apiCall(`/api/datasets/${id}`, {}, token);
      setDataset(data);
      setRows(data.data || []);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load dataset");
    } finally {
      setLoading(false);
    }
  };

  const updateCell = (rowIndex: number, columnName: string, value: string) => {
    const updatedRows = [...rows];
    updatedRows[rowIndex] = {
      ...updatedRows[rowIndex],
      [columnName]: value,
    };
    setRows(updatedRows);
  };

  const saveChanges = async () => {
    if (!token) {
      Alert.alert("Session expired", "Please login again");
      return;
    }

    try {
      setSaving(true);

      const updated = await apiCall(
        `/api/datasets/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({ data: rows }),
        },
        token
      );

      setDataset(updated);
      setRows(updated.data || []);
      Alert.alert("Saved", "Dataset updated successfully");
    } catch (error: any) {
      Alert.alert("Save Failed", error.message || "Failed to save changes");
    } finally {
      setSaving(false);
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

  const columns = dataset.columns || [];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{dataset.name}</Text>
      <Text style={styles.meta}>
        {rows.length} rows • {columns.length} columns
      </Text>

      <TouchableOpacity
        onPress={saveChanges}
        style={styles.saveButton}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>

      <ScrollView horizontal>
        <View>
          <View style={styles.row}>
            {columns.map((col: any) => (
              <Text key={col.name} style={[styles.cell, styles.headerCell]}>
                {col.name}
              </Text>
            ))}
          </View>

          {rows.slice(0, 50).map((row: any, rowIndex: number) => (
            <View key={rowIndex} style={styles.row}>
              {columns.map((col: any) => (
                <TextInput
                  key={col.name}
                  value={String(row[col.name] ?? "")}
                  onChangeText={(value) =>
                    updateCell(rowIndex, col.name, value)
                  }
                  style={styles.inputCell}
                />
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
  center: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  meta: { color: "#999", marginTop: 8, marginBottom: 12 },
  text: { color: "#fff" },
  row: { flexDirection: "row" },
  cell: {
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    padding: 10,
    minWidth: 140,
  },
  inputCell: {
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
    padding: 10,
    minWidth: 140,
    backgroundColor: "#111",
  },
  headerCell: {
    fontWeight: "bold",
    backgroundColor: "#1f2937",
  },
  saveButton: {
    backgroundColor: "#3b82f6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
  },
});