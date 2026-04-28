import React, { useEffect, useState }  from 'react';
import { View, Text, StyleSheet, ScrollView,  TouchableOpacity, ActivityIndicator, } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from "../../stores/authStore";
import { apiCall } from "../../utils/api";

export default function DashboardsScreen() {
  const { token } = useAuthStore();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  
  useEffect(() => {
    if (token) loadDatasets();
  }, [token]);

  const loadDatasets = async () => {
    try {
      const data = await apiCall("/api/datasets", {}, token);
      setDatasets(data);
      if (data.length > 0) setSelectedDataset(data[0]);
    } finally {
      setLoading(false);
    }
  };

  const getNumericColumns = () => {
  if (!selectedDataset?.columns) return [];

  return selectedDataset.columns.filter((col: any) => {
    const values =
      selectedDataset.data?.map((row: any) => row[col.name]) || [];

    const numericValues = values.filter(
      (v: any) => v !== "" && v !== null && !isNaN(Number(v))
    );

    return numericValues.length > values.length * 0.6;
  });
};

  const getColumnTotal = (columnName: string) => {
    return selectedDataset.data
      ?.reduce((sum: number, row: any) => sum + Number(row[columnName] || 0), 0)
      .toFixed(2);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Dashboards</Text>
      <Text style={styles.subtitle}>Interactive analytics from your uploaded datasets</Text>

      <View style={styles.datasetList}>
        {datasets.map((dataset) => (
          <TouchableOpacity
            key={dataset._id}
            style={[
              styles.datasetButton,
              selectedDataset?._id === dataset._id && styles.activeDataset,
            ]}
            onPress={() => setSelectedDataset(dataset)}
          >
            <Text style={styles.datasetButtonText}>{dataset.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!selectedDataset ? (
        <View style={styles.emptyBox}>
          <Ionicons name="grid-outline" size={64} color="#444" />
          <Text style={styles.emptyTitle}>No dataset selected</Text>
          <Text style={styles.emptyText}>Upload a dataset first to create dashboards.</Text>
        </View>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Rows</Text>
              <Text style={styles.cardValue}>{selectedDataset.row_count}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Columns</Text>
              <Text style={styles.cardValue}>{selectedDataset.columns?.length}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>File Type</Text>
              <Text style={styles.cardValue}>{selectedDataset.file_type?.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Numeric Summary</Text>

          <View style={styles.summaryGrid}>
            {getNumericColumns().slice(0, 6).map((col: any) => (
              <View key={col.name} style={styles.summaryCard}>
                <Text style={styles.cardLabel}>{col.name}</Text>
                <Text style={styles.cardValue}>{getColumnTotal(col.name)}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Preview</Text>

          <ScrollView horizontal>
            <View>
              <View style={styles.row}>
                {selectedDataset.columns?.slice(0, 6).map((col: any) => (
                  <Text key={col.name} style={styles.headerCell}>{col.name}</Text>
                ))}
              </View>

              {selectedDataset.data?.slice(0, 8).map((row: any, index: number) => (
                <View key={index} style={styles.row}>
                  {selectedDataset.columns?.slice(0, 6).map((col: any) => (
                    <Text key={col.name} style={styles.cell}>
                      {String(row[col.name] ?? "")}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}

  

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 16
  },

  center: { 
   flex: 1, 
   backgroundColor: "#0a0a0a", 
   justifyContent: "center", 
   alignItems: "center" 
  },

  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },

   subtitle: { 
    color: "#999", 
    marginTop: 4, 
    marginBottom: 16 
  },

  datasetList: { 
    flexDirection: "row",
    flexWrap: "wrap", 
    gap: 8, 
    marginBottom: 16 
  },

  datasetButton: { 
    backgroundColor: "#1f2937", 
    padding: 10, 
    borderRadius: 8 
  },

  activeDataset: { 
    backgroundColor: "#2563eb" 
  },

  datasetButtonText: { 
    color: "#fff", 
    fontWeight: "600" 
  },

  kpiGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 12, 
    marginBottom: 20 
  },

  card: { 
    backgroundColor: "#111827", 
    borderColor: "#333", 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 16, 
    minWidth: 160 
  },

  cardLabel: { 
    color: "#999", 
    fontSize: 13 
  },

  cardValue: { 
    color: "#fff", 
    fontSize: 24, 
    fontWeight: "bold", 
    marginTop: 6 
  },

  sectionTitle: { 
    color: "#fff",
    fontSize: 20, 
    fontWeight: "bold", 
    marginVertical: 12 
  },

  summaryGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 12 
  },

  summaryCard: { 
    backgroundColor: "#052e16", 
    borderColor: "#166534", 
    borderWidth: 1, 
    borderRadius: 12,
    padding: 16, 
    minWidth: 180 
  },

  row: { 
    flexDirection: "row" 
  },

  headerCell: { 
    color: "#fff", 
    backgroundColor: "#1f2937", 
    borderWidth: 1, 
    borderColor: "#333", 
    padding: 10, 
    minWidth: 150, 
    fontWeight: "bold" 
  },

  cell: { 
    color: "#fff", 
    borderWidth: 1, 
    borderColor: "#333", 
    padding: 10, 
    minWidth: 150 
  },

   emptyBox: { 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 80 
  },

  emptyTitle: { 
    color: "#fff", 
    fontSize: 20, 
    fontWeight: "bold",
    marginTop: 16 
  },

  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});