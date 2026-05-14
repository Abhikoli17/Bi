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
} from "react-grid-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useAuthStore } from "../stores/authStore";
import { apiCall } from "../utils/api";

const ResponsiveGridLayout =
  WidthProvider(Responsive);

export default function DashboardBuilder() {
  const { token } = useAuthStore();

  const [widgets, setWidgets] = useState<any[]>([
    {
      id: "kpi1",
      type: "kpi",
      layout: { x: 0, y: 0, w: 2, h: 2 },
    },
    {
      id: "kpi2",
      type: "kpi",
      layout: { x: 2, y: 0, w: 2, h: 2 },
    },
    {
      id: "bar1",
      type: "bar",
      layout: { x: 0, y: 2, w: 5, h: 5 },
      config: {
        xAxis: "",
        metric: "",
        aggregation: "SUM",
      },
    },
  ]);

  const [dashboardName, setDashboardName] =
    useState("My Dashboard");

  const [savedDashboards, setSavedDashboards] =
    useState<any[]>([]);

  const [currentDashboardId, setCurrentDashboardId] =
    useState<string | null>(null);

  const [datasets, setDatasets] = useState<any[]>(
    []
  );

  const [selectedDataset, setSelectedDataset] =
    useState<any>(null);

  const sampleData = [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 800 },
    { name: "Mar", value: 650 },
    { name: "Apr", value: 1200 },
    { name: "May", value: 900 },
  ];

  useEffect(() => {
    if (token) {
      loadDatasets();
      loadSavedDashboards();
    }
  }, [token]);

  const createLayout = (
    type: string,
    index: number
  ) => ({
    x: (index * 2) % 12,
    y: Infinity,
    w: type === "kpi" ? 2 : 5,
    h: type === "kpi" ? 2 : 5,
  });

  const addKpi = () => {
    setWidgets((prev) => [
      ...prev,
      {
        id: `kpi-${Date.now()}`,
        type: "kpi",
        layout: createLayout(
          "kpi",
          prev.length
        ),
      },
    ]);
  };

  const addSpecificChart = (
    type: string
  ) => {
    setWidgets((prev) => [
      ...prev,
      {
        id: `${type}-${Date.now()}`,
        type,
        layout: createLayout(
          type,
          prev.length
        ),
        config: {
          xAxis: "",
          metric: "",
          aggregation: "SUM",
        },
      },
    ]);
  };

  const onLayoutChange = (layout: any[]) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        const item = layout.find(
          (l) => l.i === widget.id
        );

        if (!item) return widget;

        return {
          ...widget,
          layout: {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          },
        };
      })
    );
  };

  const loadDatasets = async () => {
    if (!token) return;

    const data = await apiCall(
      "/api/datasets",
      {},
      token
    );

    setDatasets(data);

    if (data.length > 0) {
      setSelectedDataset(data[0]);
    }
  };

  const loadSavedDashboards = async () => {
    if (!token) return;

    const data = await apiCall(
      "/api/dashboard-layouts",
      {},
      token
    );

    setSavedDashboards(data);
  };

  const saveDashboard = async () => {
    if (!token) {
      Alert.alert("Login required");
      return;
    }

    const payload = {
      name: dashboardName,
      widgets,
    };

    if (currentDashboardId) {
      await apiCall(
        `/api/dashboard-layouts/${currentDashboardId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        token
      );

      Alert.alert("Dashboard Updated");
      return;
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

    Alert.alert("Dashboard Saved");
  };

  const getChartData = (widget: any) => {
    if (
      !selectedDataset?.columns ||
      !selectedDataset?.data
    ) {
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

    if (!metric) {
      return sampleData;
    }

    const grouped: any = {};

    selectedDataset.data.forEach((row: any) => {
      const key = row[xAxis] || "Unknown";

      if (!grouped[key]) {
        grouped[key] = [];
      }

      const num = parseFloat(row[metric]);

      grouped[key].push(
        isNaN(num) ? 0 : num
      );
    });

    return Object.keys(grouped)
      .slice(0, 8)
      .map((key) => ({
        name: key,
        value: grouped[key].reduce(
          (a: number, b: number) => a + b,
          0
        ),
      }));
  };

  const getKpiData = (index: number) => {
    if (
      !selectedDataset?.columns ||
      !selectedDataset?.data
    ) {
      return {
        title: "Revenue",
        value: "₹48,544",
      };
    }

    const numericCols =
      selectedDataset.columns.filter(
        (col: any) =>
          selectedDataset.data.some(
            (row: any) =>
              row[col.name] !== "" &&
              !isNaN(Number(row[col.name]))
          )
      );

    if (numericCols.length === 0) {
      return {
        title: "Rows",
        value: String(
          selectedDataset.data.length
        ),
      };
    }

    const col =
      numericCols[
        index % numericCols.length
      ];

    const total =
      selectedDataset.data.reduce(
        (sum: number, row: any) => {
          const val = parseFloat(
            row[col.name]
          );

          return (
            sum + (isNaN(val) ? 0 : val)
          );
        },
        0
      );

    return {
      title: `Total ${col.name}`,
      value: total.toLocaleString(),
    };
  };

  const renderWidget = (
    widget: any,
    index: number
  ) => {
    if (widget.type === "kpi") {
      const kpi = getKpiData(index);

      return (
        <View
          style={[
            styles.widget,
            styles.kpiWidget,
          ]}
        >
          <View style={styles.widgetToolbar}>
            <Text style={styles.widgetAction}>
              ⚙
            </Text>

            <Text style={styles.widgetAction}>
              ⋮
            </Text>
          </View>

          <Text style={styles.widgetTitle}>
            {kpi.title}
          </Text>

          <Text style={styles.kpiValue}>
            {kpi.value}
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
        <View style={styles.widgetToolbar}>
          <Text style={styles.widgetAction}>
            ⚙
          </Text>

          <Text style={styles.widgetAction}>
            ⋮
          </Text>
        </View>

        <View style={styles.dragHandle}>
          <Text style={styles.dragText}>
            Drag Widget
          </Text>
        </View>

        <Text style={styles.widgetTitle}>
          {widget.config?.metric ||
            "Sales"}{" "}
          by{" "}
          {widget.config?.xAxis ||
            "Category"}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            X:{" "}
            {widget.config?.xAxis ||
              "Auto"}
          </Text>

          <Text style={styles.metaText}>
            Metric:{" "}
            {widget.config?.metric ||
              "Auto"}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {widget.type === "bar" && (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={getChartData(widget)}
              >
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />

                <Bar
                  dataKey="value"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}

          {widget.type === "line" && (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={getChartData(widget)}
              >
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
          )}

          {widget.type === "pie" && (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={getChartData(widget)}
                  dataKey="value"
                  outerRadius={90}
                >
                  {getChartData(widget).map(
                    (
                      _: any,
                      index: number
                    ) => (
                      <Cell
                        key={index}
                        fill={
                          [
                            "#3b82f6",
                            "#22c55e",
                            "#f59e0b",
                            "#ef4444",
                          ][index % 4]
                        }
                      />
                    )
                  )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.page}>
      {/* TOP RIBBON */}
      <View style={styles.ribbon}>
        <TouchableOpacity
          style={styles.ribbonBtn}
        >
          <Text style={styles.ribbonText}>
            Insert
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ribbonBtn}
        >
          <Text style={styles.ribbonText}>
            Visual
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ribbonBtn}
        >
          <Text style={styles.ribbonText}>
            Model
          </Text>
        </TouchableOpacity>
      </View>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Dashboard Builder
        </Text>

        <Text style={styles.subtitle}>
          Drag, resize, and rearrange
          widgets
        </Text>
      </View>

      <View style={styles.mainLayout}>
        {/* LEFT */}
        <View style={styles.leftSidebar}>
          <Text style={styles.sidebarTitle}>
            Datasets
          </Text>

          <ScrollView
            style={{ maxHeight: 120 }}
          >
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
                <Text
                  style={styles.fieldText}
                >
                  {dataset.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            value={dashboardName}
            onChangeText={
              setDashboardName
            }
            placeholder="Dashboard Name"
            placeholderTextColor="#777"
            style={styles.nameInput}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveDashboard}
          >
            <Text style={styles.buttonText}>
              Save Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={addKpi}
          >
            <Text style={styles.buttonText}>
              Add KPI
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addSpecificChart("bar")
            }
          >
            <Text style={styles.buttonText}>
              Add Bar Chart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addSpecificChart("line")
            }
          >
            <Text style={styles.buttonText}>
              Add Line Chart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              addSpecificChart("pie")
            }
          >
            <Text style={styles.buttonText}>
              Add Pie Chart
            </Text>
          </TouchableOpacity>
        </View>

        {/* CENTER */}
        <View style={styles.centerCanvas}>
          <View style={styles.reportCanvas}>
            <ResponsiveGridLayout
              className="layout"
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
              rowHeight={60}
              draggableHandle=".dragHandle"
              onLayoutChange={
                onLayoutChange
              }
              margin={[16, 16]}
              isResizable
              isDraggable
            >
              {widgets.map(
                (widget, index) => (
                  <View
                    key={widget.id}
                    data-grid={{
                      i: widget.id,
                      x:
                        widget.layout?.x ||
                        0,
                      y:
                        widget.layout?.y ||
                        0,
                      w:
                        widget.layout?.w ||
                        4,
                      h:
                        widget.layout?.h ||
                        4,
                      minW: 2,
                      minH: 2,
                    }}
                  >
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
                  <Text
                    style={styles.fieldText}
                  >
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
    backgroundColor: "#111827",
  },

  ribbon: {
    height: 52,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },

  ribbonBtn: {
    marginRight: 20,
  },

  ribbonText: {
    color: "#fff",
    fontWeight: "600",
  },

  header: {
    padding: 16,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },

  subtitle: {
    color: "#94a3b8",
    marginTop: 4,
  },

  mainLayout: {
    flex: 1,
    flexDirection: "row",
  },

  leftSidebar: {
    width: 180,
    backgroundColor: "#0f172a",
    padding: 12,
  },

  rightSidebar: {
    width: 180,
    backgroundColor: "#0f172a",
    padding: 12,
  },

  centerCanvas: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    padding: 20,
  },

  reportCanvas: {
    backgroundColor: "#ffffff",
    minHeight: 1200,
    borderRadius: 4,
    padding: 20,
  },

  widget: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 10,
    height: "100%",
    overflow: "hidden",
  },

  kpiWidget: {
    justifyContent: "center",
  },

  chartWidget: {
    flex: 1,
  },

  widgetToolbar: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    zIndex: 10,
  },

  widgetAction: {
    color: "#94a3b8",
    marginLeft: 10,
    fontSize: 14,
  },

  widgetTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },

  kpiValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },

  growth: {
    color: "#22c55e",
    marginTop: 8,
    fontSize: 12,
  },

  dragHandle: {
    backgroundColor: "#1e293b",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },

  dragText: {
    color: "#94a3b8",
    fontSize: 11,
  },

  metaRow: {
    flexDirection: "row",
    marginBottom: 8,
  },

  metaText: {
    color: "#94a3b8",
    marginRight: 14,
    fontSize: 11,
  },

  sidebarTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 14,
  },

  button: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  saveButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  fieldItem: {
    backgroundColor: "#1e293b",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
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
  },
});