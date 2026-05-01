import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignRiderDialog } from "@/components/AssignRiderDialog";
import { AssignDeviceDialog } from "@/components/AssignDeviceDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  XCircle,
  Ban,
  Wallet,
  Users,
  Smartphone,
  Package,
} from "lucide-react";
import { format } from "date-fns";

export default function PartnerDetail() {
  const params = useParams();
  const partnerId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [showAssignRider, setShowAssignRider] = useState(false);
  const [showAssignDevice, setShowAssignDevice] = useState(false);

  const { data: partner, isLoading, refetch } = trpc.partners.getById.useQuery({ id: partnerId });
  const { data: fleet, refetch: refetchFleet } = trpc.partners.getFleet.useQuery({ partnerCompanyId: partnerId });
  const { data: earnings } = trpc.partners.getEarnings.useQuery({ partnerCompanyId: partnerId });
  const { data: orders } = trpc.partners.getOrders.useQuery({ partnerCompanyId: partnerId });

  const approveMutation = trpc.partners.approve.useMutation({
    onSuccess: () => {
      toast.success("Fleet Owner approved successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve partner");
    },
  });

  const updateMutation = trpc.partners.update.useMutation({
    onSuccess: () => {
      toast.success("Fleet Owner status updated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update partner");
    },
  });

  const unassignRiderMutation = trpc.partners.unassignRider.useMutation({
    onSuccess: () => {
      toast.success("Rider unassigned successfully");
      refetchFleet();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to unassign rider");
    },
  });

  const unassignDeviceMutation = trpc.partners.unassignDevice.useMutation({
    onSuccess: () => {
      toast.success("Device unassigned successfully");
      refetchFleet();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to unassign device");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading partner details...</div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-muted-foreground">Fleet Owner not found</div>
        <Button onClick={() => setLocation("/admin/partners")}>
          Back to Fleet Owners
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      approved: "default",
      suspended: "destructive",
      rejected: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCommissionDisplay = (type: string, value: string | number): string => {
    if (type === "percentage") {
      return `${value}%`;
    }
    return `₦${Number(value).toLocaleString()}`;
  };

  const totalEarnings = earnings?.reduce(
    (sum, e) => sum + parseFloat(e.partnerAmount),
    0
  ) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin/partners")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              {partner.name}
              {getStatusBadge(partner.status)}
            </h1>
            <p className="text-muted-foreground">Fleet Owner Company Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          {partner.status === "pending" && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  updateMutation.mutate({ id: partnerId, status: "rejected" })
                }
                disabled={updateMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={() => approveMutation.mutate({ id: partnerId })}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          {partner.status === "approved" && (
            <Button
              variant="destructive"
              onClick={() =>
                updateMutation.mutate({ id: partnerId, status: "suspended" })
              }
              disabled={updateMutation.isPending}
            >
              <Ban className="w-4 h-4 mr-2" />
              Suspend
            </Button>
          )}
          {partner.status === "suspended" && (
            <Button
              onClick={() =>
                updateMutation.mutate({ id: partnerId, status: "approved" })
              }
              disabled={updateMutation.isPending}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{Number(partner.balance || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Owner Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{totalEarnings.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payouts every Friday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(fleet?.riders.length || 0) + (fleet?.devices.length || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fleet?.riders.length || 0} riders, {fleet?.devices.length || 0} devices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company Name</p>
                  <p className="font-medium">{partner.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(partner.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact Name</p>
                  <p className="font-medium">{partner.contactName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact Phone</p>
                  <p className="font-medium">{partner.contactPhone}</p>
                </div>
                {partner.contactEmail && (
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Email</p>
                    <p className="font-medium">{partner.contactEmail}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Commission Type</p>
                  <p className="font-medium capitalize">{partner.commissionType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {partner.commissionType === "percentage"
                      ? "Fleet Owner Share"
                      : "Apiamway Commission (Flat)"}
                  </p>
                  <p className="font-medium">
                    {getCommissionDisplay(partner.commissionType, partner.commissionValue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {partner.commissionType === "percentage"
                      ? `Apiamway: ${(100 - Number(partner.commissionValue)).toFixed(0)}%`
                      : `Fleet Owner gets: Order Amount - ₦${partner.commissionValue}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="font-medium">
                    {format(new Date(partner.createdAt), "MMM dd, yyyy")}
                  </p>
                </div>
                {partner.approvedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Approved At</p>
                    <p className="font-medium">
                      {format(new Date(partner.approvedAt), "MMM dd, yyyy")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Owner Earnings Ledger</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Earnings accumulate in wallet. Payouts processed every Friday.
              </p>
            </CardHeader>
            <CardContent>
              {earnings && earnings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead className="text-right">Order Price</TableHead>
                      <TableHead className="text-right">Apiamway</TableHead>
                      <TableHead className="text-right">Fleet Owner</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((earning) => (
                      <TableRow key={earning.id}>
                        <TableCell>
                          {format(new Date(earning.createdAt), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          #{earning.orderId}
                        </TableCell>
                        <TableCell className="text-right">
                          ₦{Number(earning.orderPrice).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ₦{Number(earning.apiamwayAmount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₦{Number(earning.partnerAmount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={earning.status === "credited" ? "default" : "secondary"}>
                            {earning.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No earnings yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fleet Tab */}
        <TabsContent value="fleet" className="space-y-4">
          {/* Riders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Riders ({fleet?.riders.length || 0})
                </div>
                {partner.status === "approved" && (
                  <Button
                    size="sm"
                    onClick={() => setShowAssignRider(true)}
                  >
                    Assign Rider
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fleet && fleet.riders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hub</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fleet.riders.map((rider) => (
                      <TableRow key={rider.id}>
                        <TableCell className="font-medium">{rider.name}</TableCell>
                        <TableCell>{rider.phone}</TableCell>
                        <TableCell>
                          <Badge variant={rider.status === "active" ? "default" : "secondary"}>
                            {rider.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{rider.assignedHub || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unassignRiderMutation.mutate({ riderId: rider.id })}
                            disabled={unassignRiderMutation.isPending}
                          >
                            Unassign
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No riders assigned yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Devices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Bikes ({fleet?.devices.length || 0})
                </div>
                {partner.status === "approved" && (
                  <Button
                    size="sm"
                    onClick={() => setShowAssignDevice(true)}
                  >
                    Assign Bike
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fleet && fleet.devices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Traccar ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fleet.devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {device.traccarDeviceId}
                        </TableCell>
                        <TableCell>
                          <Badge variant={device.status === "available" ? "default" : "secondary"}>
                            {device.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unassignDeviceMutation.mutate({ deviceId: device.id })}
                            disabled={unassignDeviceMutation.isPending}
                          >
                            Unassign
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No devices assigned yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialogs */}
      <AssignRiderDialog
        open={showAssignRider}
        onOpenChange={setShowAssignRider}
        partnerCompanyId={partnerId}
        onSuccess={refetchFleet}
      />
      <AssignDeviceDialog
        open={showAssignDevice}
        onOpenChange={setShowAssignDevice}
        partnerCompanyId={partnerId}
        onSuccess={refetchFleet}
      />
    </div>
  );
}
