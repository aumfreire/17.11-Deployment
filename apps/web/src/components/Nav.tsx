"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/select-customer", label: "Customer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/place-order", label: "Place order" },
  { href: "/orders", label: "Orders" },
  { href: "/scoring", label: "Scoring" },
  { href: "/warehouse/priority", label: "Warehouse" },
  { href: "/debug/schema", label: "Schema" },
];

function linkIsActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/") return false;
  return pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname() ?? "";

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Primary">
        <Link href="/" className="brand">
          <span className="brand-icon" aria-hidden="true" />
          <span className="brand-text">
            <span className="brand-mark">Shop Ops</span>
            <span className="brand-sub">IS 455 · Ch.17</span>
          </span>
        </Link>
        <div className="nav-links">
          {links.map(({ href, label }) => {
            const active = linkIsActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link${active ? " nav-link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
