"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const pathname = usePathname();
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [announcementExpired, setAnnouncementExpired] = useState(false);

  useEffect(() => {
    // Check if announcement should be hidden (after January 5th, 2026)
    const expirationDate = new Date('2026-01-05T23:59:59');
    const now = new Date();
    if (now > expirationDate) {
      setAnnouncementExpired(true);
    }
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="w-full min-h-screen bg-black">
      {/* Tournament Announcement Banner */}
      {showAnnouncement && !announcementExpired && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 text-white py-2.5 px-4 shadow-lg">
          <div className="flex items-center justify-center gap-4 lg:ml-64">
            <span className="text-sm sm:text-base font-medium">
              <span className="font-bold">AA25 | 2026 Winter Championship</span> — Jan 3, 2026 @ 4PM ET
            </span>
            <a
              href="/2025-winter-classic"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-semibold transition-colors"
            >
              View Details
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <button
              onClick={() => setShowAnnouncement(false)}
              className="absolute right-2 sm:right-4 text-white/70 hover:text-white transition-colors"
              aria-label="Dismiss announcement"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`hidden lg:block fixed left-0 h-screen w-64 bg-gray-900 border-r border-gray-700 p-6 overflow-y-auto transition-all ${showAnnouncement && !announcementExpired ? 'top-10' : 'top-0'}`}>
        <div className="sticky top-6">
          <div className="flex items-center space-x-2 mb-8">
            <Image
              src="/aa.jpg"
              alt="aa"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-white font-semibold text-sm">aadrama</span>
          </div>
          <nav className="flex flex-col space-y-1">
            <div>
              {pathname === '/' ? (
                <button
                  onClick={() => scrollToSection('servers-25')}
                  className="text-gray-400 hover:text-white text-left transition-colors font-semibold text-sm w-full"
                >
                  Active Servers
                </button>
              ) : (
                <a
                  href="/"
                  className="text-gray-400 hover:text-white text-left transition-colors font-semibold text-sm"
                >
                  Active Servers
                </a>
              )}
            </div>
            <div>
              <a
                href="/downloads"
                className={`text-left transition-colors font-semibold text-sm ${
                  pathname === '/downloads' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Downloads
              </a>
            </div>
            <div>
              <a
                href="/shoutbox"
                className={`text-left transition-colors font-semibold text-sm ${
                  pathname === '/shoutbox' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Shoutbox
              </a>
            </div>
            <div>
              <a
                href="/tracker"
                className={`text-left transition-colors font-semibold text-sm ${pathname === '/tracker' ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
              >
                Tracker
              </a>
            </div>
            <div className="pt-4 mt-4 border-t border-gray-700">
              <a
                href="/2025-winter-classic"
                className={`flex items-center gap-2 text-left transition-colors font-semibold text-sm ${pathname === '/2025-winter-classic' ? 'text-cyan-400' : 'text-cyan-500 hover:text-cyan-400'
                  }`}
              >
                <svg className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Winter Championship
              </a>
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 lg:ml-64 transition-all ${showAnnouncement && !announcementExpired ? 'pt-10' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default SidebarLayout;


