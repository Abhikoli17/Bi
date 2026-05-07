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

import { useAuthStore } from "../stores/authStore";
import { apiCall } from "../utils/api";

export default function DashboardBuilder() {
 

  const [widgets, setWidgets] = useState<any[]>([
  {
    id: "kpi1",
    x: 20,
    y: 20,
    w: 220,
    h: 130,
    type: "kpi",
  },
  {
    id: "kpi2",
    x: 260,
    y: 20,
    w: 220,
    h: 130,
    type: "kpi",
  },
  {
    id: "bar1",
    x: 20,
    y: 180,
    w: 460,
    h: 260,
    type: "bar",
    config: {
      xAxis: "",
      metric: "",
      aggregation: "SUM",
    },
  },
]);

const [draggingId, setDraggingId] = useState<string | null>(null);
const [resizingId, setResizingId] = useState<string | null>(null);
const [startPos, setStartPos] = useState({ x: 0, y: 0 });

const { token } = useAuthStore();
const [savedDashboards, setSavedDashboards] = useState<any[]>([]);
const [dashboardName, setDashboardName] = useState("My Dashboard");
const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);
const [datasets, setDatasets] = useState<any[]>([]);
const [selectedDataset, setSelectedDataset] = useState<any>(null);

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
        w: 260,
        h: 150,
        type: "kpi",
      },
    ]);
  };


      const addChart = () => {
      const pos = getNextPosition();

      const chartTypes = ["bar", "line", "pie", "map"];
      const chartCount = widgets.filter((w) => w.type !== "kpi").length;
      const nextType = chartTypes[chartCount % chartTypes.length];

     setWidgets((prev) => [
       ...prev,
    {
      id: `${nextType}-${Date.now()}`,
      x: pos.x,
      y: pos.y,
      w: 460,
      h: 380,
      type: nextType,

      config: {
        xAxis: "",
        metric: "",
        aggregation: "SUM",
      },
    },
  ]);
};

const updateWidgetConfig = (
  widgetId: string,
  field: string,
  value: string
) => {
  setWidgets((prev: any[]) =>
    prev.map((widget) =>
      widget.id === widgetId
        ? {
            ...widget,
            config: {
              ...widget.config,
              [field]: value,
            },
          }
        : widget
    )
  );
};

const getChartData = (widget: any) => {
  if (!selectedDataset?.columns || !selectedDataset?.data) {
    return sampleData;
  }

  const xAxis =
    widget.config?.xAxis ||
    selectedDataset.columns[0]?.name;

  const metric =
    widget.config?.metric ||
    selectedDataset.columns.find((col: any) =>
    selectedDataset.data.some(
      (row: any) =>
        row[col.name] !== "" &&
        !isNaN(Number(row[col.name]))
    )
  )?.name;
  
  const aggregation =
    widget.config?.aggregation || "SUM";

  const grouped: any = {};

  selectedDataset.data.forEach((row: any) => {
    const key = row[xAxis] || "Unknown";

    if (!grouped[key]) {
      grouped[key] = [];
    }

    const num = parseFloat(row[metric]);
    grouped[key].push(isNaN(num) ? 0 : num);
  });

  return Object.keys(grouped)
    .slice(0, 8)
    .map((key) => {
      const values = grouped[key];

      let value = 0;

      if (aggregation === "SUM") {
        value = values.reduce(
          (a: number, b: number) => a + b,
          0
        );
      }

      if (aggregation === "AVG") {
        value =
          values.reduce(
            (a: number, b: number) => a + b,
            0
          ) / values.length;
      }

      if (aggregation === "COUNT") {
        value = values.length;
      }

      return {
        name: key,
        value: Number(value.toFixed(2)),
      };
    });
};

 


const getKpiData = (index: number) => {
  if (!selectedDataset?.data || !selectedDataset?.columns) {
    const fallback = [
      { title: "Total Sales", value: "₹12.4L", growth: "Demo" },
      { title: "Customers", value: "2,430", growth: "Demo" },
      { title: "Revenue", value: "₹8.7L", growth: "Demo" },
      { title: "Orders", value: "1,280", growth: "Demo" },
    ];

    return fallback[index % fallback.length];
  }

  const numericCols = selectedDataset.columns.filter((col: any) =>
    selectedDataset.data.some(
      (row: any) => row[col.name] !== "" && !isNaN(Number(row[col.name]))
    )
  );

  const col = numericCols[index % Math.max(numericCols.length, 1)];

  if (!col) {
    return {
      title: "Rows",
      value: String(selectedDataset.data.length),
      growth: "Live",
    };
  }

  const total = selectedDataset.data.reduce(
  (sum: number, row: any) => {
    const val = parseFloat(row[col.name]);

    return sum + (isNaN(val) ? 0 : val);
  },
  0
);

  return {
    title: `Total ${col.name}`,
    value: total.toLocaleString(),
    growth: "Live",
  };
};

