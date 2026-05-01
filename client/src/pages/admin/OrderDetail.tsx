import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Package, 
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserPlus,
  History,
  Copy,
  Archive,
  ArchiveRestore,
  Ban,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  assigned: "bg-blue-100 text-blue-800 border-blue-200",
  picked_up: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_transit: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-gray-100 text-gray-800 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
  failed: "Failed",
  returned: "Returned",
  cancelled: "Cancelled",
};

export default function OrderDetail() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id || "0");

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<string>("");
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [statusNote, setStatusNote] = useState("");

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [forceCancel, setForceCancel] = useState(false);

  // Archive dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data: order, isLoading } = trpc.orders.getById.useQuery({ id: orderId });
  const { data: history } = trpc.orders.getHistory.useQuery({ orderId });
  const { data: riders } = trpc.riders.list.useQuery({ status: "active" });
  const { data: devices } = trpc.devices.list.useQuery({ status: "available" });

  const assignRider = trpc.orders.assignRider.useMutation({
    onSuccess: () => {
      toast.success("Rider assigned successfully");
      utils.orders.getById.invalidate({ id: orderId });
      utils.orders.getHistory.invalidate({ orderId });
      setAssignDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated successfully");
      utils.orders.getById.invalidate({ id: orderId });
      utils.orders.getHistory.invalidate({ orderId });
      setStatusNote("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelOrder = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      toast.success("Order cancelled successfully");
      utils.orders.getById.invalidate({ id: orderId });
      utils.orders.getHistory.invalidate({ orderId });
      setCancelDialogOpen(false);
      setCancelReason("");
      setForceCancel(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const archiveOrder = trpc.orders.archive.useMutation({
    onSuccess: () => {
      toast.success("Order archived successfully");
      utils.orders.getById.invalidate({ id: orderId });
      setArchiveDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unarchiveOrder = trpc.orders.unarchive.useMutation({
    onSuccess: () => {
      toast.success("Order restored from archive");
      utils.orders.getById.invalidate({ id: orderId });
      setUnarchiveDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAssignRider = () => {
    if (!selectedRider || !selectedDevice) {
      toast.error("Please select both rider and device");
      return;
    }
    assignRider.mutate({
      orderId,
      riderId: parseInt(selectedRider),
      deviceId: parseInt(selectedDevice),
    });
  };

  const handleStatusUpdate = (newStatus: string) => {
    updateStatus.mutate({
      orderId,
      status: newStatus as any,
      note: statusNote || undefined,
    });
  };

  const handleCancel = () => {
    cancelOrder.mutate({
      orderId,
      reason: cancelReason || undefined,
      force: forceCancel,
    });
  };

  const copyTrackingNumber = () => {
    if (order?.trackingNumber) {
      navigator.clipboard.writeText(order.trackingNumber);
      toast.success("Tracking number copied!");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!user || !["admin", "dispatcher"].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <Button onClick={() => setLocation("/")}>Return Home</Button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Package className="w-16 h-16 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">Order Not Found</h2>
          <Button onClick={() => setLocation("/admin/orders")}>Back to Orders</Button>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const isArchived = !!order.archivedAt;
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";

  const canAssignRider = order.status === "pending" && !isArchived;
  const canMarkPickedUp = order.status === "assigned" && !isArchived;
  const canMarkInTransit = order.status === "picked_up" && !isArchived;
  const canMarkDelivered = order.status === "in_transit" && !isArchived;
  const canMarkFailed = ["assigned", "picked_up", "in_transit"].includes(order.status) && !isArchived;
  const canCancel = !isCancelled && !isArchived && isAdmin;
  const canArchive = !isArchived && isAdmin;
  const canUnarchive = isArchived && isAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/orders")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono">{order.trackingNumber}</h1>
            <Button variant="ghost" size="icon" onClick={copyTrackingNumber}>
              <Copy className="w-4 h-4" />
            </Button>
            <Badge className={statusColors[order.status] || "bg-gray-100"}>
              {statusLabels[order.status] || order.status}
            </Badge>
            {isArchived && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <Archive className="w-3 h-3 mr-1" />
                Archived
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Created {order.createdAt ? format(new Date(order.createdAt), "PPp") : ""}
          </p>
        </div>
      </div>

      {/* Cancellation reason banner */}
      {isCancelled && order.cancellationReason && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <Ban className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Cancellation Reason</p>
            <p className="text-sm text-red-600 dark:text-red-300">{order.cancellationReason}</p>
            {order.cancelledAt && (
              <p className="text-xs text-red-500 mt-1">
                Cancelled on {format(new Date(order.cancelledAt), "PPp")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Archive notice */}
      {isArchived && order.archivedAt && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Archive className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">This order is archived</p>
            <p className="text-xs text-amber-600 dark:text-amber-300">
              Archived on {format(new Date(order.archivedAt), "PPp")}. It is hidden from the default orders list.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {order.customerPhone}
                  </p>
                </div>
                {order.customerEmail && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {order.customerEmail}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery Route
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <div className="w-0.5 h-full bg-border flex-1 my-1" />
                  </div>
                  <div className="flex-1 pb-6">
                    <p className="text-sm font-medium text-green-600">Pickup</p>
                    <p className="font-medium">{order.pickupAddress}</p>
                    {order.pickupZone && (
                      <Badge variant="outline" className="mt-1">{order.pickupZone}</Badge>
                    )}
                    {order.pickupContactName && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Contact: {order.pickupContactName} - {order.pickupContactPhone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-600">Delivery</p>
                    <p className="font-medium">{order.deliveryAddress}</p>
                    {order.deliveryZone && (
                      <Badge variant="outline" className="mt-1">{order.deliveryZone}</Badge>
                    )}
                    {order.deliveryContactName && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Contact: {order.deliveryContactName} - {order.deliveryContactPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((entry, index) => (
                    <div key={entry.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        {index < history.length - 1 && (
                          <div className="w-0.5 h-full bg-border flex-1 my-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {statusLabels[entry.newStatus] || entry.newStatus}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {entry.createdAt ? format(new Date(entry.createdAt), "PPp") : ""}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-sm text-muted-foreground mt-1">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No history yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Type</span>
                <Badge variant="outline">
                  {order.serviceType === "intra-city" ? "Intra-City" : "Inter-City Air"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Route</span>
                <span>{order.originCity} → {order.destinationCity}</span>
              </div>
              {order.weightKg && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight</span>
                  <span>{order.weightKg} kg</span>
                </div>
              )}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>₦{Number(order.price).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
              <CardDescription>
                {order.riderId ? "Rider assigned" : "No rider assigned yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.riderId ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>Rider ID: {order.riderId}</span>
                  </div>
                  {order.deviceId && (
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <span>Device ID: {order.deviceId}</span>
                    </div>
                  )}
                </div>
              ) : (
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" disabled={!canAssignRider}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Assign Rider
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Rider</DialogTitle>
                      <DialogDescription>
                        Select a rider and device for this delivery.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Rider</label>
                        <Select value={selectedRider} onValueChange={setSelectedRider}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select rider" />
                          </SelectTrigger>
                          <SelectContent>
                            {riders?.items?.map((rider: any) => (
                              <SelectItem key={rider.id} value={rider.id.toString()}>
                                {rider.name} - {rider.phone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Device (GPS Tracker)</label>
                        <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select device" />
                          </SelectTrigger>
                          <SelectContent>
                            {devices?.items?.map((device: any) => (
                              <SelectItem key={device.id} value={device.id.toString()}>
                                {device.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAssignRider} disabled={assignRider.isPending}>
                        {assignRider.isPending ? "Assigning..." : "Assign"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Status Actions */}
          {!isArchived && !isCancelled && (
            <Card>
              <CardHeader>
                <CardTitle>Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Add a note (optional)"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={2}
                />
                <div className="grid grid-cols-1 gap-2">
                  {canMarkPickedUp && (
                    <Button 
                      variant="outline" 
                      className="justify-start"
                      onClick={() => handleStatusUpdate("picked_up")}
                      disabled={updateStatus.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2 text-indigo-500" />
                      Confirm Pickup
                    </Button>
                  )}
                  {canMarkInTransit && (
                    <Button 
                      variant="outline" 
                      className="justify-start"
                      onClick={() => handleStatusUpdate("in_transit")}
                      disabled={updateStatus.isPending}
                    >
                      <Truck className="w-4 h-4 mr-2 text-purple-500" />
                      Mark In Transit
                    </Button>
                  )}
                  {canMarkDelivered && (
                    <Button 
                      variant="outline" 
                      className="justify-start"
                      onClick={() => handleStatusUpdate("delivered")}
                      disabled={updateStatus.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                      Mark Delivered
                    </Button>
                  )}
                  {canMarkFailed && (
                    <Button 
                      variant="outline" 
                      className="justify-start text-red-600 hover:text-red-700"
                      onClick={() => handleStatusUpdate("failed")}
                      disabled={updateStatus.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Mark Failed
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Actions: Cancel & Archive */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Admin Actions</CardTitle>
                <CardDescription>Destructive actions — use with care</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Cancel Order */}
                {canCancel && (
                  <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 border-red-200 hover:border-red-300">
                        <Ban className="w-4 h-4 mr-2" />
                        Cancel Order
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancel Order</DialogTitle>
                        <DialogDescription>
                          This will set the order status to CANCELLED. The order and all its history will remain in the database.
                          {isDelivered && (
                            <span className="block mt-2 text-amber-600 font-medium">
                              Warning: This order has already been delivered. Settlement and financial records will be preserved.
                            </span>
                          )}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="cancel-reason">Cancellation Reason (optional)</Label>
                          <Input
                            id="cancel-reason"
                            placeholder="e.g. Customer requested cancellation"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                          />
                        </div>
                        {isDelivered && (
                          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-md">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Force Cancel Required</p>
                              <p className="text-xs text-amber-600 dark:text-amber-300">
                                Delivered orders require force override. Financial records will not be affected.
                              </p>
                              <label className="flex items-center gap-2 cursor-pointer mt-2">
                                <input
                                  type="checkbox"
                                  checked={forceCancel}
                                  onChange={(e) => setForceCancel(e.target.checked)}
                                  className="rounded"
                                />
                                <span className="text-sm text-amber-700 dark:text-amber-400">I understand — force cancel this order</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelReason(""); setForceCancel(false); }}>
                          Go Back
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleCancel}
                          disabled={cancelOrder.isPending || (isDelivered && !forceCancel)}
                        >
                          {cancelOrder.isPending ? "Cancelling..." : "Confirm Cancel"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Archive Order */}
                {canArchive && (
                  <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300">
                        <Archive className="w-4 h-4 mr-2" />
                        Archive Order
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Archive Order</DialogTitle>
                        <DialogDescription>
                          Archiving hides this order from the default orders list. The order and all financial records remain in the database. You can restore it at any time using "Show Archived" in the orders list.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
                          Go Back
                        </Button>
                        <Button
                          onClick={() => archiveOrder.mutate({ orderId })}
                          disabled={archiveOrder.isPending}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {archiveOrder.isPending ? "Archiving..." : "Archive Order"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Unarchive Order */}
                {canUnarchive && (
                  <Dialog open={unarchiveDialogOpen} onOpenChange={setUnarchiveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <ArchiveRestore className="w-4 h-4 mr-2" />
                        Restore from Archive
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Restore Order</DialogTitle>
                        <DialogDescription>
                          This will make the order visible again in the default orders list.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setUnarchiveDialogOpen(false)}>
                          Go Back
                        </Button>
                        <Button
                          onClick={() => unarchiveOrder.mutate({ orderId })}
                          disabled={unarchiveOrder.isPending}
                        >
                          {unarchiveOrder.isPending ? "Restoring..." : "Restore Order"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timestamps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{order.createdAt ? format(new Date(order.createdAt), "PPp") : "-"}</span>
              </div>
              {order.actualPickupAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Picked Up</span>
                  <span>{format(new Date(order.actualPickupAt), "PPp")}</span>
                </div>
              )}
              {order.actualDeliveryAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivered</span>
                  <span>{format(new Date(order.actualDeliveryAt), "PPp")}</span>
                </div>
              )}
              {order.cancelledAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cancelled</span>
                  <span>{format(new Date(order.cancelledAt), "PPp")}</span>
                </div>
              )}
              {order.archivedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Archived</span>
                  <span>{format(new Date(order.archivedAt), "PPp")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
