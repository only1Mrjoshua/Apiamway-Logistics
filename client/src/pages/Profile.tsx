import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { UserCircle, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Profile() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Move useQuery to top level (React Rules of Hooks)
  const { data: fleetOwnerApp, isLoading: fleetOwnerLoading } = trpc.fleetOwner.getApplicationStatus.useQuery(undefined, {
    enabled: isAuthenticated && !!user,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Pre-fill form with user data
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      setHasChanges(false);
      // Reload page to refresh user data
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const handleInputChange = (field: "name" | "phone", value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!user) return;

    const updates: { name?: string; phone?: string } = {};
    if (formData.name !== (user.name || "")) updates.name = formData.name;
    if (formData.phone !== (user.phone || "")) updates.phone = formData.phone;

    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save");
      return;
    }

    updateProfileMutation.mutate(updates);
  };

  const getAccountTypeBadge = (appStatus: typeof fleetOwnerApp) => {
    if (!user) return null;

    if (appStatus?.status === "approved") {
      return <Badge className="bg-green-600 text-white">Fleet Owner (Approved)</Badge>;
    } else if (appStatus?.status === "pending") {
      return <Badge className="bg-yellow-600 text-white">Fleet Owner (Pending)</Badge>;
    } else if (appStatus?.status === "suspended") {
      return <Badge className="bg-red-600 text-white">Fleet Owner (Suspended)</Badge>;
    }

    return <Badge className="bg-blue-600 text-white">Shipper</Badge>;
  };

  // Show loading state while auth or fleet owner data is loading
  if (authLoading || fleetOwnerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Ensure user exists before rendering
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="container max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">My Profile</h1>
          <p className="text-slate-600 dark:text-slate-400">
            View and edit your account information
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <UserCircle className="w-10 h-10 text-primary" />
              </div>
              <div>
                <CardTitle>{user.name || "User"}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Account Type */}
            <div className="space-y-2">
              <Label>Account Type</Label>
              <div>{getAccountTypeBadge(fleetOwnerApp)}</div>
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email || ""}
                disabled
                className="bg-slate-100 dark:bg-slate-900 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500">
                Email is managed by your OAuth provider and cannot be changed here.
              </p>
            </div>

            {/* Full Name (Editable) */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            {/* Phone Number (Editable) */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="080..."
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateProfileMutation.isPending}
                className="min-w-[120px]"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
