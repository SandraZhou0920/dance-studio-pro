import React, { useState, useRef, useEffect, useCallback } from 'react';
import DancePlayer from '../../components/shared/DancePlayer';
import FreeLoopTimeline from '../../components/shared/FreeLoopTimeline';
import { saveProject } from '../../utils/projectCache';
import { clampIndex } from '../../utils/clampIndex';
import { createPracticeVideoEntry } from './createPracticeVideo';
import usePracticeShortcuts from './usePracticeShortcuts';
import LoopControlPanel from './LoopControlPanel';
import MirrorControlPanel from './MirrorControlPanel';
import VideoFileButton from '../../components/shared/VideoFileButton';
import { pickVideoFiles } from '../../utils/pickVideoFiles';

export default function PracticeWorkspace({
  project,
  setProject,
  lang,
  t,
  toggleLanguage,
  onBackToLobby,
}) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(
    clampIndex(project.activeVideoIndex, project.videos.length)
  );
  const [activeFeatureTab, setActiveFeatureTab] = useState(
    project.activeFeatureTab === 'mirror' ? 'mirror' : 'loop'
  );
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [activeMirrorIndex, setActiveMirrorIndex] = useState(0);
  const [playMode, setPlayMode] = useState('practice');
  const [highlightsMode, setHighlightsMode] = useState('sequential');
  const [previewLabel, setPreviewLabel] = useState(null);
  const [statusInfo, setStatusInfo] = useState({ inLoop: false, text: '', actualRate: 1.0 });
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);

  const videoRef = useRef(null);
  const previewTimerRef = useRef(null);

  const currentVideo = project.videos[activeVideoIndex];
  const mirrorZones = currentVideo?.mirrorZones ?? [];
  const activeSeg = currentVideo?.segments[activeSegmentIndex];
  const activeMirrorZone = mirrorZones[activeMirrorIndex];
  const isFullLoop = currentVideo?.loopFullTrack ?? true;
  const mirrorStrategy = currentVideo?.mirrorStrategy ?? 'auto';

  const triggerFramePreview = (targetTime, label) => {
    const video = videoRef.current;
    if (video && !isNaN(targetTime)) {
      // 播放中只加区间、不打断；暂停时才跳帧预览
      if (video.paused) {
        video.currentTime = Math.max(0, Math.min(video.duration || targetTime, targetTime));
      }
    }
    setPreviewLabel(t.previewingBadge(label, targetTime.toFixed(2)));
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => setPreviewLabel(null), 2000);
  };

  useEffect(() => {
    if (!currentVideo?.file) {
      setActiveVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(currentVideo.file);
    setActiveVideoUrl(url);
    setPlayMode(currentVideo.playMode ?? 'practice');
    setHighlightsMode(currentVideo.highlightsMode ?? 'sequential');
    setActiveSegmentIndex(clampIndex(currentVideo.selectedSegmentIndex, currentVideo.segments?.length ?? 0));
    setActiveMirrorIndex(clampIndex(currentVideo.selectedMirrorIndex, currentVideo.mirrorZones?.length ?? 0));
    return () => URL.revokeObjectURL(url);
  }, [project.id, activeVideoIndex]);

  const updateCurrentVideoConfig = useCallback(
    async (updater) => {
      const updatedVideos = project.videos.map((vid, idx) =>
        idx === activeVideoIndex ? { ...vid, ...updater(vid) } : vid
      );
      const updatedProject = { ...project, videos: updatedVideos };
      setProject(updatedProject);
      await saveProject(updatedProject);
    },
    [project, activeVideoIndex, setProject]
  );

  const persistProjectWorkspace = async (patch) => {
    const updated = { ...project, ...patch };
    setProject(updated);
    await saveProject(updated);
  };

  const selectVideoIndex = (idx) => {
    setActiveVideoIndex(idx);
    persistProjectWorkspace({ activeVideoIndex: idx });
  };

  const selectFeatureTab = (tab) => {
    setActiveFeatureTab(tab);
    persistProjectWorkspace({ activeFeatureTab: tab });
  };

  const persistPlayMode = (mode) => {
    setPlayMode(mode);
    updateCurrentVideoConfig(() => ({ playMode: mode }));
  };

  const persistHighlightsMode = (mode) => {
    setHighlightsMode(mode);
    updateCurrentVideoConfig(() => ({ highlightsMode: mode }));
  };

  const persistSelectedSegment = (idx) => {
    setActiveSegmentIndex(idx);
    updateCurrentVideoConfig(() => ({ selectedSegmentIndex: idx }));
  };

  const persistSelectedMirror = (idx) => {
    setActiveMirrorIndex(idx);
    updateCurrentVideoConfig(() => ({ selectedMirrorIndex: idx }));
  };

  const moveSegment = (fromIndex, direction) => {
    if (!currentVideo) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= currentVideo.segments.length) return;
    const updated = [...currentVideo.segments];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setActiveSegmentIndex(toIndex);
    updateCurrentVideoConfig(() => ({
      segments: updated,
      selectedSegmentIndex: toIndex,
    }));
  };

  const handleAddVideos = async (e) => {
    const files = pickVideoFiles(e.target.files);
    e.target.value = '';
    if (files.length === 0) {
      window.alert(t.noVideoFilesSelected);
      return;
    }
    try {
      const newEntries = files.map((file, idx) => createPracticeVideoEntry(file, idx));
      const nextIndex = project.videos.length;
      const saved = await saveProject({
        ...project,
        videos: [...project.videos, ...newEntries],
        activeVideoIndex: nextIndex,
      });
      setProject(saved);
      setActiveVideoIndex(nextIndex);
    } catch (err) {
      console.error(err);
      window.alert(t.saveProjectFail);
    }
  };

  const handleRemoveVideo = async (e, idxToRemove) => {
    e.stopPropagation();
    if (project.videos.length <= 1) return;
    const updatedVideos = project.videos.filter((_, idx) => idx !== idxToRemove);
    let nextIndex = activeVideoIndex;
    if (idxToRemove === activeVideoIndex) {
      nextIndex = Math.min(idxToRemove, updatedVideos.length - 1);
    } else if (idxToRemove < activeVideoIndex) {
      nextIndex = activeVideoIndex - 1;
    }
    const saved = await saveProject({
      ...project,
      videos: updatedVideos,
      activeVideoIndex: nextIndex,
    });
    setProject(saved);
    setActiveVideoIndex(nextIndex);
  };

  usePracticeShortcuts({
    currentVideo,
    videoRef,
    activeFeatureTab,
    activeSegmentIndex,
    activeMirrorIndex,
    statusInfo,
    updateCurrentVideoConfig,
  });

  return (
    <div dir="ltr" className="min-h-screen bg-gray-950 text-white p-5 flex flex-col gap-4">
      <header className="flex flex-wrap justify-between items-center border-b border-gray-800 pb-3 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLobby}
            className="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-200 cursor-pointer"
          >
            {t.backToLobby}
          </button>
          <input
            type="text"
            value={project.title}
            onChange={async (e) => {
              const updated = { ...project, title: e.target.value };
              setProject(updated);
              await saveProject(updated);
            }}
            className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-indigo-500 text-lg font-bold focus:outline-none px-1"
          />
          {activeVideoUrl && statusInfo.text && (
            <div
              className={`text-xs px-3 py-1 rounded-full border flex items-center gap-2 ${
                statusInfo.inLoop
                  ? 'bg-rose-950/60 text-rose-300 border-rose-700'
                  : 'bg-gray-900 text-gray-300 border-gray-700'
              }`}
            >
              <span>{statusInfo.text}</span>
              <span className="font-mono font-bold text-indigo-400">
                ({statusInfo.actualRate.toFixed(2)}x)
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-medium text-gray-300 cursor-pointer"
          >
            {lang === 'zh' ? 'English' : '中文'}
          </button>
          <VideoFileButton
            id="workspace-video-files"
            onChange={handleAddVideos}
            className="bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium"
          >
            {t.addVideosToProject}
          </VideoFileButton>
        </div>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {t.projectAssets(project.videos.length)}
        </span>
        {project.videos.map((vid, idx) => {
          const isSelected = idx === activeVideoIndex;
          return (
            <div
              key={vid.id}
              onClick={() => selectVideoIndex(idx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition whitespace-nowrap ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-400 text-white font-medium'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              <span className="max-w-[180px] truncate">{vid.name}</span>
              {project.videos.length > 1 && (
                <button
                  onClick={(e) => handleRemoveVideo(e, idx)}
                  className={`ml-1 hover:text-red-300 ${isSelected ? 'text-indigo-200' : 'text-gray-500'}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {currentVideo && activeVideoUrl && (
        <>
          <DancePlayer
            videoRef={videoRef}
            videoUrl={activeVideoUrl}
            segments={currentVideo.segments}
            mirrorZones={mirrorZones}
            mirrorStrategy={mirrorStrategy}
            activeSegmentIndex={activeSegmentIndex}
            setActiveSegmentIndex={setActiveSegmentIndex}
            playerScale={currentVideo.playerScale ?? 1}
            onScaleChange={(scale) => updateCurrentVideoConfig(() => ({ playerScale: scale }))}
            playMode={playMode}
            highlightsMode={highlightsMode}
            loopFullTrack={isFullLoop}
            globalRate={currentVideo.globalRate}
            syncLoopRate={currentVideo.syncLoopRate}
            previewLabel={previewLabel}
            onStatusUpdate={setStatusInfo}
            t={t}
          />

          <div dir="ltr" className="flex items-center gap-2 border-b border-gray-800 pb-2">
            <button
              onClick={() => selectFeatureTab('loop')}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold cursor-pointer transition border-b-2 ${
                activeFeatureTab === 'loop'
                  ? 'bg-gray-900 text-indigo-400 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-200 border-transparent'
              }`}
            >
              {t.tabLoopFeature}
            </button>
            <button
              onClick={() => selectFeatureTab('mirror')}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold cursor-pointer transition border-b-2 ${
                activeFeatureTab === 'mirror'
                  ? 'bg-gray-900 text-cyan-400 border-cyan-500'
                  : 'text-gray-400 hover:text-gray-200 border-transparent'
              }`}
            >
              {t.tabMirrorFeature}
            </button>
          </div>

          <FreeLoopTimeline
            videoUrl={activeVideoUrl}
            videoRef={videoRef}
            editTarget={activeFeatureTab}
            segments={currentVideo.segments}
            mirrorZones={mirrorZones}
            activeSegmentId={activeSeg?.id}
            activeMirrorId={activeMirrorZone?.id}
            syncLoopRate={currentVideo.syncLoopRate}
            globalRate={currentVideo.globalRate}
            onSelectSegment={(id) => {
              const idx = currentVideo.segments.findIndex((s) => s.id === id);
              if (idx !== -1) {
                persistSelectedSegment(idx);
                triggerFramePreview(currentVideo.segments[idx].start, currentVideo.segments[idx].name);
              }
            }}
            onSelectMirrorZone={(id) => {
              const idx = mirrorZones.findIndex((z) => z.id === id);
              if (idx !== -1) {
                persistSelectedMirror(idx);
                triggerFramePreview(mirrorZones[idx].start, mirrorZones[idx].name);
              }
            }}
            onUpdateSegment={(segId, updates) => {
              updateCurrentVideoConfig((v) => ({
                segments: v.segments.map((s) => (s.id === segId ? { ...s, ...updates } : s)),
              }));
            }}
            onUpdateMirrorZone={(zoneId, updates) => {
              updateCurrentVideoConfig((v) => ({
                mirrorZones: (v.mirrorZones || []).map((z) =>
                  z.id === zoneId ? { ...z, ...updates } : z
                ),
              }));
            }}
            onAddSegment={(start, end) => {
              const newSeg = {
                id: `seg-${Date.now()}`,
                name: t.defaultSegName(currentVideo.segments.length + 1),
                start,
                end,
                targetLoops: 3,
                playbackRate: 0.75,
              };
              updateCurrentVideoConfig((v) => {
                const updated = [...v.segments, newSeg];
                const idx = updated.length - 1;
                setActiveSegmentIndex(idx);
                return { segments: updated, selectedSegmentIndex: idx };
              });
            }}
            onAddMirrorZone={(start, end) => {
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
            }}
            onPreviewFrame={triggerFramePreview}
            onSeek={(time) => {
              if (videoRef.current) videoRef.current.currentTime = time;
            }}
            t={t}
          />

          {activeFeatureTab === 'loop' && (
            <LoopControlPanel
              t={t}
              currentVideo={currentVideo}
              videoRef={videoRef}
              playMode={playMode}
              highlightsMode={highlightsMode}
              activeSegmentIndex={activeSegmentIndex}
              persistPlayMode={persistPlayMode}
              persistHighlightsMode={persistHighlightsMode}
              persistSelectedSegment={persistSelectedSegment}
              updateCurrentVideoConfig={updateCurrentVideoConfig}
              setActiveSegmentIndex={setActiveSegmentIndex}
              moveSegment={moveSegment}
              triggerFramePreview={triggerFramePreview}
            />
          )}

          {activeFeatureTab === 'mirror' && (
            <MirrorControlPanel
              t={t}
              currentVideo={currentVideo}
              videoRef={videoRef}
              mirrorZones={mirrorZones}
              mirrorStrategy={mirrorStrategy}
              activeMirrorIndex={activeMirrorIndex}
              persistSelectedMirror={persistSelectedMirror}
              updateCurrentVideoConfig={updateCurrentVideoConfig}
              setActiveMirrorIndex={setActiveMirrorIndex}
              triggerFramePreview={triggerFramePreview}
            />
          )}
        </>
      )}
    </div>
  );
}
