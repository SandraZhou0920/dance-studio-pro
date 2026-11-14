import { get, set, del, keys } from 'idb-keyval';

/**
 * 数据结构定义：
 * Project = {
 *   id: string,
 *   theme: 'dance' | 'edit',
 *   title: string,
 *   updatedAt: number,
 *   videos: [
 *     {
 *       id: string,
 *       name: string,
 *       file: File, // 二进制视频文件
 *       segments: Array<{ id, name, start, end, targetLoops }>,
 *       globalRate: number,
 *       loopRate: number,
 *       syncLoopRate: boolean,
 *       isMirrored: boolean
 *     }
 *   ]
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