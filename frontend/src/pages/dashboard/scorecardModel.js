export function baselineLabel(beatsBaseline) {
  return beatsBaseline ? "Better than baseline" : "Not better than baseline yet";
}

export function hasResolvedPredictions(stats = {}) {
  return [5, 10, 30].some((horizon) => Number(stats[String(horizon)]?.count || 0) > 0);
}
