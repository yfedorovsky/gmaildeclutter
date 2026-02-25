"use client";

import { signIn, useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mail, Trash2, Tags, Zap } from "lucide-react";

export default function LandingPage() {
  const { data: session, status } = useSession();

  if (status === "authenticated") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            AI-powered inbox cleanup
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground">
            Take back your
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
              inbox
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            Scan your Gmail, identify clutter, mass unsubscribe, and organize
            everything — powered by AI classification.
          </p>

          <Button
            size="lg"
            className="h-12 px-8 text-base font-medium"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            <Mail className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>

          <p className="text-xs text-muted-foreground">
            We only read email headers (sender, subject). Never email bodies.
          </p>
        </div>

        <div className="max-w-4xl mx-auto mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 px-4">
          <FeatureCard
            icon={<Trash2 className="h-5 w-5" />}
            title="Mass Unsubscribe"
            description="Identify newsletters and promotions by frequency and engagement. One-click unsubscribe."
          />
          <FeatureCard
            icon={<Mail className="h-5 w-5" />}
            title="Smart Cleanup"
            description="AI categorizes every sender. Batch archive or delete thousands of emails instantly."
          />
          <FeatureCard
            icon={<Tags className="h-5 w-5" />}
            title="Auto-Organize"
            description="Create labels and filters automatically. Keep your inbox clean going forward."
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3">
      <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-muted text-foreground">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
