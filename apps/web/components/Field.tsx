export default function Field({ label, name, type = "text", value, onChange, placeholder, required = false }: { label: string; name: string; type?: string; value?: string | number; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; required?: boolean }) {
  return <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder} required={required} /></div>;
}

