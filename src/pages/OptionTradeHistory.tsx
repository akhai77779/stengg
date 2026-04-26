import { Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { UserOptionTradeHistory } from "@/components/dashboard/UserOptionTradeHistory";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function OptionTradeHistory() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <main className="container mx-auto px-4 py-8">
        <UserOptionTradeHistory />
      </main>
    </Layout>
  );
}