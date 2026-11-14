import { get, set, del, keys } from 'idb-keyval';

/**
 * Project = {
 *   id, theme: 'dance' | 'edit', title, updatedAt,
 *   activeVideoIndex, activeFeatureTab: 'loop' | 'mirror',
 *   videos: [{
 *     id, name, file,
 *     segments: [{ id, name, start, end, targetLoops, playbackRate }],
 *     mirrorZones: [{ id, name, start, end, isMirrored }],
 *     mirrorStrategy: 'auto' | 'forceOn' | 'forceOff',
 *     globalRate, syncLoopRate, loopFullTrack,
 *     playMode, highlightsMode, playerScale,
 *     selectedSegmentIndex, selectedMirrorIndex,
 *   }]
 * }
 */

const getPrefix = (theme) => `studio-${theme}-project-`;

// 获取指定主题下的所有项目（按最近修改排序）
export async function getProjectsByTheme(theme) {
  const prefix = getPrefix(theme);
  const allKeys = await keys();
  const projectKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(prefix));
  const projects = await Promise.all(projectKeys.map((k) => get(k)));
  return projects.filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
}

// 保存或更新整个项目
export async function saveProject(project) {
  const key = `${getPrefix(project.theme)}${project.id}`;
  const updated = {
    ...project,
    updatedAt: Date.now(),
  };
  await set(key, updated);
  return updated;
}

// 删除项目
export async function deleteProject(theme, projectId) {
  await del(`${getPrefix(theme)}${projectId}`);
}