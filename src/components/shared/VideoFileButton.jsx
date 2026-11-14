/**
 * 点击落在真实 file input 上，且不设 accept。
 * macOS 上 accept="video/*" 会打开照片图库，HEVC/MOV 经常无法点「打开」。
 */
export default function VideoFileButton({ id, className, children, onChange }) {
  return (
    <label htmlFor={id} className={`relative inline-flex overflow-hidden ${className}`}>
      <span className="pointer-events-none">{children}</span>
      <input
        id={id}
        type="file"
        multiple
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
