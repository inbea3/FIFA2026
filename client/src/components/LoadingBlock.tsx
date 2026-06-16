export default function LoadingBlock({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="loading-block">
      <div className="loading-spinner" />
      <span>{label}</span>
    </div>
  );
}
