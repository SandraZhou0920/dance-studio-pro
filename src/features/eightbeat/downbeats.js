/** 一个八拍内 8 个重拍时间（原片秒，等分）。 */
export function downbeatsInPhrase(phrase, beatsPerPhrase = 8) {
  const start = Number(phrase?.start);
  const end = Number(phrase?.end);
  const n = Math.max(1, Number(beatsPerPhrase) || 8);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const step = (end - start) / n;
  return Array.from({ length: n }, (_, i) => ({
    beat: i + 1,
    time: Number((start + i * step).toFixed(3)),
  }));
}

export function downbeatsForPhrases(phrases, beatsPerPhrase = 8) {
  return (phrases || []).flatMap((p) =>
    downbeatsInPhrase(p, beatsPerPhrase).map((b) => ({
      ...b,
      phraseId: p.id,
      name: p.name,
      key: `${p.id}-${b.beat}`,
    }))
  );
}

export function pauseMarksFromPhrases(phrases, beatsPerPhrase = 8) {
  return downbeatsForPhrases(
    (phrases || []).filter((p) => p.pauseOnDownbeats),
    beatsPerPhrase
  ).sort((a, b) => a.time - b.time);
}

/** 播放头从 prev 走到 now 时碰到的第一拍。倒退不触发；向前跳过也要停在区间内第一拍。 */
export function findCrossedDownbeat(prev, now, marks, skipKey) {
  if (!Number.isFinite(now)) return null;
  const from = Number.isFinite(prev) ? prev : now;
  if (now + 0.02 < from) return null;
  let found = null;
  for (let i = 0; i < (marks || []).length; i += 1) {
    const m = marks[i];
    const key = m.key || `${m.phraseId}-${m.beat}`;
    if (skipKey && key === skipKey) continue;
    if (from < m.time && now >= m.time) {
      found = { ...m, key };
      break;
    }
  }
  return found;
}
