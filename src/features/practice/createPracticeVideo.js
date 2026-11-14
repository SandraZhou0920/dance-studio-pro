/** 扒舞练习室单个视频的默认工程数据（与剪辑工作台的素材结构独立）。 */
export const createPracticeVideoEntry = (file, idx = 0) => ({
  id: `vid-${Date.now()}-${idx}`,
  name: file.name,
  file,
  segments: [],
  mirrorZones: [],
  mirrorStrategy: 'auto',
  globalRate: 1.0,
  syncLoopRate: false,
  loopFullTrack: true,
  playMode: 'practice',
  highlightsMode: 'sequential',
  playerScale: 1,
  selectedSegmentIndex: 0,
  selectedMirrorIndex: 0,
});
