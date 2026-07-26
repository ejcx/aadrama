"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { SEASON_2_LABEL } from "@/lib/scrim/seasons";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

type NavItem = {
  href: string;
  label: string;
  match?: (path: string) => boolean;
  badge?: { text: string; className: string };
  icon?: React.ReactNode;
};

const primaryNav: NavItem[] = [
  {
    href: "/",
    label: "Live",
    match: (p) => p === "/",
  },
  {
    href: "/tracker",
    label: "Tracker",
    match: (p) => p === "/tracker" || p.startsWith("/tracker/"),
  },
  {
    href: "/scrim",
    label: "Scrim",
    match: (p) => p === "/scrim" || p.startsWith("/scrim/"),
    badge: {
      text: SEASON_2_LABEL,
      className: "bg-violet-950 text-violet-300 border border-violet-800/60",
    },
  },
  {
    href: "/koth",
    label: "King of the Hill",
    match: (p) => p === "/koth" || p.startsWith("/koth/"),
    badge: {
      text: "Beta",
      className: "bg-amber-950 text-amber-300 border border-amber-800/60",
    },
  },
  { href: "/shoutbox", label: "Shoutbox" },
];

const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const pathname = usePathname() || "";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMobileMenuOpen(false);
  };

  const isActive = (item: NavItem) =>
    item.match ? item.match(pathname) : pathname === item.href;

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item);
    const className = `group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-white/[0.06] text-white"
        : "text-gray-500 hover:bg-white/[0.03] hover:text-gray-200"
    }`;

    const content = (
      <>
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.badge.className}`}
          >
            {item.badge.text}
          </span>
        )}
        {active && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
        )}
      </>
    );

    if (item.href === "/" && pathname === "/") {
      return (
        <button type="button" onClick={() => scrollToSection("servers-25")} className={className}>
          {content}
        </button>
      );
    }

    return (
      <a href={item.href} onClick={() => setMobileMenuOpen(false)} className={className}>
        {content}
      </a>
    );
  };

  return (
    <div className="relative w-full min-h-screen bg-black">
      {/* Mobile header */}
      <div className="lg:hidden fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-gray-800/80 bg-gray-950/90 px-4 py-3 backdrop-blur-md">
        <a href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <Image src="/aa.jpg" alt="aa" width={24} height={24} className="rounded" />
          <span className="text-sm font-semibold tracking-tight text-white">aadrama</span>
        </a>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          style={{ top: "52px" }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 z-40 flex h-screen w-60 flex-col border-r border-gray-800/80 bg-gray-950/95 p-4 backdrop-blur-md
          transition-transform duration-300 ease-out
          lg:translate-x-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          top-[52px] lg:top-0
        `}
      >
        <a
          href="/"
          className="mb-8 hidden items-center gap-2.5 px-2 transition-opacity hover:opacity-80 lg:flex"
        >
          <Image src="/aa.jpg" alt="aa" width={28} height={28} className="rounded-md" />
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">aadrama</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-600">AA competitive</div>
          </div>
        </a>

        <nav className="flex flex-1 flex-col gap-0.5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Play
          </p>
          {primaryNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          <div className="my-4 border-t border-gray-800/80" />

          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Events
          </p>
          <a
            href="/2025-winter-classic"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === "/2025-winter-classic"
                ? "bg-cyan-950/50 text-cyan-300"
                : "text-cyan-600/80 hover:bg-white/[0.03] hover:text-cyan-400"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Winter Classic
          </a>

          <div className="mt-auto border-t border-gray-800/80 pt-4">
            <a
              href="/account"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith("/account")
                  ? "bg-white/[0.06] text-white"
                  : "text-gray-500 hover:bg-white/[0.03] hover:text-gray-200"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Account
            </a>
          </div>
        </nav>
      </aside>

      <div className="flex-1 pt-[52px] transition-all lg:ml-60 lg:pt-0">{children}</div>
    </div>
  );
};

export default SidebarLayout;
