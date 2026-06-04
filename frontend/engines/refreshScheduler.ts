export const createRefreshSchedule = (minutes: number) => ({
  intervalMinutes: minutes,
  enabled: true,
  nextRefreshAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
});