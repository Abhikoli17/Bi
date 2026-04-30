import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  TextInput,
  Alert, 
} from "react-native";

declare const require: any;

//const ReactGridLayout = require("react-grid-layout");
//const Responsive = ReactGridLayout.Responsive || ReactGridLayout.default?.Responsive;
//const WidthProvider = ReactGridLayout.WidthProvider || ReactGridLayout.default?.WidthProvider;
const RGL = require("react-grid-layout");
const ReactGridLayout = RGL.default || RGL;

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useAuthStore } from "../stores/authStore";
import { apiCall } from "../utils/api";

//const ResponsiveGridLayout = WidthProvider(Responsive);
const { token } = useAuthStore();
const [savedDashboards, setSavedDashboards] = useState<any[]>([]);
const [dashboardName, setDashboardName] = useState("My Dashboard");
const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);

const sampleData = [
  { name: "Jan", value: 400 },
  { name: "Feb", value: 800 },
  { name: "Mar", value: 650 },
  { name: "Apr", value: 1200 },
  { name: "May", value: 900 },
];

export default function DashboardBuilder() {
  const [layout, setLayout] = useState([
    { i: "kpi1", x: 0, y: 0, w: 3, h: 2 },
    { i: "kpi2", x: 3, y: 0, w: 3, h: 2 },
    { i: "bar", x: 0, y: 2, w: 6, h: 5 },
    { i: "line", x: 6, y: 2, w: 6, h: 5 },
  ]);

  const loadSavedDashboards = async () => {
  if (!token) return;

  const data = await apiCall("/api/dashboard-layouts", {}, token);
  setSavedDashboards(data);
};

const saveDashboard = async () => {
  if (!token) {
    Alert.alert("Login required");
    return;
  }

  const payload = {
    name: dashboardName,
    layout,
    widgets: ["kpi1", "kpi2", "bar", "line"],
    dataset_id: null,
  };

  if (currentDashboardId) {
    const updated = await apiCall(
      `/api/dashboard-layouts/${currentDashboardId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
      token
    );

    Alert.alert("Saved", "Dashboard updated");
    return updated;
  }

  const created = await apiCall(
    "/api/dashboard-layouts",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );

  setCurrentDashboardId(created._id);
  Alert.alert("Saved", "Dashboard saved");
  loadSavedDashboards();
};

const openDashboard = (dashboard: any) => {
  setDashboardName(dashboard.name);
  setLayout(dashboard.layout || []);
  setCurrentDashboardId(dashboard._id);
};

const deleteDashboard = async (dashboardId: string) => {
  if (!token) return;

  await apiCall(
    `/api/dashboard-layouts/${dashboardId}`,
    { method: "DELETE" },
    token
  );

  if (currentDashboardId === dashboardId) {
    setCurrentDashboardId(null);
  }

  loadSavedDashboards();
};

    useEffect(() => {
       if (token) loadSavedDashboards();
    }, [token]);

  return (
    <ScrollView style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Builder</Text>
        <Text style={styles.subtitle}>Drag, resize, and arrange visuals like Power BI</Text>
      </View>

      <TextInput
        value={dashboardName}
        onChangeText={setDashboardName}
        placeholder="Dashboard name"
        placeholderTextColor="#777"
        style={styles.nameInput}
      />

      <TouchableOpacity style={styles.saveButton} onPress={saveDashboard}>
        <Text style={styles.buttonText}>Save Dashboard</Text>
      </TouchableOpacity>

     <Text style={styles.sectionTitle}>Saved Dashboards</Text>

     <View style={styles.savedList}>
         {savedDashboards.map((dash) => (
     <View key={dash._id} style={styles.savedItem}>
      <TouchableOpacity onPress={() => openDashboard(dash)}>
        <Text style={styles.savedText}>{dash.name}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => deleteDashboard(dash._id)}>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  ))}
</View>

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Add KPI</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Add Chart</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.buttonText}>Save Layout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.canvas}>

        <ReactGridLayout
           className="layout"
           layout={layout}
           cols={12}
           rowHeight={60}
           width={1100}
           onLayoutChange={(newLayout: any) => setLayout(newLayout)}
           draggableHandle=".drag-handle"


           //layouts={{ lg: layout }}
           //breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
           //cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
           //rowHeight={60}
           //onLayoutChange={(newLayout: any) => setLayout(newLayout)}
           //draggableHandle=".drag-handle"
        >

          <View key="kpi1" style={styles.visualCard}>
            <Text style={styles.dragHandle}>⋮⋮</Text>
            <Text style={styles.cardLabel}>Total Sales</Text>
            <Text style={styles.kpiValue}>₹12.4L</Text>
            <Text style={styles.growth}>↑ 18%</Text>
          </View>

          <View key="kpi2" style={styles.visualCard}>
            <Text style={styles.dragHandle}>⋮⋮</Text>
            <Text style={styles.cardLabel}>Customers</Text>
            <Text style={styles.kpiValue}>2,430</Text>
            <Text style={styles.growth}>↑ 9%</Text>
          </View>

          <View key="bar" style={styles.visualCard}>
            <Text style={styles.dragHandle}>⋮⋮</Text>
            <Text style={styles.chartTitle}>Bar Chart</Text>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={sampleData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </View>

          <View key="line" style={styles.visualCard}>
            <Text style={styles.dragHandle}>⋮⋮</Text>
            <Text style={styles.chartTitle}>Line Chart</Text>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={sampleData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#22c55e" />
              </LineChart>
            </ResponsiveContainer>
          </View>
        </ReactGridLayout>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#999",
    marginTop: 4,
  },
  toolbar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  button: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  canvas: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 12,
    minHeight: 700,
    overflow: "hidden",
  },
  visualCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 14,
    height: "100%",
  },
  dragHandle: {
    color: "#94a3b8",
    fontSize: 18,
    cursor: "move" as any,
  },
  cardLabel: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 6,
  },
  kpiValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 10,
  },
  growth: {
    color: "#22c55e",
    fontWeight: "bold",
    marginTop: 6,
  },
  chartTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  nameInput: {
  backgroundColor: "#111827",
  borderColor: "#333",
  borderWidth: 1,
  color: "#fff",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
},

sectionTitle: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "bold",
  marginVertical: 12,
},

savedList: {
  gap: 8,
  marginBottom: 16,
},

savedItem: {
  backgroundColor: "#111827",
  borderColor: "#333",
  borderWidth: 1,
  borderRadius: 8,
  padding: 12,
  flexDirection: "row",
  justifyContent: "space-between",
},

savedText: {
  color: "#fff",
  fontWeight: "600",
},

deleteText: {
  color: "#f87171",
  fontWeight: "bold",
},
});