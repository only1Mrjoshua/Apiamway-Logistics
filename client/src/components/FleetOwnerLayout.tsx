/**
 * FleetOwnerLayout
 *
 * Thin wrapper rendered around all /fleet-owner/dashboard, /fleet-owner/fleet,
 * /fleet-owner/earnings, and /fleet-owner/payouts pages.
 *
 * Adds a persistent top-right Logout button that matches the homepage header
 * style (ghost variant, LogOut icon, disabled while pending, success toast on
 * completion). The individual page headers remain unchanged; this component
 * injects a fixed overlay bar above them.
 */

import { LogOut, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Link } from "wouter";

interface FleetOwnerLayoutProps {
  children: React.ReactNode;
}

export default function FleetOwnerLayout({ children }: FleetOwnerLayoutProps) {
  const { user } = useAuth();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Logged out successfully");
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message || "Logout failed");
    },
  });

  return (
    <div className="relative">
      {/* Persistent top-right action bar — sits above the page's own header */}
      <div className="fixed top-0 right-0 z-50 flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 w-full justify-end pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {user && (
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserCircle className="w-4 h-4" />
              {user.name || user.email || "Fleet Owner"}
            </span>
          )}
          <Link href="/profile">
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground hover:text-primary hover:bg-primary/10"
            >
              <UserCircle className="w-4 h-4 mr-1.5" />
              My Account
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-foreground hover:text-primary hover:bg-primary/10"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            {logoutMutation.isPending ? "Logging out…" : "Logout"}
          </Button>
        </div>
      </div>

      {/* Page content — push down to clear the fixed bar (bar height ≈ 44px) */}
      <div className="pt-11">
        {children}
      </div>
    </div>
  );
}
