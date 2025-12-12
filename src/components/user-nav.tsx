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
import { ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useAuth } from '@/contexts/auth-context';

export function UserNav() {
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar-1');
  const { address } = useAccount();
  const { user } = useAuth();

  // Slice wallet address to show first 6 and last 4 characters
  // For embedded wallets, use the wallet address from user profile
  // For external wallets, use the connected address from wagmi
  const displayAddress = user?.walletAddress || address;
  const walletText = displayAddress
    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
    : 'No wallet';

  const displayEmail = user?.email || 'user@example.com';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-full justify-start gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userAvatar?.imageUrl} alt="User Avatar" data-ai-hint={userAvatar?.imageHint} />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div className="text-left group-data-[collapsible=icon]/sidebar:hidden">
            <p className="text-sm font-medium leading-none">{walletText}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {displayEmail}
            </p>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground group-data-[collapsible=icon]/sidebar:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{walletText}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {displayEmail}
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
        <DropdownMenuItem asChild>
          <Link href="/login">Log out</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
