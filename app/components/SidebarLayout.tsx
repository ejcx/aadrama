"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const pathname = usePathname();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="w-full min-h-screen bg-black">
      {/* Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen w-64 bg-gray-900 border-r border-gray-700 p-6 overflow-y-auto">
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
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {children}
      </div>
    </div>
  );
};

export default SidebarLayout;


