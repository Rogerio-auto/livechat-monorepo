import { useEffect, useState } from "react";
import { Crown, Zap, Rocket } from "lucide-react";

interface Subscription {
  plan: {
    name: string;
    display_name?: string;
  };
  status: "trial" | "active" | "expired" | "canceled";
  trial_ends_at?: string;
}

const planIcons: Record<string, any> = {
  starter: Zap,
  professional: Crown,
  business: Rocket,
};

const planColors: Record<string, string> = {
  starter: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  professional: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  business: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export function PlanBadge() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subscriptions/current", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setSubscription(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch subscription:", error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 animate-pulse">
        <div className="h-4 w-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const planKey = subscription.plan?.name?.toLowerCase() || "starter";
  const Icon = planIcons[planKey] || Crown;
  const colorClass = planColors[planKey] || planColors.professional;

  const isTrialActive = subscription.status === "trial";
  const trialDaysRemaining = isTrialActive && subscription.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClass} transition-colors`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium capitalize">
        {subscription.plan?.display_name || subscription.plan?.name || "Plano"}
      </span>
      {isTrialActive && (
        <span className="text-xs opacity-75">
          ({trialDaysRemaining}d trial)
        </span>
      )}
    </div>
  );
}
