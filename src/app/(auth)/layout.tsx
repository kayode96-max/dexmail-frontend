import { AppLogo } from "@/components/app-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen md:min-h-screen h-screen-mobile md:h-auto flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header with Logo */}
      <div className="flex items-center justify-between p-6">
        <AppLogo />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <div className="w-full max-w-sm mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
