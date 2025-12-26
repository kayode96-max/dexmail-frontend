'use client';

import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { LoadingScreen } from '@/components/loading-screen';
import { RainbowProviders } from '@/components/providers/rainbowkit-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { useState, useEffect } from 'react';
import { CDPReactProvider } from '@coinbase/cdp-react';
import { useViewportHeight } from '@/hooks/use-viewport-height';

export function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [loading, setLoading] = useState(true);
    const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID || '';

    useViewportHeight();

    useEffect(() => {
        setLoading(false);
    }, []);

    return (
        <CDPReactProvider
            config={{
                projectId,
                appName: 'DexMail',
                ethereum: { createOnLogin: 'smart' },
                disableAnalytics: true,
            }}
        >
            <RainbowProviders>
                <AuthProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        storageKey="dexmail-theme"
                    >
                        {loading ? <LoadingScreen /> : children}
                        <Toaster />
                    </ThemeProvider>
                </AuthProvider>
            </RainbowProviders>
        </CDPReactProvider>
    );
}
