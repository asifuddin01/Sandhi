import type { Metadata } from "next";
import type { ReactNode } from "react";

import styles from "@/components/admin/Admin.module.css";
import { AdminNav, type AdminNavItem } from "@/components/admin/AdminNav";
import { requireCapability } from "@/lib/authz";
import { can, type Capability } from "@/lib/permissions";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | Administration" },
  robots: { index: false, follow: false },
};

// Managers are listed as they are built; each page enforces its capability.
const sections: Array<AdminNavItem & { capability: Capability }> = [
  { href: "/admin", label: "Dashboard", capability: "admin:access" },
  { href: "/admin/research", label: "Research", capability: "research:manage" },
  { href: "/admin/projects", label: "Projects", capability: "projects:manage" },
  { href: "/admin/news", label: "News", capability: "content:manage" },
  { href: "/admin/events", label: "Events", capability: "content:manage" },
  {
    href: "/admin/opportunities",
    label: "Opportunities",
    capability: "opportunities:manage",
  },
  {
    href: "/admin/resources",
    label: "Resources",
    capability: "content:manage",
  },
  { href: "/admin/partners", label: "Partners", capability: "partners:manage" },
  { href: "/admin/members", label: "Members", capability: "members:manage" },
  { href: "/admin/settings", label: "Settings", capability: "settings:manage" },
  { href: "/admin/audit", label: "Audit log", capability: "audit:view" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireCapability("admin:access", "/admin");

  return (
    <div className={styles.shell}>
      <AdminNav
        items={sections
          .filter((section) => can(viewer.role, section.capability))
          .map(({ href, label }) => ({ href, label }))}
      />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
