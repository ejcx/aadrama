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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check if announcement should be hidden (after January 5th, 2026)
    const expirationDate = new Date('2026-01-05T23:59:59');
    const now = new Date();
    if (now > expirationDate) {
      setAnnouncementExpired(true);
    }
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="w-full min-h-screen bg-black">
      {/* Mobile Header */}
      <div className={`lg:hidden fixed left-0 right-0 z-40 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between ${showAnnouncement && !announcementExpired ? 'top-10' : 'top-0'}`}>
        <a href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <Image
            src="/aa.jpg"
            alt="aa"
            width={24}
            height={24}
            className="rounded"
          />
          <span className="text-white font-semibold text-sm">aadrama</span>
        </a>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-gray-400 hover:text-white transition-colors p-1"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          style={{ top: showAnnouncement && !announcementExpired ? '88px' : '48px' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Tournament Announcement Banner */}
      {showAnnouncement && !announcementExpired && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 text-white py-2 px-4 shadow-lg">
          <div className="flex items-center justify-center gap-2 sm:gap-4 lg:ml-64 pr-6 sm:pr-8">
            <a
              href="/2025-winter-classic"
              className="flex items-center gap-2 sm:gap-4 min-w-0"
            >
              <span className="text-xs sm:text-sm md:text-base font-medium truncate">
                <span className="font-bold">AA25 Winter Championship</span>
                <span className="hidden xs:inline"> — Jan 3 @ 4PM ET</span>
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-[10px] sm:text-xs font-semibold transition-colors whitespace-nowrap">
                View
                <span className="hidden sm:inline"> Details</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </a>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAnnouncement(false);
              }}
              className="absolute right-2 sm:right-4 text-white/70 hover:text-white transition-colors p-1"
              aria-label="Dismiss announcement"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Sidebar - Desktop always visible, Mobile slides in */}
      <div className={`
        fixed left-0 h-screen w-64 bg-gray-900 border-r border-gray-700 p-6 overflow-y-auto z-40
        transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${showAnnouncement && !announcementExpired ? 'top-[88px] lg:top-10' : 'top-12 lg:top-0'}
      `}>
        <div className="sticky top-6">
          {/* Logo - only show on desktop since mobile has it in the header */}
          <a href="/" className="hidden lg:flex items-center space-x-2 mb-8 hover:opacity-80 transition-opacity">
            <Image
              src="/aa.jpg"
              alt="aa"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-white font-semibold text-sm">aadrama</span>
          </a>
          <nav className="flex flex-col space-y-3 lg:space-y-1">
            <div>
              {pathname === '/' ? (
                <button
                  onClick={() => scrollToSection('servers-25')}
                  className="text-gray-400 hover:text-white text-left transition-colors font-semibold text-sm w-full py-2 lg:py-0"
                >
                  Active Servers
                </button>
              ) : (
                <a
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-400 hover:text-white text-left transition-colors font-semibold text-sm py-2 lg:py-0"
                >
                  Active Servers
                </a>
              )}
            </div>
            <div>
              <a
                href="/downloads"
                onClick={() => setMobileMenuOpen(false)}
                className={`block text-left transition-colors font-semibold text-sm py-2 lg:py-0 ${
                  pathname === '/downloads' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Downloads
              </a>
            </div>
            <div>
              <a
                href="/shoutbox"
                onClick={() => setMobileMenuOpen(false)}
                className={`block text-left transition-colors font-semibold text-sm py-2 lg:py-0 ${
                  pathname === '/shoutbox' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Shoutbox
              </a>
            </div>
            <div>
              <a
                href="/tracker"
                onClick={() => setMobileMenuOpen(false)}
                className={`block text-left transition-colors font-semibold text-sm py-2 lg:py-0 ${pathname === '/tracker' ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
              >
                Tracker
              </a>
            </div>
            <div>
              <a
                href="/scrim"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 text-left transition-colors font-semibold text-sm py-2 lg:py-0 ${pathname === '/scrim' || pathname?.startsWith('/scrim/') ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
              >
                Scrim
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-600 text-purple-100 rounded">
                  BETA
                </span>
              </a>
            </div>
            <div className="pt-4 mt-4 border-t border-gray-700">
              <a
                href="/2025-winter-classic"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 text-left transition-colors font-semibold text-sm py-2 lg:py-0 ${pathname === '/2025-winter-classic' ? 'text-cyan-400' : 'text-cyan-500 hover:text-cyan-400'
                  }`}
              >
                <svg className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Winter Championship
              </a>
            </div>
            <div className="pt-4 mt-4 border-t border-gray-700">
              <a
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 text-left transition-colors font-semibold text-sm py-2 lg:py-0 ${pathname?.startsWith('/account') ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account
              </a>
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 lg:ml-64 transition-all ${showAnnouncement && !announcementExpired ? 'pt-[88px] lg:pt-10' : 'pt-12 lg:pt-0'}`}>
        {children}
      </div>
    </div>
  );
};

export default SidebarLayout;


