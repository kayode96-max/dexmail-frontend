import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ChevronsUpDown, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useAuth } from '@/contexts/auth-context';
import { useName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

export function UserNav() {
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar-1');
  const { address } = useAccount();
  const { user } = useAuth();

  const displayAddress = user?.walletAddress || address;

  const { data: name } = useName({ address: displayAddress as `0x${string}`, chain: base });

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

  const [copied, setCopied] = useState(false);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(displayEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-full justify-start gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userAvatar?.imageUrl} alt="User Avatar" data-ai-hint={userAvatar?.imageHint} />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div className="text-left group-data-[collapsible=icon]/sidebar:hidden w-full overflow-hidden">
            <p className="text-sm font-medium leading-none truncate">{walletText}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {formattedEmail}
            </p>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground group-data-[collapsible=icon]/sidebar:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
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
          <DropdownMenuItem asChild>
            <Link href="/settings">Settings</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/login">Log out</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
