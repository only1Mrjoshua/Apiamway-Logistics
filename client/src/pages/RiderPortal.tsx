import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, User, Package, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export default function RiderPortal() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  // Get rider info
  const { data: riderInfo, isLoading: riderLoading, error: riderError } = trpc.riderPortal.getMyInfo.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Get active order
  const { data: activeOrder, isLoading: orderLoading, refetch: refetchOrder } = trpc.riderPortal.getActiveOrder.useQuery(
    undefined,
    { enabled: !!riderInfo }
  );

  // Mutations
  const pickupMutation = trpc.riderPortal.confirmPickup.useMutation({
    onSuccess: () => {
      toast.success("Pickup confirmed!");
      setConfirmingPickup(false);
      refetchOrder();
    },
    onError: (error) => {
      toast.error(error.message);
      setConfirmingPickup(false);
    },
  });

  const deliveryMutation = trpc.riderPortal.confirmDelivery.useMutation({
    onSuccess: () => {
      toast.success("Delivery confirmed! Settlement processed.");
      setConfirmingDelivery(false);
      refetchOrder();
    },
    onError: (error) => {
      toast.error(error.message);
      setConfirmingDelivery(false);
    },
  });

  const handleConfirmPickup = () => {
    if (!activeOrder) return;
    setConfirmingPickup(true);
    pickupMutation.mutate({ orderId: activeOrder.id });
  };

  const handleConfirmDelivery = () => {
    if (!activeOrder) return;
    setConfirmingDelivery(false);
    deliveryMutation.mutate({ orderId: activeOrder.id });
  };

  // Loading state
  if (authLoading || riderLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Rider Portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Please log in to access the rider portal.</p>
            <Button onClick={() => window.location.href = getLoginUrl()} className="w-full">
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not a rider
  if (riderError || !riderInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You are not registered as a rider. Please contact your administrator if you believe this is an error.
            </p>
            <Button onClick={() => window.location.href = "/"} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No active order
  if (!activeOrder) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Rider Info Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {riderInfo.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {riderInfo.phone}
                </div>
                <Badge variant={riderInfo.status === "active" ? "default" : "secondary"}>
                  {riderInfo.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* No Active Order */}
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Active Deliveries</h3>
              <p className="text-muted-foreground">
                You don't have any active deliveries at the moment. Check back later or contact dispatch.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Active order view
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      assigned: "secondary",
      picked_up: "default",
      in_transit: "default",
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace("_", " ").toUpperCase()}</Badge>;
  };

  const canConfirmPickup = activeOrder.status === "assigned";
  const canConfirmDelivery = activeOrder.status === "picked_up" || activeOrder.status === "in_transit";

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Rider Info Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {riderInfo.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                {riderInfo.phone}
              </div>
              <Badge variant={riderInfo.status === "active" ? "default" : "secondary"}>
                {riderInfo.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active Order Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Active Delivery
              </CardTitle>
              {getStatusBadge(activeOrder.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pickup Address */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-green-600">PICKUP</h4>
                  <p className="text-sm mt-1">{activeOrder.pickupAddress}</p>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {activeOrder.pickupContactName}
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {activeOrder.pickupContactPhone}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t" />

            {/* Delivery Address */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-blue-600">DELIVERY</h4>
                  <p className="text-sm mt-1">{activeOrder.deliveryAddress}</p>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {activeOrder.deliveryContactName}
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {activeOrder.deliveryContactPhone}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t" />

            {/* Action Buttons */}
            <div className="space-y-3">
              {canConfirmPickup && (
                <Button
                  onClick={handleConfirmPickup}
                  disabled={confirmingPickup}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  {confirmingPickup ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Confirm Pickup
                    </>
                  )}
                </Button>
              )}

              {canConfirmDelivery && (
                <Button
                  onClick={handleConfirmDelivery}
                  disabled={confirmingDelivery}
                  className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {confirmingDelivery ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Confirm Delivery
                    </>
                  )}
                </Button>
              )}

              {!canConfirmPickup && !canConfirmDelivery && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No actions available for current order status.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
