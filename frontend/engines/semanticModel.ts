export const createSemanticModel = (dataset: any) => ({
  name: dataset?.name ?? "Untitled model",
  tables: [
    {
      name: dataset?.name ?? "Table",
      columns: dataset?.columns ?? [],
      rows: dataset?.rows ?? [],
    },
  ],
  measures: [],
  relationships: [],
});