import { create } from 'zustand';

interface Column {
  name: string;
  type: string;
  sample_values: string[];
}

interface Dataset {
  _id: string;
  name: string;
  columns: Column[];
  row_count: number;
  data: any[];
  owner_id: string;
  team_id?: string;
  created_at: string;
  file_type: string;
}

interface ChartConfig {
  chart_type: string;
  dataset_id: string;
  x_axis?: string;
  y_axis?: string[];
  group_by?: string;
  aggregation: string;
  filters: Record<string, any>;
  colors: string[];
  title: string;
  show_legend: boolean;
  show_labels: boolean;
}

interface Chart {
  _id: string;
  name: string;
  config: ChartConfig;
  owner_id: string;
  team_id?: string;
  created_at: string;
  updated_at: string;
}

interface DataState {
  datasets: Dataset[];
  charts: Chart[];
  currentDataset: Dataset | null;
  setDatasets: (datasets: Dataset[]) => void;
  setCharts: (charts: Chart[]) => void;
  setCurrentDataset: (dataset: Dataset | null) => void;
  addDataset: (dataset: Dataset) => void;
  addChart: (chart: Chart) => void;
  removeDataset: (id: string) => void;
  removeChart: (id: string) => void;
}

export const useDataStore = create<DataState>((set) => ({
  datasets: [],
  charts: [],
  currentDataset: null,

  setDatasets: (datasets) => set({ datasets }),
  setCharts: (charts) => set({ charts }),
  setCurrentDataset: (dataset) => set({ currentDataset: dataset }),
  
  addDataset: (dataset) => set((state) => ({ 
    datasets: [...state.datasets, dataset] 
  })),
  
  addChart: (chart) => set((state) => ({ 
    charts: [...state.charts, chart] 
  })),
  
  removeDataset: (id) => set((state) => ({ 
    datasets: state.datasets.filter((d) => d._id !== id) 
  })),
  
  removeChart: (id) => set((state) => ({ 
    charts: state.charts.filter((c) => c._id !== id) 
  })),
}));