export type WidgetType =
  | "stacked-bar"
  | "stacked-column"
  | "area"
  | "clustered-bar"
  | "clustered-column"
  | "hundred-bar"
  | "hundred-column"
  | "line"
  | "stacked-area"
  | "hundred-area"
  | "line-stacked-column"
  | "line-clustered-column"
  | "ribbon"
  | "waterfall"
  | "funnel"
  | "scatter"
  | "pie"
  | "donut"
  | "treemap"
  | "map"
  | "filled-map"
  | "shape-map"
  | "card"
  | "kpi"
  | "slicer"
  | "table"
  | "matrix"
  | "decomposition-tree";

export const visualTitles: Record<WidgetType, string> = {
  "stacked-bar": "Stacked Bar Chart",
  "stacked-column": "Stacked Column Chart",
  area: "Area Chart",
  "clustered-bar": "Clustered Bar Chart",
  "clustered-column": "Clustered Column Chart",
  "hundred-bar": "100% Stacked Bar Chart",
  "hundred-column": "100% Stacked Column Chart",
  line: "Line Chart",
  "stacked-area": "Stacked Area Chart",
  "hundred-area": "100% Stacked Area Chart",
  "line-stacked-column": "Line and Stacked Column Chart",
  "line-clustered-column": "Line and Clustered Column Chart",
  ribbon: "Ribbon Chart",
  waterfall: "Waterfall Chart",
  funnel: "Funnel",
  scatter: "Scatter Chart",
  pie: "Pie Chart",
  donut: "Donut Chart",
  treemap: "Treemap",
  map: "Map",
  "filled-map": "Filled Map",
  "shape-map": "Shape Map",
  card: "Card",
  kpi: "KPI",
  slicer: "Slicer",
  table: "Table",
  matrix: "Matrix",
  "decomposition-tree": "Decomposition Tree",
};

export const kpiVisualTypes = ["kpi", "card"];
export const pieVisualTypes = ["pie", "donut"];
export const mapVisualTypes = ["map", "filled-map", "shape-map"];
export const tableVisualTypes = ["table", "matrix", "slicer", "decomposition-tree"];
export const areaVisualTypes = ["area", "stacked-area", "hundred-area"];
export const lineVisualTypes = ["line"];
