export function decideTrade({ yesPrice, noPrice }) {
  if (!Number.isFinite(yesPrice) || !Number.isFinite(noPrice)) return null;

  // Example logic (replace later)
  if (yesPrice < 0.45) {
    return { side: "YES" };
  }

  if (noPrice < 0.45) {
    return { side: "NO" };
  }

  return null;
}