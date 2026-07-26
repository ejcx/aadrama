"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import SidebarLayout from "../components/SidebarLayout";

interface TrackerLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const tabs = [
  { name: "Scrim Rankings", href: "/tracker/elo" },
  { name: "King of the Hill", href: "/tracker/koth" },
  { name: "Badges", href: "/tracker/badges" },
  { name: "Teammates", href: "/tracker/teammates" },
  { name: "Top Players", href: "/tracker/top-players" },
  { name: "Top by Map", href: "/tracker/top-by-map" },
  { name: "Sessions", href: "/tracker/sessions" },
];

const TrackerLayout = ({
  children,
  title = "Tracker",
  subtitle,
}: TrackerLayoutProps) => {
  const pathname = usePathname() || "";

  return (
    <SidebarLayout>
      <div className="aa-page-bg relative min-h-screen">
        <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:px-8">
          <header className="mb-6 sm:mb-8">
            <h1 className="aa-section-title text-2xl sm:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="aa-section-sub">{subtitle}</p>
            ) : (
              <p className="aa-section-sub">Rankings, sessions, and competitive stats</p>
            )}
          </header>

          <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-800 pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => {
              const isActive =
                pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`shrink-0 rounded-t-lg px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors sm:px-4 sm:text-sm ${
                    isActive
                      ? "border-b-2 border-cyan-400 text-white"
                      : "border-b-2 border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>

          {children}
        </div>
      </div>
    </SidebarLayout>
  );
};

export default TrackerLayout;
