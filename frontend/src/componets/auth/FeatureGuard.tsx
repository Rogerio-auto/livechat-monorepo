import { Navigate, Outlet } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';

interface FeatureGuardProps {
  feature: string;
  redirectPath?: string;
  children?: React.ReactNode;
}

export function FeatureGuard({ feature, redirectPath = '/dashboard', children }: FeatureGuardProps) {
  const { features, loading } = useSubscription();

  if (loading) {
    // You might want to replace this with a proper loading spinner component
    return (
      <div className="flex h-screen items-center justify-center bg-[#08150c]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7bf0b0] border-t-transparent"></div>
      </div>
    );
  }

  if (!features[feature]) {
    return <Navigate to={redirectPath} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
