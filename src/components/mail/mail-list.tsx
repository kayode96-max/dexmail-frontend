
'use client';

import { ComponentProps, useState, memo, useCallback } from 'react';
import type { Mail } from '@/lib/data';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format, isToday } from 'date-fns';
import { useRouter } from 'next/navigation';

interface MailListProps {
  items: Mail[];
  onSelectMail: (mail: Mail) => void;
  selectedMailIds: string[];
  onToggleMailSelection: (mailId: string) => void;
}

// Memoized MailItem component to prevent unnecessary re-renders
const MailItem = memo(({
  mail,
  onSelectMail,
  isSelected,
  onToggleSelection,
  anyMailSelected,
}: {
  mail: Mail;
  onSelectMail: (mail: Mail) => void;
  isSelected: boolean;
  onToggleSelection: (mailId: string) => void;
  anyMailSelected: boolean;
}) => {
  const router = useRouter();
  const userAvatar = PlaceHolderImages.find((img) => img.id === mail.id);
  const mailDate = new Date(mail.date);
  const [isHovered, setIsHovered] = useState(false);

  // Prefetch the mail page when hovering
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    router.prefetch(`/mail/${mail.id}`);
  }, [mail.id, router]);

  return (
    <div
      className={cn(
        'group/mail-item flex items-start gap-3 p-4 text-left text-sm transition-colors shadow-sm hover:shadow-md cursor-pointer',
        'hover:bg-accent',
        !mail.read && 'bg-blue-500/5'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelectMail(mail)}
    >
      <div className="flex items-center gap-4">
        {isHovered || isSelected || anyMailSelected ? (
          <Checkbox
            id={`select-${mail.id}`}
            aria-label={`Select mail from ${mail.name}`}
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(mail.id)}
            onClick={(e) => e.stopPropagation()}
            className="transition-opacity"
          />
        ) : (
          <Avatar className="h-8 w-8">
            <AvatarImage
              alt={mail.name}
              src={userAvatar?.imageUrl}
              data-ai-hint={userAvatar?.imageHint}
            />
            <AvatarFallback>
              {mail.name
                .split(' ')
                .map((chunk) => chunk[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            {!mail.read && (
              <span className="flex h-2 w-2 rounded-full bg-blue-600" />
            )}
            <div className={cn("font-semibold", !mail.read && "font-bold")}>{mail.name}</div>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {isToday(mailDate)
              ? format(mailDate, 'p')
              : format(mailDate, 'MMM d')}
          </div>
        </div>
        <div className={cn("text-xs font-medium", !mail.read && "font-bold")}>{mail.subject}</div>
        <div className="line-clamp-1 text-xs text-muted-foreground">
          {mail.text.substring(0, 100)}
        </div>
      </div>
    </div>
  );
});

MailItem.displayName = 'MailItem';

export function MailList({ items, onSelectMail, selectedMailIds, onToggleMailSelection }: MailListProps) {
  const anyMailSelected = selectedMailIds.length > 0;

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center text-center max-w-md gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8 text-muted-foreground"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">No emails yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your inbox is empty. Send yourself a test email to get started!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col md:shadow-lg">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-px">
          {items.map((item) => (
            <MailItem
              key={item.id}
              mail={item}
              onSelectMail={onSelectMail}
              isSelected={selectedMailIds.includes(item.id)}
              onToggleSelection={onToggleMailSelection}
              anyMailSelected={anyMailSelected}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
