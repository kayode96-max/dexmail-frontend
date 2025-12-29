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
import { useAccount } from 'wagmi';
import { ThemeToggle } from '../theme-toggle';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '../ui/sheet';
import { SidebarNav } from '../sidebar-nav';
import { AppLogo } from '../app-logo';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

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
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function Header({ selectedMailIds, onDelete, onArchive, onSpam, onRestore, onAddLabel, onRemoveLabel, isTrashView, onRefresh, searchQuery, onSearchChange }: HeaderProps) {
  const labels = useMailLabels();
  const [newLabel, setNewLabel] = useState('');

  return (
    <div className="flex items-center justify-between p-4 shadow-sm gap-4">
      <div className="flex items-center gap-2 flex-shrink-0">
        <p className="text-sm text-muted-foreground">
          {selectedMailIds.length > 0 ? `${selectedMailIds.length} selected` : 'All Messages'}
        </p>
      </div>

      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
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
  const [searchQuery, setSearchQuery] = React.useState('');
  const isMobile = useIsMobile();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Update activeCategory when prop changes
  useEffect(() => {
    setActiveCategory(category);
  }, [category]);

  const handleRefresh = async () => {
    await refreshMails();
  };

  // Use context mails if available, otherwise use initial mails
  const displayMails = mails.length > 0 ? mails : initialMails;

  // Filter mails based on activeCategory, label, and search query
  const filteredMails = React.useMemo(() => {
    let filtered = displayMails.filter((mail) => {
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

    // Apply search filter
    if (searchQuery.trim()) {
      const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      
      filtered = filtered.filter((mail) => {
        const searchableFields = {
          name: (mail.name || '').toLowerCase(),
          email: (mail.email || '').toLowerCase(),
          subject: (mail.subject || '').toLowerCase(),
          text: (mail.text || '').toLowerCase(),
          labels: (mail.labels || []).join(' ').toLowerCase()
        };
        
        // Check if any search term matches any field
        return searchTerms.some(term => 
          Object.values(searchableFields).some(field => field.includes(term))
        );
      });
    }

    return filtered;
  }, [displayMails, activeCategory, label, searchQuery]);

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
        {/* Mobile Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <div className="p-4">
                <AppLogo />
              </div>
              <div className="px-2">
                <SidebarNav />
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/50 h-9"
              />
            </div>
          </div>
          
          <ThemeToggle />
        </div>

        {/* Tabs */}
        <div className="px-4 py-2">
          <Tabs value={activeCategory === 'sent' ? 'sent' : 'all'} onValueChange={(val) => setActiveCategory(val as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">Inbox</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Mail List */}
        <div className="flex-1 w-full overflow-auto">
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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
