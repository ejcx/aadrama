"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import SidebarLayout from "../components/SidebarLayout";

export default function AccountClient() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-gray-400 text-lg">Loading...</div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-6 sm:py-12">
        <div className="flex flex-col items-start space-y-6 sm:space-y-8 w-full max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between w-full">
            <h1 className="text-white text-2xl sm:text-3xl font-bold">
              My Account
            </h1>
            <UserButton afterSignOutUrl="/" />
          </div>

          {/* User Info */}
          <div className="w-full bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-4">
              {user?.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <h2 className="text-white font-semibold text-xl">
                  {user?.username || user?.firstName || "Anonymous"}
                </h2>
                <p className="text-gray-400 text-sm">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Account Sections */}
          <div className="w-full space-y-4">
            <h2 className="text-white text-xl font-bold">Settings</h2>
            
            {/* Game Names Link */}
            <Link
              href="/account/game-names"
              className="block bg-gray-900 border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">Game Names</h3>
                  <p className="text-gray-400 text-sm">
                    Link your in-game names to your account for verification
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

