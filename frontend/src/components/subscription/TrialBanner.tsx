import { useEffect, useState } from "react";
import { AlertCircle, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Subscription {
  status: "trial" | "active" | "expired" | "canceled";
  trial_ends_at?: string;
  plan: {
    name: string;
    display_name?: string;
  };
}

export function TrialBanner() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if banner was dismissed in this session
    const wasDismissed = sessionStorage.getItem("trial-banner-dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }

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

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("trial-banner-dismissed", "true");
  };

  if (loading || dismissed || !subscription) {
    return null;
  }

  // Only show for trial subscriptions
  if (subscription.status !== "trial") {
    return null;
  }

  const daysRemaining = subscription.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const isUrgent = daysRemaining <= 3;
  const bgColor = isUrgent
    ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
    : "bg-[rgba(47,180,99,0.12)] dark:bg-[rgba(27,58,41,0.6)] border-[rgba(47,180,99,0.28)] dark:border-[rgba(116,230,158,0.18)]";
  const textColor = isUrgent
    ? "text-red-800 dark:text-red-300"
    : "text-[#1f8b49] dark:text-[#74e69e]";
  const iconColor = isUrgent
    ? "text-red-500 dark:text-red-400"
    : "text-[#2fb463] dark:text-[#74e69e]";

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-b ${bgColor} ${textColor}`}
    >
      <div className="flex items-center gap-3 flex-1">
        <AlertCircle className={`h-5 w-5 ${iconColor} flex-shrink-0`} />
        <div className="flex-1">
          <p className="text-sm font-medium">
            {daysRemaining > 0 ? (
              <>
                Seu trial termina em{" "}
                <span className="font-bold">{daysRemaining} dia{daysRemaining !== 1 ? "s" : ""}</span>
              </>
            ) : (
              <span className="font-bold">Seu trial expira hoje!</span>
            )}
          </p>
          <p className="text-xs opacity-75 mt-0.5">
            Plano atual: {subscription.plan?.display_name || subscription.plan?.name || "Trial"}. Atualize para continuar usando sem interrupções.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/subscription"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            isUrgent
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-[#2fb463] text-white hover:bg-[#1f8b49]"
          }`}
        >
          Atualizar Plano
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={handleDismiss}
          className={`p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${textColor}`}
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
