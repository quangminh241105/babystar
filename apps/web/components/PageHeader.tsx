export default function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", marginBottom: 8 }}>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

