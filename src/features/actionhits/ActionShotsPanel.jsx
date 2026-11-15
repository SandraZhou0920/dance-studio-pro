import { useEffect, useMemo, useState } from 'react';
import { captureVideoFrame, createActionShot, waitForSeek } from './captureFrame';

const PER_PAGE = 8;

export default function ActionShotsPanel({ t, shots, hits, selectedIds, videoRef, updateCurrentVideoConfig }) {
  const [page, setPage] = useState(0);
  const [zoomedId, setZoomedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const urls = useMemo(() => {
    const map = new Map();
    (shots || []).forEach((s) => {
      if (s.blob) map.set(s.id, URL.createObjectURL(s.blob));
    });
    return map;
  }, [shots]);

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);

  const pages = Math.max(1, Math.ceil((shots || []).length / PER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const slice = (shots || []).slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);
  const zoomed = (shots || []).find((s) => s.id === zoomedId);

  const persist = (next) => updateCurrentVideoConfig(() => ({ actionShots: next }));

  const captureNow = async () => {
    const video = videoRef.current;
    if (!video || busy) return;
    setBusy(true);
    try {
      const blob = await captureVideoFrame(video);
      const shot = createActionShot({
        blob,
        time: video.currentTime || 0,
        name: t.actionShotName((shots || []).length + 1, (video.currentTime || 0).toFixed(2)),
      });
      persist([...(shots || []), shot]);
      setPage(Math.floor((shots || []).length / PER_PAGE));
    } catch {
      /* decode / empty frame */
    } finally {
      setBusy(false);
    }
  };

  const captureSelected = async () => {
    const video = videoRef.current;
    const pickedHits = (hits || []).filter((h) => selectedIds.includes(h.id));
    if (!video || !pickedHits.length || busy) return;
    setBusy(true);
    const next = [...(shots || [])];
    try {
      for (const hit of pickedHits) {
        await waitForSeek(video, hit.time);
        const blob = await captureVideoFrame(video);
        next.push(
          createActionShot({
            blob,
            time: hit.time,
            name: t.actionShotName(next.length + 1, hit.time.toFixed(2)),
            hitId: hit.id,
          })
        );
      }
      persist(next);
      setPage(Math.floor((next.length - 1) / PER_PAGE));
    } catch {
      persist(next);
    } finally {
      setBusy(false);
    }
  };

  const removeShot = (id) => {
    const next = (shots || []).filter((s) => s.id !== id);
    persist(next);
    if (zoomedId === id) setZoomedId(null);
    const nextPages = Math.max(1, Math.ceil(next.length / PER_PAGE));
    setPage((p) => Math.min(p, nextPages - 1));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400">{t.actionShotHint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={captureNow}
          className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
        >
          {busy ? t.actionShotWorking : t.actionShotCapture}
        </button>
        <button
          type="button"
          disabled={busy || !selectedIds.length}
          onClick={captureSelected}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
        >
          {t.actionShotCaptureSelected(selectedIds.length)}
        </button>
        <span className="ml-auto text-[11px] text-gray-500">
          {t.actionShotPage(safePage + 1, pages)} · {t.actionShotCount((shots || []).length)}
        </span>
      </div>

      {slice.length === 0 ? (
        <div className="text-center py-10 text-xs text-gray-500 border border-dashed border-gray-800 rounded-lg">
          {t.emptyActionShots}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {slice.map((s) => (
            <div key={s.id} className="relative group rounded-lg overflow-hidden border border-gray-800 bg-black">
              <button
                type="button"
                onClick={() => setZoomedId(s.id)}
                className="block w-full cursor-pointer"
              >
                {urls.get(s.id) ? (
                  <img src={urls.get(s.id)} alt={s.name} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="aspect-video bg-gray-800" />
                )}
              </button>
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-1 px-1.5 py-1 bg-black/70 text-[10px] text-gray-200">
                <span className="truncate">{s.name}</span>
                <button
                  type="button"
                  onClick={() => removeShot(s.id)}
                  className="shrink-0 text-rose-300 hover:text-rose-100 cursor-pointer"
                >
                  {t.actionShotDelete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-2 py-1 rounded bg-gray-800 disabled:opacity-40 text-xs cursor-pointer"
          >
            {t.actionShotPrev}
          </button>
          <span className="text-xs font-mono text-fuchsia-300">
            {safePage + 1}/{pages}
          </span>
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            className="px-2 py-1 rounded bg-gray-800 disabled:opacity-40 text-xs cursor-pointer"
          >
            {t.actionShotNext}
          </button>
        </div>
      )}

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setZoomedId(null)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {urls.get(zoomed.id) ? (
              <img
                src={urls.get(zoomed.id)}
                alt={zoomed.name}
                className="w-full max-h-[82vh] object-contain rounded-lg bg-black"
              />
            ) : null}
            <div className="mt-2 flex items-center justify-between text-sm text-gray-200">
              <span>{zoomed.name}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => removeShot(zoomed.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-xs cursor-pointer"
                >
                  {t.actionShotDelete}
                </button>
                <button
                  type="button"
                  onClick={() => setZoomedId(null)}
                  className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs cursor-pointer"
                >
                  {t.actionShotClose}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
