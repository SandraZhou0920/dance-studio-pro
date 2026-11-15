export default function EightBeatTapPanel({
  t,
  phrases,
  tapStart,
  onResetTap,
  onTapNow,
  videoRef,
}) {
  const pending = Number.isFinite(tapStart);
  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-emerald-900/50 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-emerald-200">{t.eightBeatTapTitle}</h2>
        <p className="text-[11px] text-gray-400 mt-1 max-w-2xl">{t.eightBeatTapHint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onTapNow(videoRef.current?.currentTime || 0)}
          className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
        >
          {pending ? t.eightBeatTapMarkEnd : t.eightBeatTapMarkStart}
        </button>
        <button
          type="button"
          disabled={!pending}
          onClick={onResetTap}
          className="text-gray-400 hover:text-white disabled:opacity-40 px-3 py-1.5 text-xs cursor-pointer"
        >
          {t.eightBeatTapReset}
        </button>
        <span className="text-xs font-mono text-emerald-300">
          {pending ? t.eightBeatTapWaitingEnd(tapStart.toFixed(2)) : t.eightBeatTapWaitingStart}
        </span>
      </div>
      <p className="text-[11px] text-gray-500">{t.eightBeatTapCount(phrases.length)}</p>
    </div>
  );
}
