export default function Loading({ label = "Loading your BabyStar space…" }: { label?: string }) {
  return <div className="card"><p className="muted">{label}</p></div>;
}

