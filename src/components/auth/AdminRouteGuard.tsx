import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface AdminRouteGuardProps {
  children: ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, session, isLoading, isAdmin, isAdminLoading } = useAuth();
  const location = useLocation();
  const [serverAllowed, setServerAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verifyAdminOnServer = async () => {
      if (isLoading || isAdminLoading) return;

      if (!user || !session?.access_token || !isAdmin) {
        setServerAllowed(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("admin-session-guard", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!cancelled) {
        setServerAllowed(!error && data?.allowed === true);
      }
    };

    verifyAdminOnServer();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAdminLoading, user, session?.access_token, isAdmin]);

  if (isLoading || isAdminLoading) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin || serverAllowed === false) {
    return <Navigate to="/" replace />;
  }

  if (serverAllowed !== true) return null;

  return <>{children}</>;
}