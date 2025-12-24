'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

  return (
    <div className="flex min-h-screen md:min-h-screen h-screen-mobile md:h-auto flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header with Logo */}
      <div className="flex items-center justify-between p-6">
        <AppLogo />
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {step}/3
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <div className="w-full max-w-lg mx-auto">
          {step <= 3 && (
            <OnboardingStep
              step={onboardingSteps[step - 1]}
              isLast={step === 3}
              onNext={handleNext}
              onSkip={handleSkip}
            />
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex justify-center pb-8 px-6">
        <div className="flex space-x-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full transition-all duration-300 ${i === step
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
  );
}

interface OnboardingStepProps {
  step: typeof onboardingSteps[0];
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
}

function OnboardingStep({ step, isLast, onNext, onSkip }: OnboardingStepProps) {
  return (
    <div className="text-center space-y-2">
      {/* Illustration */}
      <div className="relative h-[450px] w-full -mb-12">
        <Image
          src={step.illustration}
          alt={step.title}
          width={320}
          height={320}
          className="w-full h-full object-contain dark:brightness-90 dark:contrast-90"
          priority
        />
      </div>

      {/* Content */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
          {step.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed px-4">
          {step.subtitle}
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        {isLast ? (
          <>
            <Button
              asChild
              className="w-full h-12 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="w-full h-12 text-slate-900 dark:text-slate-100 font-semibold rounded-full border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Link href="/register">Sign up</Link>
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={onNext}
              className="w-full h-12 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-full"
            >
              Next
            </Button>
            <Button
              onClick={onSkip}
              variant="ghost"
              className="w-full h-12 text-slate-600 dark:text-slate-400 font-medium"
            >
              Skip
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
