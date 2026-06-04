export const detectVisualFromPrompt = (prompt: string) => {
  const text = prompt.toLowerCase();

  if (text.includes("pie")) return "pie";
  if (text.includes("line") || text.includes("trend")) return "line";
  if (text.includes("card") || text.includes("kpi") || text.includes("total")) return "kpi";

  return "clustered-column";
};