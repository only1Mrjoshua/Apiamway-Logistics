import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Fleet Owner Authentication Hook
 * 
 * Enforces access control for Fleet Owner dashboard:
 * - Approved Fleet Owners → allow access
 * - Pending/Rejected → redirect to /fleet-owner/status
 * - No application → redirect to /fleet-owner/onboarding
 * - Not logged in → redirect to login
 */
export function useFleetOwnerAuth() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: applicationStatus, isLoading: statusLoading } = trpc.fleetOwner.getApplicationStatus.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const loading = authLoading || statusLoading;

  useEffect(() => {
    if (loading) return;

    // Not logged in → redirect to login
    if (!isAuthenticated) {
      setLocation("/get-started");
      return;
    }

    // No application → redirect to onboarding
    if (!applicationStatus?.hasApplication) {
      setLocation("/fleet-owner/onboarding");
      return;
    }

    // Pending or rejected → redirect to status page
    if (applicationStatus.status !== "approved") {
      setLocation("/fleet-owner/status");
      return;
    }

    // Approved → allow access (do nothing)
  }, [loading, isAuthenticated, applicationStatus, setLocation]);

  return {
    user,
    loading,
    isApproved: applicationStatus?.status === "approved",
    application: applicationStatus?.application,
  };
}
