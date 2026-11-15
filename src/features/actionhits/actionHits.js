export function createActionHit(time, index, nameFn) {
  return {
    id: `act-${Date.now()}-${index}`,
    name: nameFn(index),
    time: Number(Number(time).toFixed(3)),
    pauseOnHit: true,
  };
}

export function addActionHit(hits, time, nameFn) {
  const list = [...(hits || [])];
  const t = Number(time);
  if (!Number.isFinite(t) || t < 0) return list;
  if (list.some((h) => Math.abs(h.time - t) < 0.08)) return list;
  list.push(createActionHit(t, list.length + 1, nameFn));
  list.sort((a, b) => a.time - b.time);
  return list.map((h, i) => ({ ...h, name: h.name || nameFn(i + 1) }));
}

export function hitsInTimeRange(hits, start, end) {
  const lo = Math.min(Number(start), Number(end));
  const hi = Math.max(Number(start), Number(end));
  return (hits || []).filter((h) => h.time >= lo - 0.04 && h.time <= hi + 0.04);
}

export function actionHitsToPauseMarks(hits) {
  return (hits || [])
    .filter((h) => h.pauseOnHit)
    .map((h) => ({
      time: Number(h.time),
      key: `act-${h.id}`,
      beat: 1,
      name: h.name,
      phraseId: h.id,
      kind: 'action',
    }));
}
