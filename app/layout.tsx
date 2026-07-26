import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

// These styles apply to every route in the application
import './globals.css'

export const metadata: Metadata = {
  title: 'AA Drama',
  description: 'We\'re back',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#0891b2',
          colorBackground: '#030712',
          colorInputBackground: '#030712',
          colorInputText: '#ffffff',
          colorText: '#ffffff',
        },
        elements: {
          formButtonPrimary: 'bg-cyan-700 hover:bg-cyan-600',
          card: 'bg-gray-950 border border-gray-800',
          headerTitle: 'text-white',
          headerSubtitle: 'text-gray-400',
          socialButtonsBlockButton: 'bg-gray-900 border-gray-800 text-white hover:bg-gray-800',
          formFieldLabel: 'text-gray-300',
          formFieldInput: 'bg-gray-950 border-gray-800 text-white',
          footerActionLink: 'text-cyan-400 hover:text-cyan-300',
        },
      }}
    >
      <html lang="en" className="dark">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}