const loadDatasets = async () => {
  if (!token) return;

  const data = await apiCall("/api/datasets", {}, token);
  setDatasets(data);

  if (data.length > 0 && !selectedDataset) {
    setSelectedDataset(data[0]);
  }
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
    loadSavedDashboards();
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

const createNewDashboard = () => {
  setCurrentDashboardId(null);

  setDashboardName("New Dashboard");

  setWidgets([
    {
      id: `kpi-${Date.now()}`,
      x: 20,
      y: 20,
      w: 220,
      h: 130,
      type: "kpi",
    },
    {
      id: `bar-${Date.now()}`,
      x: 20,
      y: 180,
      w: 460,
      h: 260,
      type: "bar",
    },
  ]);
};

    useEffect(() => {
  if (token) {
    loadSavedDashboards();
    loadDatasets();
  }
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

      <TouchableOpacity style={styles.button} onPress={createNewDashboard}>
         <Text style={styles.buttonText}>New Dashboard</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Select Dataset</Text>

<View style={styles.savedList}>
  {datasets.map((dataset) => (
    <TouchableOpacity
      key={dataset._id}
      style={[
        styles.savedItem,
        selectedDataset?._id === dataset._id && { borderColor: "#2563eb" },
      ]}
      onPress={() => setSelectedDataset(dataset)}
    >
      <Text style={styles.savedText}>{dataset.name}</Text>
    </TouchableOpacity>
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
     {widget.type === "kpi" ? (
  (() => {
    const kpi = getKpiData(
      widgets.filter((w) => w.type === "kpi").findIndex((w) => w.id === widget.id)
    );

    return (
      <>
        <Text style={styles.widgetTitle}>{kpi.title}</Text>
        <Text style={styles.kpiValue}>{kpi.value}</Text>
        <Text style={styles.growth}>{kpi.growth}</Text>
      </>
    );
  })()
) : (
  <>
    <Text style={styles.configLabel}>X Axis</Text>

<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={styles.dropdownBox}
>
  {selectedDataset?.columns?.map((col: any) => (
    <TouchableOpacity
      key={`x-${col.name}`}
      style={[
        styles.dropdownOption,
        widget.config?.xAxis === col.name &&
          styles.activeSelector,
      ]}
      onPress={() =>
        updateWidgetConfig(
          widget.id,
          "xAxis",
          col.name
        )
      }
    >
      <Text style={styles.selectorText}>
        {col.name}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

<Text style={styles.configLabel}>
  Y Axis / Metric
</Text>

<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={styles.dropdownBox}
>
  {selectedDataset?.columns?.map((col: any) => (
    <TouchableOpacity
      key={`y-${col.name}`}
      style={[
        styles.dropdownOption,
        widget.config?.metric === col.name &&
          styles.activeSelector,
      ]}
      onPress={() =>
        updateWidgetConfig(
          widget.id,
          "metric",
          col.name
        )
      }
    >
      <Text style={styles.selectorText}>
        {col.name}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

      <View style={styles.aggRow}>
        {["SUM", "AVG", "COUNT"].map((agg) => (
          <TouchableOpacity
            key={agg}
            style={[
              styles.selectorButton,
              widget.config?.aggregation === agg && styles.activeSelector,
            ]}
            onPress={() => updateWidgetConfig(widget.id, "aggregation", agg)}
          >
            <Text style={styles.selectorText}>{agg}</Text>
          </TouchableOpacity>
        ))}
      </View>
    

    {widget.type === "bar" ? (
      <>
        <Text style={styles.widgetTitle}>Bar Chart</Text>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={getChartData(widget)}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </>
    ) : widget.type === "line" ? (
      <>
        <Text style={styles.widgetTitle}>Line Chart</Text>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={getChartData(widget)}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#22c55e" />
          </LineChart>
        </ResponsiveContainer>
      </>
    ) : widget.type === "pie" ? (
      <>
        <Text style={styles.widgetTitle}>Donut Chart</Text>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={getChartData(widget)}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={70}
            >
              {getChartData(widget).map((_, index) => (
                <Cell
                  key={index}
                  fill={["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"][index % 5]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </>
    ) : (
      <>
        <Text style={styles.widgetTitle}>Map Visual</Text>
        <View style={styles.mapBox}>
          <Text style={styles.mapText}>🌍 Map Preview</Text>
        </View>
      </>
    )}
  </>
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
  padding: 20,
},

mapBox: {
  flex: 1,
  backgroundColor: "#052e16",
  borderRadius: 10,
  justifyContent: "center",
  alignItems: "center",
  marginTop: 12,
},

mapText: {
  color: "#fff",
  fontSize: 22,
  fontWeight: "bold",
},

configRow: {
  marginBottom: 10,
},

aggRow: {
  flexDirection: "row",
  marginTop: 8,
  gap: 6,
},

selectorButton: {
  backgroundColor: "#1e293b",
  borderWidth: 1,
  borderColor: "#334155",
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
  marginRight: 6,
},

activeSelector: {
  backgroundColor: "#2563eb",
  borderColor: "#2563eb",
},

selectorText: {
  color: "#fff",
  fontSize: 12,
},

configLabel: {
  color: "#94a3b8",
  fontSize: 10,
  marginBottom: 2,
  marginTop: 4,
},

dropdownBox: {
  flexDirection: "row",
  maxHeight: 42,
  marginBottom: 6,
},

dropdownOption: {
  backgroundColor: "#1e293b",
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 6,
  marginRight: 6,
  height: 28,
  justifyContent: "center",
},

});