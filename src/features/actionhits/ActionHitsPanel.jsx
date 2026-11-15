import { useEffect, useRef, useState } from 'react';
import ActionShotsPanel from './ActionShotsPanel';

export default function ActionHitsPanel({
  t,
  hits,
  shots,
  selectedIds,
  setSelectedIds,
  activeIndex,
  setActiveIndex,
  updateCurrentVideoConfig,
  triggerFramePreview,
  onTapNow,
  videoRef,
}) {
  const [subTab, setSubTab] = useState('hits');
  const picked = new Set(selectedIds || []);
  const dragFromRef = useRef(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    const onUp = () => {
      dragFromRef.current = null;
      didDragRef.current = false;
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const toggleOne = (id, index) => {
    setSelectedIds((ids) => {
      const cur = ids || [];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
    setActiveIndex(index);
    updateCurrentVideoConfig(() => ({ selectedActionHitIndex: index }));
  };

  const unionRange = (from, to) => {
    const a = Math.min(from, to);
    const b = Math.max(from, to);
    const extra = hits.slice(a, b + 1).map((h) => h.id);
    setSelectedIds((ids) => {
      const set = new Set(ids || []);
      extra.forEach((id) => set.add(id));
      return [...set];
    });
    setActiveIndex(to);
    updateCurrentVideoConfig(() => ({ selectedActionHitIndex: to }));
  };

  const togglePause = () => {
    if (picked.size === 0) return;
    const enable = hits.some((h) => picked.has(h.id) && !h.pauseOnHit);
    updateCurrentVideoConfig((v) => ({
      actionHits: (v.actionHits || []).map((h) =>
        picked.has(h.id) ? { ...h, pauseOnHit: enable } : h
      ),
    }));
  };

  const removePicked = () => {
    if (picked.size === 0) return;
    updateCurrentVideoConfig((v) => {
      const next = (v.actionHits || []).filter((h) => !picked.has(h.id));
      setSelectedIds([]);
      setActiveIndex(0);
      return { actionHits: next, selectedActionHitIndex: 0 };
    });
  };

  const clearAll = () => {
    if (!hits.length) return;
    if (!window.confirm(t.actionHitClearConfirm)) return;
    setSelectedIds([]);
    setActiveIndex(0);
    updateCurrentVideoConfig(() => ({ actionHits: [], selectedActionHitIndex: 0 }));
  };

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-fuchsia-900/50 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-fuchsia-200">{t.actionHitTitle}</h2>
        <p className="text-[11px] text-gray-400 mt-1 max-w-2xl">
          {subTab === 'shots' ? t.actionShotHint : t.actionHitHint}
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('hits')}
          className={`px-3 py-1.5 rounded-t-lg text-xs font-semibold cursor-pointer ${
            subTab === 'hits' ? 'bg-fuchsia-950 text-fuchsia-200' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {t.actionHitSubHits}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('shots')}
          className={`px-3 py-1.5 rounded-t-lg text-xs font-semibold cursor-pointer ${
            subTab === 'shots' ? 'bg-fuchsia-950 text-fuchsia-200' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {t.actionHitSubShots}
        </button>
      </div>

      {subTab === 'shots' ? (
        <ActionShotsPanel
          t={t}
          shots={shots || []}
          hits={hits}
          selectedIds={selectedIds || []}
          videoRef={videoRef}
          updateCurrentVideoConfig={updateCurrentVideoConfig}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onTapNow(videoRef.current?.currentTime || 0)}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
            >
              {t.actionHitMarkNow}
            </button>
            <button
              type="button"
              disabled={hits.length === 0}
              onClick={() => setSelectedIds(hits.map((h) => h.id))}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
            >
              {t.actionHitSelectAll}
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={() => setSelectedIds([])}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            >
              {t.actionHitSelectNone}
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={togglePause}
              className="bg-rose-800 hover:bg-rose-700 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
            >
              {hits.some((h) => picked.has(h.id) && h.pauseOnHit) ? t.actionHitPauseOff : t.actionHitPauseOn}
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={removePicked}
              className="text-gray-400 hover:text-red-400 disabled:opacity-40 px-3 py-1.5 text-xs cursor-pointer"
            >
              {t.actionHitRemove}
            </button>
            <button
              type="button"
              disabled={hits.length === 0}
              onClick={clearAll}
              className="text-gray-400 hover:text-red-400 disabled:opacity-40 px-3 py-1.5 text-xs cursor-pointer"
            >
              {t.actionHitClear}
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            {t.actionHitDragHint} · {t.actionHitPickedCount(picked.size, hits.length)}
          </p>

          <div className="space-y-1.5 max-h-64 overflow-y-auto select-none">
            {hits.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 border border-dashed border-gray-800 rounded-lg">
                {t.emptyActionHits}
              </div>
            ) : (
              hits.map((h, index) => {
                const isPicked = picked.has(h.id);
                return (
                  <div
                    key={h.id}
                    onPointerDown={(e) => {
                      if (e.target.closest('input')) return;
                      dragFromRef.current = index;
                      didDragRef.current = false;
                    }}
                    onPointerEnter={() => {
                      if (dragFromRef.current == null) return;
                      if (index === dragFromRef.current) return;
                      didDragRef.current = true;
                      unionRange(dragFromRef.current, index);
                    }}
                    onPointerUp={() => {
                      if (didDragRef.current) return;
                      if (dragFromRef.current !== index) return;
                      toggleOne(h.id, index);
                      triggerFramePreview(h.time, h.name);
                    }}
                    className={`w-full flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${
                      isPicked
                        ? 'bg-fuchsia-950/70 border-fuchsia-500 text-fuchsia-100'
                        : 'bg-gray-950 border-gray-800 text-gray-300'
                    } ${h.pauseOnHit ? 'ring-1 ring-rose-500/70' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => toggleOne(h.id, index)}
                      className="accent-fuchsia-500 cursor-pointer"
                    />
                    <span className="font-mono text-fuchsia-400">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate">{h.name}</span>
                    {h.pauseOnHit ? (
                      <span className="text-[10px] text-rose-300">{t.actionHitPauseMark}</span>
                    ) : null}
                    <span className="ml-auto font-mono text-gray-500">{h.time.toFixed(2)}s</span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
