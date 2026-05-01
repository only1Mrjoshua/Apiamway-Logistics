import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Wallet as WalletIcon, Plus, Minus } from "lucide-react";
import { Link, useSearch } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";
import { useEffect } from "react";

export default function AdminWallets() {
  const searchParams = new URLSearchParams(useSearch());
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<{ userId: number; currentBalance: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");
  const pageSize = 20;
  
  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    const newSearch = params.toString();
    window.history.replaceState({}, '', newSearch ? `?${newSearch}` : window.location.pathname);
  }, [currentPage]);

  const { data, isLoading, refetch } = trpc.wallet.getAllWallets.useQuery({
    page: currentPage,
    pageSize,
  });
  
  const wallets = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;
  
  const adjustMutation = trpc.wallet.adminAdjust.useMutation({
    onSuccess: () => {
      toast.success(`Wallet ${adjustType === "credit" ? "credited" : "debited"} successfully`);
      setAdjustDialogOpen(false);
      setAdjustAmount("");
      setAdjustReason("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Client-side search filtering
  const filteredWallets = wallets?.filter((wallet: any) =>
    wallet.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wallet.userEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdjustClick = (wallet: { userId: number; balance: string }, type: "credit" | "debit") => {
    setSelectedWallet({ userId: wallet.userId, currentBalance: wallet.balance });
    setAdjustType(type);
    setAdjustDialogOpen(true);
  };

  const handleAdjustSubmit = () => {
    if (!selectedWallet || !adjustAmount || !adjustReason) {
      toast.error("Please fill in all fields");
      return;
    }

    adjustMutation.mutate({
      userId: selectedWallet.userId,
      amount: adjustAmount,
      type: adjustType,
      reason: adjustReason,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Loading wallets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wallet Management</h1>
          <p className="text-slate-500 mt-1">View and manage customer wallets</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Wallets</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Total Credited</TableHead>
                <TableHead>Total Debited</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWallets && filteredWallets.length > 0 ? (
                filteredWallets.map((wallet) => (
                  <TableRow key={wallet.userId}>
                    <TableCell className="font-medium">{wallet.userName || "N/A"}</TableCell>
                    <TableCell>{wallet.userEmail || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={parseFloat(wallet.balance) > 0 ? "default" : "secondary"}>
                        ₦{parseFloat(wallet.balance).toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600">
                      ₦{parseFloat(wallet.totalCredited).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-red-600">
                      ₦{parseFloat(wallet.totalDebited).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdjustClick(wallet, "credit")}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Credit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdjustClick(wallet, "debit")}
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          Debit
                        </Button>
                        <Link href={`/admin/wallets/${wallet.userId}`}>
                          <Button size="sm" variant="ghost">
                            <WalletIcon className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No wallets found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Pagination */}
      {!isLoading && filteredWallets && filteredWallets.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemName="wallets"
        />
      )}

      {/* Adjust Wallet Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustType === "credit" ? "Credit" : "Debit"} Wallet
            </DialogTitle>
            <DialogDescription>
              Current balance: ₦{selectedWallet ? parseFloat(selectedWallet.currentBalance).toLocaleString() : "0"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for adjustment..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustSubmit} disabled={adjustMutation.isPending}>
              {adjustMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
