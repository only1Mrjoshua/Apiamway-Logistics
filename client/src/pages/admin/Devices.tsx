import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Smartphone,
  Plus,
  AlertTriangle,
  Edit,
  Wifi,
  WifiOff,
  Truck,
  Building2,
  Wrench,
  CheckCircle,
  History,
  Clock,
  Search
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  maintenance: "bg-yellow-100 text-yellow-800",
};

export default function AdminDevices() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceDevice, setMaintenanceDevice] = useState<any>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyDeviceId, setHistoryDeviceId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [traccarDeviceId, setTraccarDeviceId] = useState("");
  const [status, setStatus] = useState<"available" | "in_transit" | "maintenance" | "inactive">("available");
  
  // Maintenance form state
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenanceUntil, setMaintenanceUntil] = useState("");
  
  // URL state management
  const searchParams = new URLSearchParams(useSearch());
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const pageSize = 20;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (currentPage > 1) params.set('page', currentPage.toString());
    const newSearch = params.toString();
    window.history.replaceState({}, '', newSearch ? `?${newSearch}` : window.location.pathname);
  }, [debouncedSearch, currentPage]);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.devices.list.useQuery({
    searchQuery: debouncedSearch || undefined,
    page: currentPage,
    pageSize,
  });

  const devices = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;

  const createDevice = trpc.devices.create.useMutation({
    onSuccess: () => {
      toast.success("Device added successfully");
      utils.devices.list.invalidate();
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateDevice = trpc.devices.update.useMutation({
    onSuccess: () => {
      toast.success("Device updated successfully");
      utils.devices.list.invalidate();
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const setDeviceMaintenance = trpc.devices.update.useMutation({
    onSuccess: () => {
      toast.success("Bike set to maintenance");
      utils.devices.list.invalidate();
      setMaintenanceDialogOpen(false);
      setMaintenanceDevice(null);
      setMaintenanceReason("");
      setMaintenanceUntil("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const markDeviceAvailable = trpc.devices.update.useMutation({
    onSuccess: () => {
      toast.success("Bike marked as available");
      utils.devices.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setName("");
    setLabel("");
    setTraccarDeviceId("");
    setStatus("available");
    setEditingDevice(null);
  };

  const openEditDialog = (device: any) => {
    setEditingDevice(device);
    setName(device.name);
    setLabel(device.label || "");
    setTraccarDeviceId(device.traccarDeviceId.toString());
    setStatus(device.status);
    setDialogOpen(true);
  };

  const openMaintenanceDialog = (device: any) => {
    setMaintenanceDevice(device);
    setMaintenanceReason("");
    setMaintenanceUntil("");
    setMaintenanceDialogOpen(true);
  };

  const handleSetMaintenance = () => {
    if (!maintenanceDevice || !maintenanceReason.trim()) {
      toast.error("Maintenance reason is required");
      return;
    }

    setDeviceMaintenance.mutate({
      id: maintenanceDevice.id,
      status: "maintenance",
      maintenanceReason: maintenanceReason.trim(),
      maintenanceUntil: maintenanceUntil ? new Date(maintenanceUntil).toISOString() : undefined,
    });
  };

  const handleMarkAvailable = (device: any) => {
    markDeviceAvailable.mutate({
      id: device.id,
      status: "available",
      maintenanceReason: null,
      maintenanceUntil: null,
    });
  };

  const handleSubmit = () => {
    if (!name || !traccarDeviceId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const deviceId = parseInt(traccarDeviceId);
    if (isNaN(deviceId)) {
      toast.error("Traccar Device ID must be a number");
      return;
    }

    if (editingDevice) {
      updateDevice.mutate({
        id: editingDevice.id,
        name,
        label: label || undefined,
        traccarDeviceId: deviceId,
        status,
      });
    } else {
      createDevice.mutate({
        name,
        label: label || undefined,
        traccarDeviceId: deviceId,
        status,
      });
    }
  };

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto" />
          <h2 className="text-2xl font-bold">Admin Access Required</h2>
          <p className="text-muted-foreground">Only administrators can manage devices.</p>
          <Button onClick={() => setLocation("/admin")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bikes</h1>
          <p className="text-muted-foreground">Manage bikes with GPS tracking devices</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Bike
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDevice ? "Edit Bike" : "Add New Bike"}</DialogTitle>
              <DialogDescription>
                {editingDevice 
                  ? "Update bike information" 
                  : "Add a bike with GPS tracking device from your Traccar server"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Bike Name *</Label>
                <Input 
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. E-Bike 001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Bike Label (Optional)</Label>
                <Input 
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. PTNR-02, BIKE-001"
                />
                <p className="text-xs text-muted-foreground">
                  Human-readable bike code for easy identification
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="traccarId">Traccar Device ID *</Label>
                <Input 
                  id="traccarId"
                  type="number"
                  value={traccarDeviceId}
                  onChange={(e) => setTraccarDeviceId(e.target.value)}
                  placeholder="e.g. 12345"
                />
                <p className="text-xs text-muted-foreground">
                  The numeric ID from your Traccar server
                </p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createDevice.isPending || updateDevice.isPending}
              >
                {createDevice.isPending || updateDevice.isPending 
                  ? "Saving..." 
                  : editingDevice ? "Update" : "Add Bike"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Wifi className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Traccar Integration</p>
              <p className="text-sm text-blue-700">
                Bikes must be registered in your self-hosted Traccar server first. 
                Add the Traccar Device ID here to link it with your delivery system.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by label, Traccar ID, status, or Fleet Owner..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Devices Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : devices && devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <Card key={device.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      device.status === "available" ? "bg-green-100" : 
                      device.status === "in_transit" ? "bg-blue-100" :
                      device.status === "maintenance" ? "bg-yellow-100" : "bg-gray-100"
                    }`}>
                      {device.status === "available" ? (
                        <Wifi className="w-6 h-6 text-green-600" />
                      ) : device.status === "in_transit" ? (
                        <Truck className="w-6 h-6 text-blue-600" />
                      ) : device.status === "maintenance" ? (
                        <WifiOff className="w-6 h-6 text-yellow-600" />
                      ) : (
                        <WifiOff className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{device.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={
                          device.status === "available" ? "bg-green-100 text-green-800" :
                          device.status === "in_transit" ? "bg-blue-100 text-blue-800" :
                          device.status === "maintenance" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }>
                          {device.status === "available" ? "Available" :
                           device.status === "in_transit" ? "In Transit" :
                           device.status === "maintenance" ? "Maintenance" :
                           "Inactive"}
                        </Badge>
                        {device.label && (
                          <Badge variant="outline" className="text-xs">
                            {device.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setHistoryDeviceId(device.id);
                        setHistoryDialogOpen(true);
                      }}
                      title="View Maintenance History"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(device)}
                      title="Edit Bike"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Smartphone className="w-4 h-4" />
                    Traccar ID: {device.traccarDeviceId}
                  </div>
                  {device.partnerCompany && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="font-medium text-primary">
                        {device.partnerCompany.name}
                      </span>
                    </div>
                  )}
                  
                  {/* Maintenance Info */}
                  {device.status === "maintenance" && device.maintenanceReason && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                            <Wrench className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-yellow-900 truncate">{device.maintenanceReason}</p>
                              {device.maintenanceUntil && (
                                <p className="text-yellow-700 mt-1">
                                  Until: {new Date(device.maintenanceUntil).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{device.maintenanceReason}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {device.status === "maintenance" ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => handleMarkAvailable(device)}
                        disabled={markDeviceAvailable.isPending}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Mark Available
                      </Button>
                    ) : device.status === "available" ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                        onClick={() => openMaintenanceDialog(device)}
                      >
                        <Wrench className="w-3 h-3 mr-1" />
                        Set Maintenance
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            {debouncedSearch ? (
              <>
                <p className="text-lg font-medium">No bikes found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your search query</p>
                <Button className="mt-4" variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No bikes yet</p>
                <p className="text-sm text-muted-foreground">Add your first bike with GPS tracking to enable delivery tracking</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bike
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && devices && devices.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemName="bikes"
        />
      )}

      {/* Maintenance Dialog */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Bike to Maintenance</DialogTitle>
            <DialogDescription>
              {maintenanceDevice && (
                <span>Set <strong>{maintenanceDevice.name}</strong> to maintenance mode</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="maintenanceReason">Maintenance Reason *</Label>
              <Textarea
                id="maintenanceReason"
                value={maintenanceReason}
                onChange={(e) => setMaintenanceReason(e.target.value)}
                placeholder="e.g., Brake repair, tire replacement, routine service"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenanceUntil">Estimated Return Date (Optional)</Label>
              <Input
                id="maintenanceUntil"
                type="date"
                value={maintenanceUntil}
                onChange={(e) => setMaintenanceUntil(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                When do you expect the bike to be available again?
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setMaintenanceDialogOpen(false);
                setMaintenanceDevice(null);
                setMaintenanceReason("");
                setMaintenanceUntil("");
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSetMaintenance}
              disabled={setDeviceMaintenance.isPending || !maintenanceReason.trim()}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {setDeviceMaintenance.isPending ? "Setting..." : "Set to Maintenance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance History Dialog */}
      <MaintenanceHistoryDialog 
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        deviceId={historyDeviceId}
      />
    </div>
  );
}

// Maintenance History Dialog Component
function MaintenanceHistoryDialog({ 
  open, 
  onOpenChange, 
  deviceId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  deviceId: number | null; 
}) {
  const { data: history, isLoading } = trpc.devices.getMaintenanceHistory.useQuery(
    { deviceId: deviceId! },
    { enabled: !!deviceId && open }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Maintenance History</DialogTitle>
          <DialogDescription>
            Complete audit log of all maintenance actions for this bike
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : history && history.length > 0 ? (
            history.map((event) => (
              <Card key={event.id} className="border-l-4 border-l-primary">
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {event.actionType === "set_maintenance" ? (
                          <Wrench className="w-4 h-4 text-yellow-600" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        <span className="font-medium">
                          {event.actionType === "set_maintenance" 
                            ? "Set to Maintenance" 
                            : "Marked as Available"}
                        </span>
                      </div>
                      
                      {event.reason && (
                        <p className="text-sm text-muted-foreground pl-6">
                          <strong>Reason:</strong> {event.reason}
                        </p>
                      )}
                      
                      {event.maintenanceUntil && (
                        <p className="text-sm text-muted-foreground pl-6">
                          <strong>Expected return:</strong> {new Date(event.maintenanceUntil).toLocaleDateString()}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pl-6 pt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(event.createdAt).toLocaleString()}
                        </div>
                        {event.performedBy && (
                          <div>
                            By: <span className="font-medium">{event.performedBy.name || "Unknown Admin"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No maintenance history yet</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
