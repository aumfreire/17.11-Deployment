import Link from "next/link";

const links = [
  { href: "/select-customer", label: "Customer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/place-order", label: "Place order" },
  { href: "/orders", label: "Orders" },
  { href: "/scoring", label: "Scoring" },
  { href: "/warehouse/priority", label: "Warehouse" },
  { href: "/debug/schema", label: "Schema" },
];

export function Nav() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <nav
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "0.65rem 1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem 1.1rem",
          alignItems: "center",
        }}
      >
        <Link href="/" style={{ fontWeight: 600, textDecoration: "none" }}>
          Shop
        </Link>
        {links.map(({ href, label }) => (
          <Link key={href} href={href} style={{ fontSize: "0.9rem" }}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
