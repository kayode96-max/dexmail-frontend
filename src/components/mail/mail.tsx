'use client';

import React, { useEffect, useState } from 'react';
import { MailList } from './mail-list';
import { MailDisplay } from './mail-display';
import type { Mail } from '@/lib/data';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Separator } from '../ui/separator';
import {
  Archive,
  Folder,
  Trash,
  MoreVertical,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { ComposeDialog } from './compose-dialog';
import { Edit } from 'lucide-react';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import Link from 'next/link';
import { useMail } from '@/contexts/mail-context';

function Header() {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">All Messages</p>
      </div>

      <div className="flex items-center gap-4">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Archive className="h-4 w-4" />
                <span className="sr-only">Archive</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Folder className="h-4 w-4" />
                <span className="sr-only">Move to folder</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to folder</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">More</span>
        </Button>
        <Separator orientation="vertical" className="h-6 mx-2" />
        <ComposeDialog>
          <Button>
            <Edit className="mr-2 h-4 w-4" /> Write Message
          </Button>
        </ComposeDialog>
      </div>
    </div>
  );
}

import { useAuth } from '@/contexts/auth-context';

function MobileHeader() {
  const { user, logout } = useAuth();
  const userAvatar = PlaceHolderImages.find(
    (img) => img.id === 'user-avatar-1'
  );

  return (
    <header className="fixed top-0 z-10 flex h-16 items-center justify-between gap-3 border-b bg-background px-4 w-full">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search..." className="bg-muted pl-8 h-10 rounded-full" />
      </div>
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage
                  src={userAvatar?.imageUrl}
                  alt="User Avatar"
                  data-ai-hint={userAvatar?.imageHint}
                />
                <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">{user?.email || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user?.walletAddress
                    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                    : 'No wallet connected'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">Settings</Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

// ... (imports remain the same)

export function MailComponent({
  mails: initialMails,
  category = 'all'
}: {
  mails: Mail[];
  category?: 'all' | 'read' | 'unread' | 'sent' | 'drafts' | 'spam' | 'archive' | 'trash';
}) {
  const { mails, isLoading } = useMail();
  const [selectedMailId, setSelectedMailId] = React.useState<string | null>(null);
  const [selectedMailIds, setSelectedMailIds] = React.useState<string[]>([]);
  const [activeCategory, setActiveCategory] = React.useState(category);
  const isMobile = useIsMobile();

  // Update activeCategory when prop changes, but only if not in mobile view (or handle differently if needed)
  // For this specific request, we want mobile to control its own state via tabs
  useEffect(() => {
    if (!isMobile) {
      setActiveCategory(category);
    }
  }, [category, isMobile]);


  // Use context mails if available, otherwise use initial mails
  const displayMails = mails.length > 0 ? mails : initialMails;

  const selectedMail = displayMails.find((item) => item.id === selectedMailId);

  // Filter mails based on activeCategory
  const filteredMails = React.useMemo(() => {
    return displayMails.filter((mail) => {
      switch (activeCategory) {
        case 'all':
          return mail.status === 'inbox';
        case 'read':
          return mail.status === 'inbox' && mail.read;
        case 'unread':
          return mail.status === 'inbox' && !mail.read;
        case 'sent':
          return mail.status === 'sent';
        case 'drafts':
          return mail.status === 'draft';
        case 'spam':
          return mail.status === 'spam';
        case 'archive':
          return mail.status === 'archive';
        case 'trash':
          return mail.status === 'trash';
        default:
          return true;
      }
    });
  }, [displayMails, activeCategory]);

  const handleSelectMail = (mail: Mail) => {
    setSelectedMailId(mail.id);
  };

  const handleToggleMailSelection = (mailId: string) => {
    setSelectedMailIds((prev) =>
      prev.includes(mailId)
        ? prev.filter((id) => id !== mailId)
        : [...prev, mailId]
    );
  };

  const handleBack = () => {
    setSelectedMailId(null);
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <MobileHeader />
        <div className="mt-16 flex-1 flex flex-col">
          {!selectedMailId && (
            <div className="px-4 py-2">
              <Tabs value={activeCategory === 'sent' ? 'sent' : 'all'} onValueChange={(val) => setActiveCategory(val as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">Inbox</TabsTrigger>
                  <TabsTrigger value="sent">Sent</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
          <div className="flex-1 w-full">
            {isLoading && !selectedMailId ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
            ) : selectedMail ? (
              <MailDisplay mail={selectedMail} onBack={handleBack} />
            ) : (
              <MailList
                items={filteredMails}
                onSelectMail={handleSelectMail}
                selectedMailId={selectedMailId}
                selectedMailIds={selectedMailIds}
                onToggleMailSelection={handleToggleMailSelection}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <Header />
      <div className="flex-1 w-full">
        {isLoading && !selectedMail ? (
          <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
        ) : selectedMail ? (
          <MailDisplay mail={selectedMail} onBack={handleBack} />
        ) : (
          <MailList
            items={filteredMails}
            onSelectMail={handleSelectMail}
            selectedMailId={selectedMailId}
            selectedMailIds={selectedMailIds}
            onToggleMailSelection={handleToggleMailSelection}
          />
        )}
      </div>
    </div>
  );
}
