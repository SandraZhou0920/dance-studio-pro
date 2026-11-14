import { LIBRARY_MEDIA_ACCEPT } from '../../utils/pickVideoFiles';

/**
 * 点击落在真实 file input 上。
 * accept 同时包含 image/* 与 video/*，这样 macOS 照片图库里的视频可以点「打开」。
 */
export default function VideoFileButton({ id, className, children, onChange }) {
  return (
    <label htmlFor={id} className={`relative inline-flex overflow-hidden ${className}`}>
      <span className="pointer-events-none">{children}</span>
      <input
        id={id}
        type="file"
        accept={LIBRARY_MEDIA_ACCEPT}
        multiple
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
