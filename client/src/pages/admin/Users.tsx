import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users as UsersIcon } from "lucide-react";
import { Link } from "wouter";
import { Pagination } from "@/components/Pagination";

export default function Users() {
  const [search, setSearch] = useState("");
  const [accountType, setAccountType] = useState<"shipper" | "fleet_owner" | "all">("all");
  const [fleetOwnerStatus, setFleetOwnerStatus] = useState<"pending" | "approved" | "suspended" | "rejected" | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = trpc.users.getAll.useQuery({
    search,
    accountType,
    fleetOwnerStatus,
    page: currentPage,
    pageSize,
  });

  const users = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const getAccountTypeBadge = (accountTypeIntent: string | null, fleetOwnerStatus: string | null) => {
    if (fleetOwnerStatus) {
      const statusColors = {
        pending: "bg-yellow-100 text-yellow-800",
        approved: "bg-green-100 text-green-800",
        suspended: "bg-red-100 text-red-800",
        rejected: "bg-gray-100 text-gray-800",
      };
      return (
        <Badge className={statusColors[fleetOwnerStatus as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
          Fleet Owner ({fleetOwnerStatus})
        </Badge>
      );
    }
    return <Badge className="bg-blue-100 text-blue-800">Shipper</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UsersIcon className="w-8 h-8" />
            Users
          </h1>
          <p className="text-slate-600 mt-1">View all signed-up users and their activity</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={accountType} onValueChange={(value: any) => handleFilterChange(setAccountType, value)}>
              <SelectTrigger>
                <SelectValue placeholder="Account Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Account Types</SelectItem>
                <SelectItem value="shipper">Shippers Only</SelectItem>
                <SelectItem value="fleet_owner">Fleet Owners Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={fleetOwnerStatus} onValueChange={(value: any) => handleFilterChange(setFleetOwnerStatus, value)}>
              <SelectTrigger>
                <SelectValue placeholder="Fleet Owner Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users List ({totalCount} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading users...</div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No users found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead className="text-right">Wallet Balance</TableHead>
                  <TableHead className="text-right">Total Orders</TableHead>
                  <TableHead>Date Joined</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {getAccountTypeBadge(user.accountTypeIntent, user.fleetOwnerStatus)}
                    </TableCell>
                    <TableCell className="text-right">₦{user.walletBalance.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{user.totalOrders}</TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="outline" size="sm">View Details</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination Controls */}
          {!isLoading && users && users.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName="users"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
