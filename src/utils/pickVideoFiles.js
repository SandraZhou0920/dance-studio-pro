const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

/**
 * 同时放行照片和视频，macOS 图库里的 HEVC/MOV 才不会被「打开」按钮禁用。
 * 真正是否当视频用，仍由 pickVideoFiles 过滤。
 */
export const LIBRARY_MEDIA_ACCEPT = [
  'image/*',
  'video/*',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/hevc',
  'video/webm',
  '.mp4',
  '.mov',
  '.m4v',
  '.MP4',
  '.MOV',
  '.heic',
].join(',');

function looksLikeMp4(buffer) {
  if (!buffer || buffer.byteLength < 12) return false;
  const mark = new TextDecoder('latin1').decode(buffer.slice(4, 8));
  return mark === 'ftyp';
}

function videoFileName(file) {
  if (file.name && VIDEO_EXT.test(file.name)) return file.name;
  if (file.name) return `${file.name}.mp4`;
  return 'photo-library.mp4';
}

/** 照片图库给的 File 常常不能随机 seek，拷成内存 Blob 后进度条才能拖。 */
async function makeSeekableVideoFile(file) {
  const buf = await file.arrayBuffer();
  if (buf.byteLength === 0) return null;
  const type = file.type && file.type.startsWith('video/') ? file.type : 'video/mp4';
  return new File([buf], videoFileName(file), { type });
}

export function isFileDragEvent(e) {
  return Array.from(e.dataTransfer?.types || []).includes('Files');
}

function isVideoFile(file, head) {
  if (file.type.startsWith('video/')) return true;
  if (VIDEO_EXT.test(file.name)) return true;
  if (file.type.startsWith('image/')) return false;
  return looksLikeMp4(head);
}

/** 从图库 / 文件夹 / 拖放里留下能播的视频（含无扩展名的 Photos 导出）。 */
export async function pickVideoFiles(fileList) {
  const out = [];
  for (const raw of Array.from(fileList || [])) {
    if (!raw) continue;
    let head = null;
    try {
      head = await raw.slice(0, 16).arrayBuffer();
    } catch {
      head = null;
    }
    if (!isVideoFile(raw, head) && raw.size > 0) continue;
    let file = null;
    try {
      file = await makeSeekableVideoFile(raw);
    } catch {
      continue;
    }
    if (!file) continue;
    if (isVideoFile(file, head) || looksLikeMp4(head)) out.push(file);
  }
  return out;
}
