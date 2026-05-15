import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";

import {
  ResponsiveContainer,
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
} from "recharts";

import {
  Responsive,
  WidthProvider,
  Layout,
} from "react-grid-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useAuthStore } from "../stores/authStore";
import { apiCall } from "../utils/api";

const ResponsiveGridLayout =
  WidthProvider(Responsive);

interface Widget {
  id: string;
  type: "kpi" | "bar" | "line" | "pie";
  layout: Layout;
}

export default function DashboardBuilder() {
  const { token } = useAuthStore();

  const [datasets, setDatasets] = useState<
    any[]
  >([]);

  const [selectedDataset, setSelectedDataset] =
    useState<any>(null);

  const [dashboardName, setDashboardName] =
    useState("My Dashboard");

  const [widgets, setWidgets] = useState<
    Widget[]
  >([
    {
      id: "kpi1",
      type: "kpi",
      layout: {
        i: "kpi1",
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      },
    },

    {
      id: "line1",
      type: "line",
      layout: {
        i: "line1",
        x: 3,
        y: 0,
        w: 6,
        h: 3,
      },
    },

    {
      id: "bar1",
      type: "bar",
      layout: {
        i: "bar1",
        x: 0,
        y: 3,
        w: 6,
        h: 5,
      },
    },

    {
      id: "line2",
      type: "line",
      layout: {
        i: "line2",
        x: 6,
        y: 3,
        w: 6,
        h: 3,
      },
    },

    {
      id: "pie1",
      type: "pie",
      layout: {
        i: "pie1",
        x: 6,
        y: 6,
        w: 6,
        h: 4,
      },
    },
  ]);

  const sampleData = [
    { name: "2025-01-01", value: 13 },
    { name: "2025-01-02", value: 4 },
    { name: "2025-01-03", value: 1 },
    { name: "2025-01-04", value: 10 },
    { name: "2025-01-05", value: 19 },
    { name: "2025-01-06", value: 14 },
    { name: "2025-01-07", value: 6 },
    { name: "2025-01-08", value: 14 },
  ];

  useEffect(() => {
    if (token) {
      loadDatasets();
    }
  }, [token]);

  const loadDatasets = async () => {
    try {
      if (!token) return;

      const data = await apiCall(
        "/api/datasets",
        {},
        token
      );

      setDatasets(data);

      if (data?.length > 0) {
        setSelectedDataset(data[0]);
      }
    } catch {
      Alert.alert("Failed to load datasets");
    }
  };

  const createLayout = (
    type: string,
    index: number
  ): Layout => ({
    i: `${type}-${Date.now()}`,
    x: (index * 3) % 12,
    y: Infinity,
    w: type === "kpi" ? 3 : 6,
    h: type === "kpi" ? 2 : 4,
  });

  const addWidget = (
    type: "kpi" | "bar" | "line" | "pie"
  ) => {
    const layout = createLayout(
      type,
      widgets.length
    );

    setWidgets((prev) => [
      ...prev,
      {
        id: layout.i,
        type,
        layout,
      },
    ]);
  };

  const onLayoutChange = (
    layout: Layout[]
  ) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        const updated = layout.find(
          (l) => l.i === widget.id
        );

        if (!updated) return widget;

        return {
          ...widget,
          layout: updated,
        };
      })
    );
  };

  const renderChart = (
    type: string
  ) => {
    if (type === "bar") {
      return (
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart data={sampleData}>
            <XAxis
              dataKey="name"
              stroke="#94a3b8"
            />

            <YAxis stroke="#94a3b8" />

            <Tooltip />

            <Bar
              dataKey="value"
              fill="#3b82f6"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === "line") {
      return (
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart data={sampleData}>
            <XAxis
              dataKey="name"
              stroke="#94a3b8"
            />

            <YAxis stroke="#94a3b8" />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="value"
              stroke="#22c55e"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <PieChart>
          <Pie
            data={sampleData}
            dataKey="value"
            outerRadius={80}
          >
            {sampleData.map((_, index) => (
              <Cell
                key={index}
                fill={
                  [
                    "#3b82f6",
                    "#22c55e",
                    "#f59e0b",
                    "#ef4444",
                    "#8b5cf6",
                    "#06b6d4",
                  ][index % 6]
                }
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderWidget = (
    widget: Widget,
    index: number
  ) => {
    if (widget.type === "kpi") {
      return (
        <View
          style={[
            styles.widget,
            styles.kpiWidget,
          ]}
        >
          <Text style={styles.widgetTitle}>
            Total Quantity
          </Text>

          <Text style={styles.kpiValue}>
            1,042
          </Text>

          <Text style={styles.growth}>
            Live
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.widget,
          styles.chartWidget,
        ]}
      >
        <View style={styles.dragHandle}>
          <Text style={styles.dragText}>
            Drag Widget
          </Text>

          <Text style={styles.widgetMenu}>
            ⚙
          </Text>
        </View>

        <Text style={styles.widgetTitle}>
          Sales by Category
        </Text>

        <View style={styles.chartMeta}>
          <Text style={styles.metaText}>
            X: Auto
          </Text>

          <Text style={styles.metaText}>
            Metric: Auto
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {renderChart(widget.type)}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.page}>
      {/* NAVBAR */}
      <View style={styles.topNavbar}>
        <Text style={styles.navTitle}>
          Dashboard Builder
        </Text>

        <View style={styles.topButtons}>
          {["Insert", "Visual", "Model"].map(
            (btn) => (
              <TouchableOpacity
                key={btn}
                style={styles.navButton}
              >
                <Text
                  style={styles.buttonText}
                >
                  {btn}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      <View style={styles.mainLayout}>
        {/* LEFT */}
        <View style={styles.leftSidebar}>
          <Text style={styles.sidebarTitle}>
            Datasets
          </Text>

          <ScrollView>
            {datasets.map((dataset: any) => (
              <TouchableOpacity
                key={dataset._id}
                style={[
                  styles.fieldItem,
                  selectedDataset?._id ===
                    dataset._id && {
                    backgroundColor:
                      "#2563eb",
                  },
                ]}
                onPress={() =>
                  setSelectedDataset(dataset)
                }
              >
                <Text style={styles.fieldText}>
                  {dataset.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            value={dashboardName}
            onChangeText={setDashboardName}
            style={styles.nameInput}
            placeholder="Dashboard Name"
            placeholderTextColor="#777"
          />

          <TouchableOpacity
            style={styles.saveButton}
          >
            <Text style={styles.buttonText}>
              Save Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addWidget("kpi")
            }
          >
            <Text style={styles.buttonText}>
              Add KPI
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addWidget("bar")
            }
          >
            <Text style={styles.buttonText}>
              Add Bar Chart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addWidget("line")
            }
          >
            <Text style={styles.buttonText}>
              Add Line Chart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addWidget("pie")
            }
          >
            <Text style={styles.buttonText}>
              Add Pie Chart
            </Text>
          </TouchableOpacity>
        </View>

        {/* CENTER */}
        <View style={styles.centerCanvas}>
          <View style={styles.dashboardSurface}>
            <ResponsiveGridLayout
              layouts={{
                lg: widgets.map(
                  (w) => w.layout
                ),
              }}
              breakpoints={{
                lg: 1200,
                md: 996,
                sm: 768,
                xs: 480,
              }}
              cols={{
                lg: 12,
                md: 10,
                sm: 6,
                xs: 2,
              }}
              rowHeight={90}
              width={1200}
              margin={[16, 16]}
              isResizable
              isDraggable
              compactType={null}
              preventCollision={false}
              draggableHandle=".dragHandle"
              onLayoutChange={
                onLayoutChange
              }
            >
              {widgets.map(
                (widget, index) => (
                  <View key={widget.id}>
                    {renderWidget(
                      widget,
                      index
                    )}
                  </View>
                )
              )}
            </ResponsiveGridLayout>
          </View>
        </View>

        {/* RIGHT */}
        <View style={styles.rightSidebar}>
          <Text style={styles.sidebarTitle}>
            Fields
          </Text>

          <ScrollView>
            {selectedDataset?.columns?.map(
              (col: any) => (
                <View
                  key={col.name}
                  style={styles.fieldItem}
                >
                  <Text style={styles.fieldText}>
                    {col.name}
                  </Text>
                </View>
              )
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#020617",
  },

  topNavbar: {
    height: 60,
    backgroundColor: "#0b1220",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  navTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  topButtons: {
    flexDirection: "row",
  },

  navButton: {
    marginLeft: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },

  mainLayout: {
    flex: 1,
    flexDirection: "row",
  },

  leftSidebar: {
    width: 220,
    backgroundColor: "#071226",
    padding: 14,
  },

  rightSidebar: {
    width: 220,
    backgroundColor: "#071226",
    padding: 14,
  },

  centerCanvas: {
    flex: 1,
    padding: 16,
    backgroundColor: "#111827",
  },

  dashboardSurface: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    padding: 12,
    
  },

  sidebarTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },

  fieldItem: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  fieldText: {
    color: "#fff",
    fontSize: 13,
  },

  nameInput: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    marginBottom: 12,
    marginTop: 12,
  },

  saveButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  button: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  widget: {
    flex: 1,
    backgroundColor: "#071226",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 12,
    overflow: "hidden",
  },

  kpiWidget: {
    justifyContent: "center",
  },

  chartWidget: {
    flex: 1,
  },

  widgetHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  widgetMenu: {
    color: "#94a3b8",
    fontSize: 12,
  },

  widgetTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },

  chartMeta: {
    flexDirection: "row",
    marginBottom: 10,
  },

  metaText: {
    color: "#94a3b8",
    marginRight: 14,
    fontSize: 12,
  },

  kpiValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },

  growth: {
    color: "#22c55e",
    marginTop: 8,
  },

  dragHandle: {
    backgroundColor: "#182235",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    ...(Platform.OS === "web"
      ? {
          cursor: "grab" as any,
        }
      : {}),
  },

  dragText: {
    color: "#94a3b8",
    fontSize: 12,
  },
});