import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function NotFound() {
    return (
        <div className="relative h-screen w-screen overflow-hidden">
            <Image
                src="/404bg.jpeg"
                alt="404 Page Not Found"
                fill
                className="object-cover"
                priority
            />
            <div className="absolute top-10 left-1/2 -translate-x-1/2 transform flex items-center gap-4">
        <div className="relative h-12 w-12">
          <Image
            src="/logo.png"
            alt="DexMail Logo"
            fill
            className="object-contain"
          />
        </div>
        <h1 className="text-4xl font-extrabold tracking-widest text-primary">DexMail</h1>
      </div>
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 transform">
                <Button asChild className="h-16 rounded-full px-10 text-xl font-semibold bg-primary/90 hover:bg-primary">
                    <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
            </div>
        </div>
    );
}
