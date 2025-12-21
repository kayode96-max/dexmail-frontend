'use client';

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { LoadingScreen } from '@/components/loading-screen';
import { RainbowProviders } from '@/components/providers/rainbowkit-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { useState, useEffect } from 'react';
import { CDPReactProvider } from '@coinbase/cdp-react';
import { useViewportHeight } from '@/hooks/use-viewport-height';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [loading, setLoading] = useState(true);
  const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID || '';

  // Set viewport height for mobile
  useViewportHeight();

  useEffect(() => {
    // Only show loading screen for a short moment to ensure hydration match or just remove it.
    // Actually, we can remove the artificial delay entirely. 
    // If we want a smooth transition, maybe 500ms or 0.
    // Let's reduce it to 0 or remove the effect effectively by setting false immediately.
    setLoading(false);
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Kumbh+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <title>DexMail</title>
        <meta name="description" content="Decentralized mail with crypto transfer capabilities." />
      </head>
      <body className="font-body antialiased">
        <CDPReactProvider
          config={{
            projectId,
            appName: 'DexMail',
            ethereum: { createOnLogin: 'smart' },
          }}
        >
          <RainbowProviders>
            <AuthProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                disableTransitionOnChange
              >
                {loading ? <LoadingScreen /> : children}
                <Toaster />
              </ThemeProvider>
            </AuthProvider>
          </RainbowProviders>
        </CDPReactProvider>
      </body>
    </html>
  );
}
