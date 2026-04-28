import React, { useEffect, useState }  from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

  const getFirstTextColumn = () => {
  return selectedDataset?.columns?.find((col: any) =>
    selectedDataset.data?.some((row: any) => isNaN(Number(row[col.name])))
  )?.name;
};

const getFirstNumericColumn = () => {
  return selectedDataset?.columns?.find((col: any) =>
    selectedDataset.data?.some((row: any) => !isNaN(Number(row[col.name])))
  )?.name;
};

const getBarChartData = () => {
  const categoryCol = getFirstTextColumn();
  const valueCol = getFirstNumericColumn();

  if (!categoryCol || !valueCol) return [];

  const grouped: any = {};

  selectedDataset.data?.forEach((row: any) => {
    const key = row[categoryCol] || "Unknown";
    grouped[key] = (grouped[key] || 0) + Number(row[valueCol] || 0);
  });

  return Object.keys(grouped).slice(0, 10).map((key) => ({
    name: key,
    value: Number(grouped[key].toFixed(2)),
  }));
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

    <View style={styles.filterPanel}>
      <Text style={styles.filterTitle}>Filters</Text>

      <Text style={styles.filterLabel}>Dataset Selector</Text>
    </View>

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
    <Text style={styles.growth}>↑ +12%</Text>
  </View>

  <View style={styles.card}>
    <Text style={styles.cardLabel}>Columns</Text>
    <Text style={styles.cardValue}>{selectedDataset.columns?.length}</Text>
    <Text style={styles.growth}>↑ +4%</Text>
  </View>

  <View style={styles.card}>
    <Text style={styles.cardLabel}>File Type</Text>
    <Text style={styles.cardValue}>
      {selectedDataset.file_type?.toUpperCase()}
    </Text>
    <Text style={styles.growth}>Live</Text>
  </View>
</View>

          <Text style={styles.sectionTitle}>Charts</Text>

<View style={styles.chartGrid}>
  <View style={styles.chartCard}>

    <Text style={styles.chartTitle}>Distribution</Text>

  <ResponsiveContainer width="100%" height={320}>
    <PieChart>
      <Pie
        data={getBarChartData()}
        dataKey="value"
        nameKey="name"
        outerRadius={110}
        innerRadius={60}
        fill="#8884d8"
        label
      >
        {getBarChartData().map((entry, index) => (
          <Cell
            key={index}
            fill={["#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6"][index % 5]}
          />
        ))}
      </Pie>
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
    <Text style={styles.chartTitle}>Bar Chart</Text>
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={getBarChartData()}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  </View>

  <View style={styles.chartCard}>
    <Text style={styles.chartTitle}>Line Chart</Text>
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={getBarChartData()}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#22c55e" />
      </LineChart>
    </ResponsiveContainer>
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

  chartGrid: {
  display: "flex",
  gap: 20,
  marginBottom: 24,
},

chartCard: {
  backgroundColor: "#111827",
  borderColor: "#333",
  borderWidth: 1,
  borderRadius: 12,
  padding: 16,
  width: "100%",
  minHeight: 420,
},

chartTitle: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "bold",
  marginBottom: 16,
},

filterPanel: {
  backgroundColor: "#111827",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: "#333",
},

filterTitle: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "bold",
},

filterLabel: {
  color: "#999",
  marginTop: 8,
},

growth: {
  color: "#22c55e",
  marginTop: 6,
  fontWeight: "bold",
},

});