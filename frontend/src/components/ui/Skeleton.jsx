export function Skeleton({ className = "", rounded = "rounded-xl", ...props }) {
  return <div aria-hidden="true" className={`skeleton ${rounded} ${className}`.trim()} {...props} />;
}

export function LoadingCard({ lines = 3, className = "" }) {
  return (
    <div className={`glass-card space-y-4 p-5 ${className}`} aria-label="Loading">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={`h-3 ${index === lines - 1 ? "w-1/2" : "w-full"}`} />)}
    </div>
  );
}
