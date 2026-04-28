import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
const ReactGridLayout = require("react-grid-layout");
const Responsive = ReactGridLayout.Responsive;
const WidthProvider = ReactGridLayout.WidthProvider;
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

const ResponsiveGridLayout = WidthProvider(Responsive);

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

  return (
    <ScrollView style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Builder</Text>
        <Text style={styles.subtitle}>Drag, resize, and arrange visuals like Power BI</Text>
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

        <ResponsiveGridLayout
           className="layout"
           layouts={{ lg: layout }}
           breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
           cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
           rowHeight={60}
           onLayoutChange={(newLayout: any) => setLayout(newLayout)}
           draggableHandle=".drag-handle"
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
        </ResponsiveGridLayout>
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
});