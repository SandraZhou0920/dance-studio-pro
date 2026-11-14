import { clampIndex } from '../../utils/clampIndex';

export default function MirrorControlPanel({
  t,
  currentVideo,
  videoRef,
  mirrorZones,
  mirrorStrategy,
  activeMirrorIndex,
  persistSelectedMirror,
  updateCurrentVideoConfig,
  setActiveMirrorIndex,
  triggerFramePreview,
}) {
  const addZoneAtPlayhead = () => {
    if (!videoRef.current) return;
    const start = Number(videoRef.current.currentTime.toFixed(2));
    const end = Number(Math.min(videoRef.current.duration || start + 6, start + 6).toFixed(2));
    const newZone = {
      id: `mir-${Date.now()}`,
      name: t.defaultMirrorName(mirrorZones.length + 1),
      start,
      end,
      isMirrored: true,
    };
    updateCurrentVideoConfig((v) => {
      const updated = [...(v.mirrorZones || []), newZone].sort((a, b) => a.start - b.start);
      const idx = updated.findIndex((z) => z.id === newZone.id);
      setActiveMirrorIndex(idx);
      return { mirrorStrategy: 'auto', mirrorZones: updated, selectedMirrorIndex: idx };
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 font-medium mr-1">{t.mirrorStrategyLabel}</span>
          <button
            onClick={() => updateCurrentVideoConfig(() => ({ mirrorStrategy: 'auto' }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              mirrorStrategy === 'auto'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t.mirrorModeAuto}
          </button>
          <button
            onClick={() => updateCurrentVideoConfig(() => ({ mirrorStrategy: 'forceOn' }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              mirrorStrategy === 'forceOn'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t.mirrorModeForceOn}
          </button>
          <button
            onClick={() => updateCurrentVideoConfig(() => ({ mirrorStrategy: 'forceOff' }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              mirrorStrategy === 'forceOff'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t.mirrorModeForceOff}
          </button>
        </div>
        <button
          onClick={addZoneAtPlayhead}
          className="bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
        >
          {t.addMirrorZoneBtn}
        </button>
      </div>

      <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
        <h2 className="text-sm font-semibold text-cyan-300 mb-3">{t.mirrorListTitle}</h2>
        {mirrorZones.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-500 border border-dashed border-gray-800 rounded-lg">
            {t.emptyMirrorZones}
          </div>
        ) : (
          <div className="space-y-2.5">
            {mirrorZones.map((zone, index) => {
              const isSelected = index === activeMirrorIndex;
              return (
                <div
                  key={zone.id}
                  onClick={() => {
                    persistSelectedMirror(index);
                    triggerFramePreview(zone.start, zone.name);
                  }}
                  className={`flex flex-wrap items-center justify-between p-3 rounded-lg border transition cursor-pointer gap-3 ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500'
                      : 'bg-gray-800/60 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isSelected ? 'bg-cyan-500 text-gray-950' : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={zone.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateCurrentVideoConfig((v) => ({
                          mirrorZones: v.mirrorZones.map((z) =>
                            z.id === zone.id ? { ...z, name: e.target.value } : z
                          ),
                        }))
                      }
                      className="bg-transparent border-b border-gray-600 focus:border-cyan-400 text-sm font-medium w-28 focus:outline-none"
                    />
                    <div
                      className="flex items-center gap-1.5 text-xs font-mono"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={zone.start}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          updateCurrentVideoConfig((v) => ({
                            mirrorZones: v.mirrorZones.map((z) =>
                              z.id === zone.id ? { ...z, start: val } : z
                            ),
                          }));
                          triggerFramePreview(val, `${zone.name} Start`);
                        }}
                        className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center text-cyan-300 focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-gray-500">→</span>
                      <input
                        type="number"
                        step="0.1"
                        min={zone.start}
                        value={zone.end}
                        onChange={(e) => {
                          const val = Math.max(zone.start + 0.1, parseFloat(e.target.value) || 0);
                          updateCurrentVideoConfig((v) => ({
                            mirrorZones: v.mirrorZones.map((z) =>
                              z.id === zone.id ? { ...z, end: val } : z
                            ),
                          }));
                          triggerFramePreview(val, `${zone.name} End`);
                        }}
                        className="w-16 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-center text-cyan-300 focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-gray-500">s</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        const updated = mirrorZones.filter((_, idx) => idx !== index);
                        const nextIdx = clampIndex(
                          index === activeMirrorIndex
                            ? Math.min(index, updated.length - 1)
                            : index < activeMirrorIndex
                              ? activeMirrorIndex - 1
                              : activeMirrorIndex,
                          updated.length
                        );
                        setActiveMirrorIndex(nextIdx);
                        updateCurrentVideoConfig(() => ({
                          mirrorZones: updated,
                          selectedMirrorIndex: nextIdx,
                        }));
                      }}
                      className="text-gray-500 hover:text-red-400 px-1.5 py-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
