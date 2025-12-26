
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive,
  FileText,
  Inbox,
  Send,
  Trash2,
  Settings,
  HelpCircle,
  Gift,
  Search,
  Users,
} from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Badge } from './ui/badge';
import { UserNav } from './user-nav';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { useMailCounts } from '@/hooks/use-mail-counts';
import { useMailLabels } from '@/hooks/use-mail-labels';
import { ThemeToggle } from './theme-toggle';

export function SidebarNav() {
  const pathname = usePathname();
  const counts = useMailCounts();

  const mainLinks = [
    { name: 'Sent', href: '/dashboard/sent', icon: Send, count: counts.sent },
    { name: 'Drafts', href: '/dashboard/drafts', icon: FileText, count: counts.drafts },
    { name: 'Spam', href: '/dashboard/spam', icon: Users, count: counts.spam },
    { name: 'Archive', href: '/dashboard/archive', icon: Archive, count: counts.archive },
    { name: 'Trash', href: '/dashboard/trash', icon: Trash2, count: counts.trash },
  ];

  const labelLinks = useMailLabels();

  const bottomLinks = [
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    { name: 'Help Center', href: '/dashboard/help', icon: HelpCircle },
  ];

  const subNavItems = [
    {
      name: 'All Messages',
      href: '/dashboard',
      count: counts.all,
    },
    {
      name: 'Already Read',
      href: '/dashboard/read',
      count: counts.read,
    },
    {
      name: 'Unread',
      href: '/dashboard/unread',
      count: counts.unread,
    },
  ];

  return (
    <div className="flex h-full flex-col gap-2 px-2">
      <div className="p-2"></div>
      <div className="p-2 group-data-[collapsible=icon]/sidebar:hidden">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="bg-background pl-8" />
        </div>
      </div>
      <SidebarMenu className="px-2">
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={['/dashboard', '/dashboard/read', '/dashboard/unread'].includes(pathname)}
            tooltip="Inbox"
            asChild
          >
            <Link href="/dashboard">
              <Inbox />
              <span className="group-data-[collapsible=icon]/sidebar:hidden">Inbox</span>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuSub>
            {subNavItems.map((item) => (
              <SidebarMenuSubItem key={item.name}>
                <SidebarMenuSubButton
                  asChild
                  isActive={pathname === item.href}
                >
                  <Link href={item.href}>
                    <span className="group-data-[collapsible=icon]/sidebar:hidden">{item.name}</span>
                    {item.count && item.count > 0 ? (
                      <Badge
                        variant="secondary"
                        className="ml-auto group-data-[collapsible=icon]/sidebar:hidden"
                      >
                        {item.count}
                      </Badge>
                    ) : null}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname === '/dashboard/claim'}
            tooltip={'Claim'}
          >
            <Link href="/dashboard/claim" className="w-full">
              <Gift />
              <span className="group-data-[collapsible=icon]/sidebar:hidden">Claim</span>
              {(counts.claim || 0) > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-auto group-data-[collapsible=icon]/sidebar:hidden"
                >
                  {counts.claim}
                </Badge>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {mainLinks.map((link) => (
          <SidebarMenuItem key={link.name}>
            <SidebarMenuButton
              asChild
              isActive={pathname === link.href}
              tooltip={link.name}
            >
              <Link href={link.href} className="w-full">
                <link.icon />
                <span className="group-data-[collapsible=icon]/sidebar:hidden">{link.name}</span>
                {(link.count || 0) > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto group-data-[collapsible=icon]/sidebar:hidden"
                  >
                    {link.count}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarSeparator />
      <SidebarGroup className="px-2 group-data-[collapsible=icon]/sidebar:hidden">
        <SidebarGroupLabel>Labels</SidebarGroupLabel>
        <SidebarMenu className="px-2">
          {labelLinks.map((link) => (
            <SidebarMenuItem key={link.name}>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/dashboard/label/${encodeURIComponent(link.name)}`}
                tooltip={link.name}
              >
                <Link href={`/dashboard/label/${encodeURIComponent(link.name)}`} className="w-full">
                  <div className={`h-2 w-2 rounded-full ${link.color}`} />
                  <span className="group-data-[collapsible=icon]/sidebar:hidden">{link.name}</span>
                  {(link.count || 0) > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto group-data-[collapsible=icon]/sidebar:hidden"
                    >
                      {link.count}
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <div className="mt-auto">
        <SidebarSeparator />
        <SidebarMenu className="p-2">
          {bottomLinks.map((link) => (
            <SidebarMenuItem key={link.name}>
              <SidebarMenuButton
                asChild
                isActive={pathname === link.href}
                tooltip={link.name}
              >
                <Link href={link.href} className="w-full">
                  <link.icon />
                  <span className="group-data-[collapsible=icon]/sidebar:hidden">{link.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <SidebarSeparator />
        <div className="p-2 flex items-center gap-2">
          <div className="flex-1">
            <UserNav />
          </div>
        </div>
      </div>
    </div>
  );
}
