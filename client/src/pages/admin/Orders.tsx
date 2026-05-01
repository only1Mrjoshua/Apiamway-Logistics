import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Package, 
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ChevronRight,
  Archive,
} from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { useLocation } from "wouter";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

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

export default function AdminOrders() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const pageSize = 20;

  const { data, isLoading } = trpc.orders.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    page: currentPage,
    pageSize,
    includeArchived: showArchived,
  });

  const orders = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
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
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <Button onClick={() => setLocation("/")}>Return Home</Button>
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((order: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.trackingNumber.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.customerPhone.includes(query)
    );
  });

  // Reset to page 1 when filters change
  const handleFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
  };

  const handleToggleArchived = () => {
    setShowArchived(prev => !prev);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Manage and track all delivery orders</p>
        </div>
        <Button onClick={() => setLocation("/admin/orders/new")} className="gap-2">
          <Plus className="w-4 h-4" />
          New Order
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by tracking number, name, or phone..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="picked_up">Picked Up</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Show Archived toggle — admin only */}
            {user.role === "admin" && (
              <Button
                variant={showArchived ? "default" : "outline"}
                size="sm"
                onClick={handleToggleArchived}
                className="gap-2 whitespace-nowrap"
              >
                <Archive className="w-4 h-4" />
                {showArchived ? "Hiding Archived" : "Show Archived"}
              </Button>
            )}
          </div>
          {showArchived && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <Archive className="w-3 h-3" />
              Showing archived orders. Archived orders are hidden from the default view.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{showArchived ? "All Orders (incl. Archived)" : "Active Orders"}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {filteredOrders?.length || 0} orders
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredOrders.map((order: any) => (
                <div 
                  key={order.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group ${order.archivedAt ? "opacity-60 bg-muted/30" : ""}`}
                  onClick={() => setLocation(`/admin/orders/${order.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      {order.archivedAt ? (
                        <Archive className="w-6 h-6 text-muted-foreground" />
                      ) : (
                        <Package className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium font-mono">{order.trackingNumber}</p>
                        <Badge variant="outline" className="text-xs">
                          {order.serviceType === "intra-city" ? "Intra-City" : "Inter-City"}
                        </Badge>
                        {order.archivedAt && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{order.customerName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.pickupAddress?.substring(0, 30)}... → {order.deliveryAddress?.substring(0, 30)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">₦{Number(order.price).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.createdAt ? formatDistanceToNow(new Date(order.createdAt), { addSuffix: true }) : ""}
                      </p>
                    </div>
                    <Badge className={statusColors[order.status] || "bg-gray-100"}>
                      {statusLabels[order.status] || order.status}
                    </Badge>
                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No orders found</p>
              <p className="text-sm">
                {searchQuery || statusFilter !== "all" 
                  ? "Try adjusting your filters" 
                  : showArchived
                  ? "No archived orders found"
                  : "Create your first order to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && !showArchived && (
                <Button className="mt-4" onClick={() => setLocation("/admin/orders/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Order
                </Button>
              )}
            </div>
          )}
        </CardContent>
        
        {/* Pagination Controls */}
        {!isLoading && filteredOrders && filteredOrders.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            itemName="orders"
          />
        )}
      </Card>
    </div>
  );
}
