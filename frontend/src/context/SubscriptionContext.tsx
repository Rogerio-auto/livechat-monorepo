import React, { createContext, useContext, useEffect, useState } from 'react';

export interface PlanFeatures {
  tasks_module?: boolean;
  calendar_module?: boolean;
  media_library?: boolean;
  document_generation?: boolean;
  [key: string]: boolean | undefined;
}

interface Plan {
  name: string;
  display_name?: string;
  features: PlanFeatures;
}

interface Subscription {
  plan: Plan;
  status: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  features: PlanFeatures;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
      const res = await fetch(`${API}/api/subscriptions/current`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error("Failed to fetch subscription", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const features = subscription?.plan?.features || {};

  return (
    <SubscriptionContext.Provider value={{ subscription, features, loading, refreshSubscription: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
