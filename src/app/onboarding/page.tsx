'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/app-logo';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';

type Step = 1 | 2 | 3;

const onboardingSteps = [
  {
    title: "Secure Email for Everyone",
    subtitle: "Experience the power of decentralized email with built-in security and privacy. Your communication, protected by blockchain technology.",
    illustration: "/illustrations/team-collaboration.png"
  },
  {
    title: "User-Friendly at its Core",
    subtitle: "Discover the essence of user-friendliness as our interface empowers you with intuitive controls and seamless email management.",
    illustration: "/illustrations/user-interface.png"
  },
  {
    title: "Easy Crypto Integration",
    subtitle: "Send cryptocurrencies directly through email with ease. Simplify your digital transactions and manage everything in one place.",
    illustration: "/illustrations/task-creation.png"
  }
];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);

  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => (prev + 1) as Step);
    }
  };

  const handleSkip = () => {
    setStep(3); // Go to final screen
  };

  const currentStep = onboardingSteps[step - 1];

  return (
    <div className="min-h-svh flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-hidden">
      {/* Header with Logo - Fixed at top */}
      <div className="flex-none flex items-center justify-between p-3 md:p-4">
        <AppLogo />
        <div className="flex items-center gap-2">
          <div className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400">
            {step}/3
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content - Centered with minimal margins */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-4 min-h-0">
        <div className="w-full max-w-6xl h-full flex flex-col lg:flex-row items-center justify-center gap-4 md:gap-8">
          {/* Illustration */}
          <div className="w-full lg:w-1/2 flex items-center justify-center">
            <div className="relative w-full max-w-xs md:max-w-sm lg:max-w-md aspect-square">
              <Image
                src={currentStep.illustration}
                alt={currentStep.title}
                fill
                className="object-contain dark:brightness-90 dark:contrast-90"
                priority
                sizes="(max-width: 768px) 90vw, (max-width: 1024px) 45vw, 400px"
              />
            </div>
          </div>

          {/* Content */}
          <div className="w-full lg:w-1/2 flex flex-col justify-center px-4 md:px-6">
            <div className="w-full max-w-md mx-auto space-y-4 md:space-y-6">
              {/* Text Content */}
              <div className="text-center space-y-2 md:space-y-3">
                <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {currentStep.title}
                </h1>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {currentStep.subtitle}
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-2 md:space-y-3">
              {step === 3 ? (
                <>
                  <Button
                    asChild
                    className="w-full h-11 md:h-12 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full text-sm md:text-base"
                  >
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full h-11 md:h-12 text-slate-900 dark:text-slate-100 font-semibold rounded-full border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm md:text-base"
                  >
                    <Link href="/register">Sign up</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleNext}
                    className="w-full h-11 md:h-12 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full text-sm md:text-base"
                  >
                    Next
                  </Button>
                  <Button
                    onClick={handleSkip}
                    variant="ghost"
                    className="w-full h-11 md:h-12 text-slate-600 dark:text-slate-400 font-medium text-sm md:text-base"
                  >
                    Skip
                  </Button>
                </>
              )}
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center pt-2">
              <div className="flex space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                      i === step
                        ? 'bg-slate-800 dark:bg-slate-200'
                        : i < step
                        ? 'bg-slate-400 dark:bg-slate-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
