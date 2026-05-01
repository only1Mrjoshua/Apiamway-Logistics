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
  Users,
  Plus,
  AlertTriangle,
  Phone,
  MapPin,
  Edit,
  Search
} from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { useLocation, useSearch } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Link2, Unlink } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  on_leave: "bg-yellow-100 text-yellow-800",
};

export default function AdminRiders() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRider, setEditingRider] = useState<any>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingRider, setLinkingRider] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "on_leave">("active");
  const [assignedHub, setAssignedHub] = useState("Enugu-Main");
  
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

  const { data, isLoading } = trpc.riders.list.useQuery({
    searchQuery: debouncedSearch || undefined,
    page: currentPage,
    pageSize,
  });

  const riders = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;

  const createRider = trpc.riders.create.useMutation({
    onSuccess: () => {
      toast.success("Rider created successfully");
      utils.riders.list.invalidate();
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateRider = trpc.riders.update.useMutation({
    onSuccess: () => {
      toast.success("Rider updated successfully");
      utils.riders.list.invalidate();
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const linkUser = trpc.riders.linkUser.useMutation({
    onSuccess: () => {
      toast.success("User linked successfully");
      utils.riders.list.invalidate();
      setLinkDialogOpen(false);
      setLinkingRider(null);
      setSelectedUserId(null);
      setUserSearchQuery("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unlinkUser = trpc.riders.unlinkUser.useMutation({
    onSuccess: () => {
      toast.success("User unlinked successfully");
      utils.riders.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Query users for linking
  const { data: usersData } = trpc.users.getAll.useQuery({
    search: userSearchQuery,
    page: 1,
    pageSize: 20,
  });

  const resetForm = () => {
    setName("");
    setPhone("");
    setStatus("active");
    setAssignedHub("Enugu-Main");
    setEditingRider(null);
  };

  const openEditDialog = (rider: any) => {
    setEditingRider(rider);
    setName(rider.name);
    setPhone(rider.phone);
    setStatus(rider.status);
    setAssignedHub(rider.assignedHub || "Enugu-Main");
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!name || !phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingRider) {
      updateRider.mutate({
        id: editingRider.id,
        name,
        phone,
        status,
        assignedHub,
      });
    } else {
      createRider.mutate({
        name,
        phone,
        status,
        assignedHub,
      });
    }
  };

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
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
          <p className="text-muted-foreground">Only administrators can manage riders.</p>
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
          <h1 className="text-3xl font-bold tracking-tight">Riders</h1>
          <p className="text-muted-foreground">Manage delivery riders</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Rider
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRider ? "Edit Rider" : "Add New Rider"}</DialogTitle>
              <DialogDescription>
                {editingRider ? "Update rider information" : "Add a new delivery rider to the system"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input 
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rider's full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input 
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08012345678"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub">Assigned Hub</Label>
                <Input 
                  id="hub"
                  value={assignedHub}
                  onChange={(e) => setAssignedHub(e.target.value)}
                  placeholder="Enugu-Main"
                />
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
                disabled={createRider.isPending || updateRider.isPending}
              >
                {createRider.isPending || updateRider.isPending 
                  ? "Saving..." 
                  : editingRider ? "Update" : "Add Rider"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Link User Dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link User Account</DialogTitle>
              <DialogDescription>
                Link a user account to {linkingRider?.name} to enable rider portal access
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user-search">Search Users</Label>
                <Input
                  id="user-search"
                  placeholder="Search by name, email, or phone..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select
                  value={selectedUserId?.toString() || ""}
                  onValueChange={(val) => setSelectedUserId(Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usersData?.items.map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setLinkDialogOpen(false);
                  setLinkingRider(null);
                  setSelectedUserId(null);
                  setUserSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedUserId || !linkingRider) {
                    toast.error("Please select a user");
                    return;
                  }
                  linkUser.mutate({
                    riderId: linkingRider.id,
                    userId: selectedUserId,
                  });
                }}
                disabled={linkUser.isPending || !selectedUserId}
              >
                {linkUser.isPending ? "Linking..." : "Link User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Riders Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : riders && riders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {riders.map((rider) => (
            <Card key={rider.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{rider.name}</CardTitle>
                      <Badge className={statusColors[rider.status]}>
                        {rider.status === "on_leave" ? "On Leave" : rider.status}
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => openEditDialog(rider)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  {rider.phone}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {rider.assignedHub || "Enugu-Main"}
                </div>
                
                {/* Linked User */}
                {rider.userId ? (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Link2 className="w-4 h-4 text-green-600" />
                        <span className="text-muted-foreground">Linked Account</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to unlink this user account?")) {
                            unlinkUser.mutate({ riderId: rider.id });
                          }
                        }}
                      >
                        <Unlink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setLinkingRider(rider);
                        setLinkDialogOpen(true);
                      }}
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Link User Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            {debouncedSearch ? (
              <>
                <p className="text-lg font-medium">No riders found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your search query</p>
                <Button className="mt-4" variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No riders yet</p>
                <p className="text-sm text-muted-foreground">Add your first rider to get started</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rider
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && riders && riders.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemName="riders"
        />
      )}
    </div>
  );
}
