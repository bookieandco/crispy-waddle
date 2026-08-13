import Link from "next/link";

export default function WorkerPage() {
  return <Workspace title="Worker Workspace" items={["Find jobs", "My referrals", "My offers", "My assignments", "Timesheets"]} />;
}

function Workspace({ title, items }: { title: string; items: string[] }) {
  return <main style={{ maxWidth: 1000, margin: "0 auto", padding: 40 }}><Link href="/">← StaffingOS</Link><h1>{title}</h1><div style={{ display: "grid", gap: 12, marginTop: 24 }}>{items.map((item) => <div key={item} style={{ padding: 20, background: "white", border: "1px solid #ddd", borderRadius: 12 }}>{item}</div>)}</div></main>;
}
