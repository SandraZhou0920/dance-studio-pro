import { useEffect } from 'react';

export default function usePracticeShortcuts({
  currentVideo,
  videoRef,
  activeFeatureTab,
  activeSegmentIndex,
  activeEightBeatIndex,
  activeMirrorIndex,
  statusInfo,
  updateCurrentVideoConfig,
  reflowEightBeatAt,
}) {
  useEffect(() => {
    if (!currentVideo) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const currentSeg = currentVideo.segments[activeSegmentIndex];
      const currentZone = (currentVideo.mirrorZones || [])[activeMirrorIndex];
      const video = videoRef.current;

      if (e.key.toLowerCase() === 'a' && video) {
        const now = Number(video.currentTime.toFixed(2));
        if (activeFeatureTab === 'mirror' && currentZone) {
          updateCurrentVideoConfig((v) => ({
            mirrorZones: (v.mirrorZones || []).map((z, i) =>
              i === activeMirrorIndex
                ? { ...z, start: now, end: now >= z.end ? now + 3 : z.end }
                : z
            ),
          }));
        } else if (activeFeatureTab === 'eightBeat') {
          const phrase = (currentVideo.eightBeatPhrases || [])[activeEightBeatIndex];
          if (!phrase) return;
          reflowEightBeatAt(phrase.id, now, now >= phrase.end ? now + 3 : phrase.end);
        } else if (activeFeatureTab === 'eightBeatTap' || activeFeatureTab === 'actionHits') {
          return;
        } else if (activeFeatureTab !== 'mirror' && currentSeg) {
          updateCurrentVideoConfig((v) => ({
            segments: v.segments.map((s, i) =>
              i === activeSegmentIndex
                ? { ...s, start: now, end: now >= s.end ? now + 3 : s.end }
                : s
            ),
          }));
        }
      } else if (e.key.toLowerCase() === 'b' && video) {
        const now = Number(video.currentTime.toFixed(2));
        if (activeFeatureTab === 'mirror' && currentZone) {
          updateCurrentVideoConfig((v) => ({
            mirrorZones: (v.mirrorZones || []).map((z, i) =>
              i === activeMirrorIndex
                ? { ...z, start: now <= z.start ? Math.max(0, now - 3) : z.start, end: now }
                : z
            ),
          }));
        } else if (activeFeatureTab === 'eightBeat') {
          const phrase = (currentVideo.eightBeatPhrases || [])[activeEightBeatIndex];
          if (!phrase) return;
          reflowEightBeatAt(
            phrase.id,
            now <= phrase.start ? Math.max(0, now - 3) : phrase.start,
            now
          );
        } else if (activeFeatureTab === 'eightBeatTap' || activeFeatureTab === 'actionHits') {
          return;
        } else if (activeFeatureTab !== 'mirror' && currentSeg) {
          updateCurrentVideoConfig((v) => ({
            segments: v.segments.map((s, i) =>
              i === activeSegmentIndex
                ? { ...s, start: now <= s.start ? Math.max(0, now - 3) : s.start, end: now }
                : s
            ),
          }));
        }
      } else if (e.key === '[' || e.key === '-') {
        if (statusInfo.inLoop && !currentVideo.syncLoopRate && currentSeg) {
          updateCurrentVideoConfig((v) => ({
            segments: v.segments.map((s, i) =>
              i === activeSegmentIndex
                ? {
                    ...s,
                    playbackRate: Math.max(0.25, Number(((s.playbackRate ?? 0.75) - 0.05).toFixed(2))),
                  }
                : s
            ),
          }));
        } else {
          updateCurrentVideoConfig((v) => ({
            globalRate: Math.max(0.25, Number((v.globalRate - 0.05).toFixed(2))),
          }));
        }
      } else if (e.key === ']' || e.key === '=') {
        if (statusInfo.inLoop && !currentVideo.syncLoopRate && currentSeg) {
          updateCurrentVideoConfig((v) => ({
            segments: v.segments.map((s, i) =>
              i === activeSegmentIndex
                ? {
                    ...s,
                    playbackRate: Math.min(1.5, Number(((s.playbackRate ?? 0.75) + 0.05).toFixed(2))),
                  }
                : s
            ),
          }));
        } else {
          updateCurrentVideoConfig((v) => ({
            globalRate: Math.min(1.5, Number((v.globalRate + 0.05).toFixed(2))),
          }));
        }
      } else if (e.code === 'Space' && video) {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentVideo,
    videoRef,
    activeSegmentIndex,
    activeEightBeatIndex,
    activeMirrorIndex,
    activeFeatureTab,
    statusInfo.inLoop,
    updateCurrentVideoConfig,
    reflowEightBeatAt,
  ]);
}
