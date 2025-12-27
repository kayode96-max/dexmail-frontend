'use client';

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ExportWalletModal } from '@coinbase/cdp-react';
import { useEvmAddress, useCurrentUser } from "@coinbase/cdp-hooks";
import Link from 'next/link';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { evmAddress } = useEvmAddress();
  const { currentUser } = useCurrentUser();
  const eoaAddress = currentUser?.evmAccounts?.[0];

  // Only show export for embedded wallet users
  const isEmbeddedWallet = user?.authType === 'coinbase-embedded';


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize the look and feel of the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="theme-switch" className="flex flex-col gap-1">
                <span>Theme</span>
                <span className="font-normal text-muted-foreground">
                  Select between light and dark mode.
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                <Switch
                  id="theme-switch"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? 'dark' : 'light')
                  }
                  aria-label="Toggle theme"
                />
                <Moon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Whitelist & Contact Fees</CardTitle>
            <CardDescription>
              Manage your whitelist and set pay-to-contact fees to control spam.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Configure Whitelist</span>
                <span className="text-sm text-muted-foreground">
                  Set fees for non-whitelisted senders.
                </span>
              </div>
              <Button variant="outline" asChild>
                <Link href="/settings/whitelist">Manage</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Only show wallet export for embedded wallet users */}
        {isEmbeddedWallet && (
          <Card>
            <CardHeader>
              <CardTitle>Wallet Security</CardTitle>
              <CardDescription>
                Export your embedded wallet's private key for backup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label>Export Private Key</Label>
                  <span className="font-normal text-sm text-muted-foreground">
                    Securely export your wallet's private key. Keep it secret, keep it safe.
                  </span>
                </div>
                <div className="flex-shrink-0">
                  {eoaAddress ? (
                    <ExportWalletModal address={eoaAddress} />
                  ) : (
                    <Button variant="outline" disabled>
                      Loading wallet...
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
