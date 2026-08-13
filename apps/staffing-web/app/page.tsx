import Link from "next/link";

const roles = [
  { title: "Worker", description: "Find work, manage offers, assignments, and timesheets.", href: "/worker" },
  { title: "Employer", description: "Create jobs, review candidates, approve placements, and manage billing.", href: "/employer" },
  { title: "Staffing Agency", description: "Manage referrals, placements, assignments, timesheets, and revenue.", href: "/agency" },
];

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px" }}>
      <header style={{ marginBottom: 48 }}>
        <div style={{ fontWeight: 700, letterSpacing: 1 }}>STAFFINGOS</div>
        <h1 style={{ fontSize: 48, margin: "12px 0" }}>Staffing without the building.</h1>
        <p style={{ maxWidth: 680, fontSize: 18, lineHeight: 1.6 }}>
          One standalone platform for workers, employers, and established staffing agencies—from job discovery through placement, timesheets, billing, and payment.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
        {roles.map((role) => (
          <Link key={role.href} href={role.href} style={{ textDecoration: "none", color: "inherit", border: "1px solid #d9dce1", borderRadius: 16, padding: 24, background: "white" }}>
            <h2>{role.title}</h2>
            <p style={{ lineHeight: 1.5 }}>{role.description}</p>
            <strong>Open workspace →</strong>
          </Link>
        ))}
      </section>

      <section style={{ marginTop: 48, padding: 24, borderRadius: 16, background: "#17181b", color: "white" }}>
        <h2>Independent by design</h2>
        <p style={{ lineHeight: 1.6, maxWidth: 760 }}>
          StaffingOS runs as its own product. Jhadina can connect through a separate governance gateway for oversight, intelligence, and policy checks without becoming a dependency.
        </p>
      </section>
    </main>
  );
}
