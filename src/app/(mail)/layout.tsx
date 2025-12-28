'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/sidebar-nav';
import { AppLogo } from '@/components/app-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Inbox, Star, User, PanelLeft, Gift, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ComposeDialog } from '@/components/mail/compose-dialog';
import { MailProvider } from '@/contexts/mail-context';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserNav } from '@/components/user-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAccount } from 'wagmi';
import { useName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import { ChevronsUpDown, Copy, Check } from 'lucide-react';
import { useState } from 'react';

function BottomNavBar() {
  const pathname = usePathname();
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar-1');
  const { address } = useAccount();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const displayAddress = user?.walletAddress || address;
  const { data: name } = useName({ 
    address: displayAddress as `0x${string}`, 
    chain: base,
  }, {
    enabled: !!displayAddress,
  });

  const walletText = name || (displayAddress
    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
    : 'No wallet');

  const displayEmail = user?.email || 'user@example.com';

  const formattedEmail = (() => {
    const parts = displayEmail.split('@');
    if (parts.length !== 2) return displayEmail;
    const [name, domain] = parts;
    if (name.length <= 4) return displayEmail;
    return `${name.slice(0, 4)}...@${domain}`;
  })();

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(displayEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { name: 'Inbox', href: '/mail', icon: Inbox },
    { name: 'Claim', href: '/claim', icon: Gift },
    { name: 'Starred', href: '/starred', icon: Star },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] bg-card text-card-foreground">
      <div className="relative flex h-16 items-center justify-between px-2">
        <div className="flex w-full justify-around">
          {navItems.slice(0, 2).map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 min-w-0 w-1/4 ${
                pathname === item.href ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs truncate">{item.name}</span>
            </Link>
          ))}
        </div>
        <div className="w-16 shrink-0" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <ComposeDialog>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
              <Edit className="h-6 w-6" />
            </Button>
          </ComposeDialog>
        </div>
        <div className="flex w-full justify-around">
          {navItems.slice(2).map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 min-w-0 w-1/4 ${
                pathname === item.href ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs truncate">{item.name}</span>
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center gap-1 p-2 min-w-0 w-1/4 text-muted-foreground">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={userAvatar?.imageUrl} alt="User Avatar" data-ai-hint={userAvatar?.imageHint} />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <span className="text-xs truncate">Profile</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" side="top" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{walletText}</p>
                  <div className="text-xs leading-none text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="text-xs leading-none text-muted-foreground truncate max-w-[150px]" title={displayEmail}>{formattedEmail}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-transparent"
                        onClick={handleCopyEmail}
                      >
                        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                        <span className="sr-only">Copy Email</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/login">Log out</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function MailLayoutContent({ children }: { children: React.ReactNode }) {
  const { toggleSidebar } = useSidebar();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Sidebar collapsible="icon" className="shadow-lg bg-sidebar">
        <div className="flex items-center justify-between p-4">
          <div className="flex-1">
            <AppLogo />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 [&_span]:hidden group-data-[state=expanded]:[&_span]:inline-block"
            onClick={toggleSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
      </Sidebar>
      <div className="md:hidden flex flex-col h-screen-mobile w-full">
        <div className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between gap-2 shadow-md bg-background px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-10 w-10 flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative flex-1 max-w-md mx-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="bg-muted pl-8 h-10 rounded-full w-full" />
          </div>
          <div className="flex-shrink-0">
            <ThemeToggle />
          </div>
        </div>
        <main className="flex-1 overflow-auto pb-16">{children}</main>
        <BottomNavBar />
      </div>
      <div className="hidden md:flex flex-1 w-full">
        <SidebarInset className="flex-1 w-full">
          <main className="h-full w-full overflow-auto">{children}</main>
        </SidebarInset>
      </div>
    </>
  );
}

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <MailProvider>
      <SidebarProvider>
        <MailLayoutContent>{children}</MailLayoutContent>
      </SidebarProvider>
    </MailProvider>
  );
}
