"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import SidebarLayout from "../components/SidebarLayout";

interface TrackerLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const tabs = [
  { name: "Top Players", href: "/tracker/top-players" },
  { name: "Top by Map", href: "/tracker/top-by-map" },
  { name: "Sessions", href: "/tracker/sessions" },
];

const TrackerLayout = ({ children, title = "Tracker" }: TrackerLayoutProps) => {
  const pathname = usePathname();

  return (
    <SidebarLayout>
      <div className="flex flex-col px-4 sm:px-6 md:px-8 py-6 sm:py-12">
        <div className="w-full max-w-6xl mx-auto">
          <h1 className="text-white text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">{title}</h1>

          {/* View Mode Tabs */}
          <div className="flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-700 -mx-1 px-1 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-2 sm:px-4 py-2 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap ${
                    isActive
                      ? "text-white border-b-2 border-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>

          {children}
        </div>
      </div>
    </SidebarLayout>
  );
};

export default TrackerLayout;

