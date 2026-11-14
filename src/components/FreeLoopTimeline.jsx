import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

export default function FreeLoopTimeline({
  videoUrl,
  videoRef,            // 与播放器共用同一时间轴，仅同步光标，不接管 <video>
  editTarget,          // 'loop' | 'mirror' —— 决定当前时间轴操作的是循环段还是镜面区间
  segments,
  mirrorZones,
  activeSegmentId,
  activeMirrorId,
  syncLoopRate,
  globalRate,
  onSelectSegment,
  onSelectMirrorZone,
  onUpdateSegment,
  onUpdateMirrorZone,
  onAddSegment,
  onAddMirrorZone,
  onPreviewFrame,      // 拖动边缘或选中时，实时让播放器画面跳到对应秒数预览
  onSeek,
  t,
}) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const regionsPluginRef = useRef(null);
  const syncingFromVideoRef = useRef(false);

  // 使用 ref 保持最新回调，避免 WaveSurfer 闭包过期
  const callbacksRef = useRef({
    editTarget,
    onSelectSegment,
    onSelectMirrorZone,
    onUpdateSegment,
    onUpdateMirrorZone,
    onAddSegment,
    onAddMirrorZone,
    onPreviewFrame,
    onSeek,
  });

  useEffect(() => {
    callbacksRef.current = {
      editTarget,
      onSelectSegment,
      onSelectMirrorZone,
      onUpdateSegment,
      onUpdateMirrorZone,
      onAddSegment,
      onAddMirrorZone,
      onPreviewFrame,
      onSeek,
    };
  });

  useEffect(() => {
    if (!videoUrl || !containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4b5563',
      progressColor: '#6366f1',
      cursorColor: '#f43f5e',
      height: 90,
      barWidth: 2,
      url: videoUrl,
      // 独立解码波形，不把播放器 <video> 交给 WaveSurfer，避免抢走 playbackRate
      interact: true,
      dragToSeek: true,
      autoplay: false,
    });

    const wsRegions = ws.registerPlugin(RegionsPlugin.create());
    wsRef.current = ws;
    regionsPluginRef.current = wsRegions;

    ws.setMuted(true);
    ws.setVolume(0);

    // WaveSurfer 自带隐藏音轨，禁止它发声或自行播放，时间只跟视频走
    ws.on('play', () => {
      ws.pause();
    });

    ws.on('ready', () => {
      ws.pause();
      ws.setMuted(true);
      wsRegions.enableDragSelection({
        color: 'rgba(99, 102, 241, 0.3)',
      });
      const video = videoRef?.current;
      if (video && !Number.isNaN(video.currentTime)) {
        syncingFromVideoRef.current = true;
        ws.setTime(video.currentTime);
        syncingFromVideoRef.current = false;
      }
    });

    ws.on('interaction', (newTime) => {
      if (syncingFromVideoRef.current) return;
      callbacksRef.current.onSeek?.(newTime);
    });

    let rafId = 0;
    let syncCancelled = false;
    const syncPlayhead = () => {
      if (syncCancelled) return;
      const video = videoRef?.current;
      if (video && ws.getDuration()) {
        const videoTime = video.currentTime || 0;
        if (Math.abs(ws.getCurrentTime() - videoTime) > 0.03) {
          syncingFromVideoRef.current = true;
          ws.setTime(videoTime);
          syncingFromVideoRef.current = false;
        }
      }
      rafId = requestAnimationFrame(syncPlayhead);
    };
    rafId = requestAnimationFrame(syncPlayhead);

    // 在波形上直接框选创建新区间（根据当前所在的 Feature Tab 创建循环段或镜面区间）
    wsRegions.on('region-created', (newRegion) => {
      if (newRegion.id.startsWith('seg-') || newRegion.id.startsWith('mir-')) return;
      const start = Number(newRegion.start.toFixed(2));
      const end = Number(newRegion.end.toFixed(2));
      newRegion.remove();

      if (end - start > 0.25) {
        if (callbacksRef.current.editTarget === 'mirror') {
          callbacksRef.current.onAddMirrorZone(start, end);
        } else {
          callbacksRef.current.onAddSegment(start, end);
        }
        callbacksRef.current.onPreviewFrame?.(start, `${start.toFixed(2)}s`);
      }
    });

    // 拖动选区边缘时，实时更新时间并让视频画面跳转到被拖动的边缘帧进行预览
    wsRegions.on('region-updated', (region, side) => {
      const start = Number(region.start.toFixed(2));
      const end = Number(region.end.toFixed(2));
      const previewTime = side === 'end' ? end : start;

      if (region.id.startsWith('seg-')) {
        callbacksRef.current.onUpdateSegment(region.id, { start, end });
        callbacksRef.current.onPreviewFrame?.(
          previewTime,
          `${side === 'end' ? 'End' : 'Start'} ${previewTime.toFixed(2)}s`
        );
      } else if (region.id.startsWith('mir-')) {
        callbacksRef.current.onUpdateMirrorZone(region.id, { start, end });
        callbacksRef.current.onPreviewFrame?.(
          previewTime,
          `Mirror ${side === 'end' ? 'End' : 'Start'} ${previewTime.toFixed(2)}s`
        );
      }
    });

    // 点击选区时选中它，并预览起始画面
    wsRegions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      if (region.id.startsWith('seg-')) {
        callbacksRef.current.onSelectSegment(region.id);
      } else if (region.id.startsWith('mir-')) {
        callbacksRef.current.onSelectMirrorZone(region.id);
      }
    });

    return () => {
      syncCancelled = true;
      cancelAnimationFrame(rafId);
      ws.destroy();
    };
  }, [videoUrl, videoRef]);

  // 根据当前处于「循环 Feature」还是「镜面 Feature」，渲染对应的可交互区间
  useEffect(() => {
    const wsRegions = regionsPluginRef.current;
    if (!wsRegions) return;

    wsRegions.clearRegions();

    if (editTarget === 'mirror') {
      // 镜面设置模式下：全部渲染镜面区间，可自由选中与拖拽
      (mirrorZones || []).forEach((zone, index) => {
        const isSelected = zone.id === activeMirrorId;
        wsRegions.addRegion({
          id: zone.id,
          start: zone.start,
          end: zone.end,
          content: `#${index + 1} ${zone.name}`,
          color: isSelected ? 'rgba(6, 182, 212, 0.45)' : 'rgba(6, 182, 212, 0.25)',
          drag: true,
          resize: true,
        });
      });
    } else {
      // 循环设置模式下：渲染所有循环段
      segments.forEach((seg, index) => {
        const isActive = seg.id === activeSegmentId;
        const displayRate = syncLoopRate ? globalRate : (seg.playbackRate ?? 0.75);
        wsRegions.addRegion({
          id: seg.id,
          start: seg.start,
          end: seg.end,
          content: `#${index + 1} ${seg.name} (${seg.targetLoops}${t.segRepeatUnit} · ${displayRate.toFixed(2)}x)`,
          color: isActive ? 'rgba(244, 63, 94, 0.45)' : 'rgba(99, 102, 241, 0.28)',
          drag: true,
          resize: true,
        });
      });
    }
  }, [editTarget, segments, mirrorZones, activeSegmentId, activeMirrorId, syncLoopRate, globalRate, t]);

  return (
    <div className="w-full bg-gray-900 p-4 rounded-xl border border-gray-800">
      <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
        <span>
          {editTarget === 'mirror' ? t.timelineHintMirror : t.timelineHintLoop}
        </span>
        <span className={editTarget === 'mirror' ? 'text-cyan-400' : 'text-indigo-400'}>
          {editTarget === 'mirror'
            ? t.timelineTotalMirror((mirrorZones || []).length)
            : t.timelineTotalLoop(segments.length)}
        </span>
      </div>
      <div ref={containerRef} dir="ltr" className="w-full" />
    </div>
  );
}