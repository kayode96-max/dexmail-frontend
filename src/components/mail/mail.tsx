'use client';

import { mailService } from '@/lib/mail-service';
import { format } from 'date-fns';

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
import { Tag, RotateCcw, RefreshCw } from 'lucide-react';
import { useMailLabels } from '@/hooks/use-mail-labels';
import { useAccount } from 'wagmi'; // Added this import
import { ThemeToggle } from '../theme-toggle';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  selectedMailIds: string[];
  onDelete: () => void;
  onArchive: () => void;
  onSpam: () => void;
  onRestore: () => void;
  onAddLabel: (label: string) => void;
  onRemoveLabel: (label: string) => void;
  isTrashView?: boolean;
  onRefresh: () => void;
}

function Header({ selectedMailIds, onDelete, onArchive, onSpam, onRestore, onAddLabel, onRemoveLabel, isTrashView, onRefresh }: HeaderProps) {
  const labels = useMailLabels();
  const [newLabel, setNewLabel] = useState('');

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {selectedMailIds.length > 0 ? `${selectedMailIds.length} selected` : 'All Messages'}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {selectedMailIds.length > 0 ? (
          <>
            <TooltipProvider delayDuration={0}>
              {isTrashView ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onRestore}>
                      <RotateCcw className="h-4 w-4" />
                      <span className="sr-only">Restore</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restore from Trash</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={onArchive}>
                        <Archive className="h-4 w-4" />
                        <span className="sr-only">Archive</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Archive</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={onSpam}>
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Mark as Spam</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark as Spam</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={onDelete}>
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </>
              )}
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Tag className="h-4 w-4" />
                  <span className="sr-only">Labels</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Apply Label</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {labels.map((label) => (
                  <DropdownMenuItem key={label.name} onClick={() => onAddLabel(label.name)}>
                    <div className={`h-2 w-2 rounded-full mr-2 ${label.color}`} />
                    {label.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Input
                    placeholder="New label..."
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newLabel.trim()) {
                        onAddLabel(newLabel.trim());
                        setNewLabel('');
                      }
                    }}
                    className="h-8"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            {/* Default actions when nothing selected */}
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                    <span className="sr-only">Refresh</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh Emails</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </>
        )}
        <Separator orientation="vertical" className="h-6 mx-2" />
        <ComposeDialog>
          <Button>
            <Edit className="mr-2 h-4 w-4" /> Write Message
          </Button>
        </ComposeDialog>
        <ThemeToggle />
      </div>
    </div>
  );
}

import { useAuth } from '@/contexts/auth-context';

function MobileHeader() {
  const { user, logout } = useAuth();
  const { address: wagmiAddress } = useAccount();

  // Prioritize user.walletAddress for embedded wallets
  const displayAddress = user?.walletAddress || wagmiAddress;

  const userAvatar = PlaceHolderImages.find(
    (img) => img.id === 'user-avatar-1'
  );

  const formattedEmail = (() => {
    const email = user?.email || 'User';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const [name, domain] = parts;
    if (name.length <= 4) return email;
    return `${name.slice(0, 4)}...@${domain}`;
  })();

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
                <p className="text-sm font-medium leading-none truncate">{formattedEmail}</p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {displayAddress
                    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                    : 'No wallet connected'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
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
  category = 'all',
  label
}: {
  mails: Mail[];
  category?: 'all' | 'read' | 'unread' | 'sent' | 'drafts' | 'spam' | 'archive' | 'trash';
  label?: string;
}) {
  const { mails, isLoading, deleteMails, archiveMails, spamMails, restoreMails, addLabelToMails, removeLabelFromMails, refreshMails } = useMail();
  const [selectedMailIds, setSelectedMailIds] = React.useState<string[]>([]);
  const [activeCategory, setActiveCategory] = React.useState(category);
  const isMobile = useIsMobile();
  const router = useRouter();

  // Update activeCategory when prop changes
  useEffect(() => {
    setActiveCategory(category);
  }, [category]);

  const handleRefresh = async () => {
    await refreshMails();
  };

  // Use context mails if available, otherwise use initial mails
  const displayMails = mails.length > 0 ? mails : initialMails;

  // Filter mails based on activeCategory or label
  const filteredMails = React.useMemo(() => {
    return displayMails.filter((mail) => {
      if (label) {
        return mail.labels && mail.labels.includes(decodeURIComponent(label));
      }

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
  }, [displayMails, activeCategory, label]);

  const handleSelectMail = (mail: Mail) => {
    router.push(`/mail/${mail.id}`);
  };

  const handleToggleMailSelection = (mailId: string) => {
    setSelectedMailIds((prev) => {
      const newSelection = prev.includes(mailId)
        ? prev.filter((id) => id !== mailId)
        : [...prev, mailId];
      return newSelection;
    });
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <MobileHeader />
        <div className="mt-16 flex-1 flex flex-col">
          <div className="px-4 py-2">
            <Tabs value={activeCategory === 'sent' ? 'sent' : 'all'} onValueChange={(val) => setActiveCategory(val as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all">Inbox</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 w-full">
            {isLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
            ) : (
              <MailList
                items={filteredMails}
                onSelectMail={handleSelectMail}
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
      <Header
        selectedMailIds={selectedMailIds}
        onDelete={() => {
          deleteMails(selectedMailIds);
          setSelectedMailIds([]);
        }}
        onArchive={() => {
          archiveMails(selectedMailIds);
          setSelectedMailIds([]);
        }}
        onSpam={() => {
          spamMails(selectedMailIds);
          setSelectedMailIds([]);
        }}
        onRestore={() => {
          restoreMails(selectedMailIds);
          setSelectedMailIds([]);
        }}
        onAddLabel={(label) => {
          addLabelToMails(selectedMailIds, label);
        }}
        onRemoveLabel={(label) => {
          removeLabelFromMails(selectedMailIds, label);
        }}
        isTrashView={category === 'trash'}
        onRefresh={handleRefresh}
      />
      <div className="flex-1 w-full">
        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
        ) : (
          <MailList
            items={filteredMails}
            onSelectMail={handleSelectMail}
            selectedMailIds={selectedMailIds}
            onToggleMailSelection={handleToggleMailSelection}
          />
        )}
      </div>
    </div>
  );
}
