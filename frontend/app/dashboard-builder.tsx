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

//import "react-grid-layout/css/styles.css";
//import "react-resizable/css/styles.css";
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

export default function DashboardBuilder() {
  const [layout, setLayout] = useState([
    { i: "kpi1", x: 0, y: 0, w: 3, h: 2 },
    { i: "kpi2", x: 3, y: 0, w: 3, h: 2 },
    { i: "bar", x: 0, y: 2, w: 6, h: 5 },
    { i: "line", x: 6, y: 2, w: 6, h: 5 },
  ]);

  const [widgets, setWidgets] = useState([
  { id: "kpi1", x: 20, y: 20, w: 220, h: 130, type: "kpi" },
  { id: "kpi2", x: 260, y: 20, w: 220, h: 130, type: "kpi" },
  { id: "chart1", x: 20, y: 180, w: 460, h: 260, type: "chart" },
]);

const [draggingId, setDraggingId] = useState<string | null>(null);
const [resizingId, setResizingId] = useState<string | null>(null);
const [startPos, setStartPos] = useState({ x: 0, y: 0 });

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

const GRID_SIZE = 20;

        const getNextPosition = () => {
  const padding = 20;

  if (widgets.length === 0) {
    return { x: padding, y: padding };
  }

  const last = widgets[widgets.length - 1];

  // move right
       let nextX = last.x + last.w + padding;
       let nextY = last.y;

  // wrap to next row if overflow
    if (nextX + 300 > 900) {
       nextX = padding;
      nextY = last.y + last.h + padding;
    }

    return { x: nextX, y: nextY };
  };

     const addKpi = () => {
     const pos = getNextPosition();

       setWidgets((prev) => [
         ...prev,
      {
        id: `kpi-${Date.now()}`,
        x: pos.x,
        y: pos.y,
        w: 220,
        h: 130,
        type: "kpi",
      },
    ]);
  };


      const addChart = () => {
      const pos = getNextPosition();

         setWidgets((prev) => [
         ...prev,
        {
           id: `chart-${Date.now()}`,
           x: pos.x,
           y: pos.y,
           w: 460,
           h: 260,
           type: "chart",
        },
      ]);
    };


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
    layout: widgets,
    widgets,
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
  setWidgets(dashboard.layout || []);
  //setLayout(dashboard.layout || []);
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
        <TouchableOpacity style={styles.button} onPress={addKpi}>
          <Text style={styles.buttonText}>Add KPI</Text>
        </TouchableOpacity>


        <TouchableOpacity style={styles.button} onPress={addChart}>
          <Text style={styles.buttonText}>Add Chart</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.buttonText}>Save Layout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.canvas}>
        
  {widgets.map((widget) => (
    <View
      key={widget.id}
      style={[
        styles.widget,
        {
          left: widget.x,
          top: widget.y,
          width: widget.w,
          height: widget.h,
        },
      ]}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e: any) => {
        setDraggingId(widget.id);
        setStartPos({
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
        });
      }}
      onResponderMove={(e: any) => {
        if (resizingId === widget.id) {

          const dx = e.nativeEvent.pageX - startPos.x;
          const dy = e.nativeEvent.pageY - startPos.y;

          setWidgets((prev) =>
            prev.map((w) =>
              w.id === widget.id
                ? {
                    ...w,
                   w: Math.max(180, Math.round((w.w + dx) / GRID_SIZE) * GRID_SIZE),
                   h: Math.max(120, Math.round((w.h + dy) / GRID_SIZE) * GRID_SIZE),
                  }
                : w
            )
          );

          setStartPos({
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          });
          return;
        }

        if (draggingId !== widget.id) return;

        
        //const dx = e.nativeEvent.pageX - startPos.x;
        //const dy = e.nativeEvent.pageY - startPos.y;


        
        const dx = e.nativeEvent.pageX - startPos.x;
        const dy = e.nativeEvent.pageY - startPos.y;

        const snappedX = Math.round((widget.x + dx) / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.round((widget.y + dy) / GRID_SIZE) * GRID_SIZE;

        setWidgets((prev) =>
          prev.map((w) =>
            w.id === widget.id
              ? { ...w, x: snappedX, y: snappedY }
              : w
          )
        );

        setStartPos({
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
        });
      }}
      onResponderRelease={() => {
        setDraggingId(null);
        setResizingId(null);
      }}
    >
      <Text style={styles.widgetTitle}>
        {widget.type === "kpi" ? "KPI" : "Chart"}
      </Text>

      {widget.type === "kpi" ? (
        <Text style={styles.kpiValue}>₹12.4L</Text>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={sampleData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Resize Handle */}
      <TouchableOpacity
        style={styles.resizeHandle}
        onPressIn={(e: any) => {
          setResizingId(widget.id);
          setStartPos({
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          });
        }}
      />
    </View>
  ))}


        
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

widget: {
  position: "absolute",
  backgroundColor: "#0f172a",
  borderWidth: 1,
  borderColor: "#334155",
  borderRadius: 12,
  padding: 12,
},

widgetTitle: {
  color: "#fff",
  fontWeight: "bold",
},

resizeHandle: {
  position: "absolute",
  right: 0,
  bottom: 0,
  width: 18,
  height: 18,
  backgroundColor: "#3b82f6",
  borderTopLeftRadius: 8,
},

canvas: {
  position: "relative",
  minHeight: 800,
  backgroundColor: "#111827",
  borderWidth: 1,
  borderColor: "#333",
  borderRadius: 12,
  overflow: "hidden",
},

});