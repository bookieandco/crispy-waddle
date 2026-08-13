import Link from "next/link";

const navigation = [
  ["Overview", "/command-center"],
  ["Jobs", "/command-center/jobs"],
  ["Candidates", "/command-center/candidates"],
  ["Placements", "/command-center/placements"],
  ["Timesheets", "/command-center/timesheets"],
  ["Finance", "/finance"],
  ["Agreements", "/command-center/agreements"],
];

export default function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "240px 1fr" }}>
      <aside style={{ borderRight: "1px solid #ddd", padding: 20, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ marginBottom: 28 }}><strong>STAFFING</strong><div style={{ opacity: .55, fontSize: 12, marginTop: 4 }}>COMMAND CENTER</div></div>
        <nav style={{ display: "grid", gap: 6 }}>
          {navigation.map(([label, href]) => <Link key={href} href={href} style={{ padding: "10px 12px", borderRadius: 8, textDecoration: "none", color: "inherit" }}>{label}</Link>)}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 32, opacity: .55, fontSize: 12 }}>Independent staffing operations · Jhadina governance optional</div>
      </aside>
      <section>{children}</section>
    </div>
  );
}
