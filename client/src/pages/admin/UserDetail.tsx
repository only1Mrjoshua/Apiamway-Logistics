import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, User, Package, Wallet, Gift, Plus, Minus } from "lucide-react";

export default function UserDetail() {
  const [, params] = useRoute("/admin/users/:id");
  const userId = parseInt(params?.id || "0");
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "debit">("credit");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const { data: user, isLoading: userLoading } = trpc.users.getById.useQuery({ id: userId });
  const { data: orders, isLoading: ordersLoading } = trpc.users.getOrders.useQuery({ userId });
  const { data: walletData, isLoading: walletLoading, refetch: refetchWallet } = trpc.users.getWalletTransactions.useQuery({ userId });
  const { data: referralData, isLoading: referralLoading } = trpc.users.getReferralStats.useQuery({ userId });

  const adjustMutation = trpc.wallet.adminAdjust.useMutation({
    onSuccess: () => {
      toast.success(`Wallet ${adjustmentType === "credit" ? "credited" : "debited"} successfully`);
      setAdjustmentDialogOpen(false);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      refetchWallet();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAdjustmentSubmit = () => {
    if (!adjustmentAmount || !adjustmentReason) {
      toast.error("Please fill in all fields");
      return;
    }

    adjustMutation.mutate({
      userId,
      amount: adjustmentAmount,
      type: adjustmentType,
      reason: adjustmentReason,
    });
  };

  if (userLoading) {
    return <div className="p-6">Loading user details...</div>;
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">User not found</p>
          <Link href="/admin/users">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getAccountTypeBadge = () => {
    if (user.fleetOwnerApplication) {
      const statusColors = {
        pending: "bg-yellow-100 text-yellow-800",
        approved: "bg-green-100 text-green-800",
        suspended: "bg-red-100 text-red-800",
        rejected: "bg-gray-100 text-gray-800",
      };
      return (
        <Badge className={statusColors[user.fleetOwnerApplication.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
          Fleet Owner ({user.fleetOwnerApplication.status})
        </Badge>
      );
    }
    return <Badge className="bg-blue-100 text-blue-800">Shipper</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/users">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="w-8 h-8" />
            {user.name || "Unknown User"}
          </h1>
          <p className="text-slate-600 mt-1">{user.email}</p>
        </div>
        <div>{getAccountTypeBadge()}</div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders?.length || 0})</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Full Name</p>
                  <p className="font-medium">{user.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{user.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Account Type Intent</p>
                  <p className="font-medium">{user.accountTypeIntent || "shipper"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date Joined</p>
                  <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {user.fleetOwnerApplication && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-bold mb-4">Fleet Owner Application</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Company Name</p>
                      <p className="font-medium">{user.fleetOwnerApplication.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Status</p>
                      <p className="font-medium">{user.fleetOwnerApplication.status}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Contact Person</p>
                      <p className="font-medium">{user.fleetOwnerApplication.contactName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Contact Phone</p>
                      <p className="font-medium">{user.fleetOwnerApplication.contactPhone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500">Contact Email</p>
                      <p className="font-medium">{user.fleetOwnerApplication.contactEmail || "N/A"}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link href={`/admin/partners/${user.fleetOwnerApplication.id}`}>
                      <Button variant="outline" size="sm">
                        View Fleet Owner Details
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8 text-slate-500">Loading orders...</div>
              ) : !orders || orders.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No orders found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking Number</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">{order.trackingNumber}</TableCell>
                        <TableCell>{order.serviceType}</TableCell>
                        <TableCell>
                          <Badge>{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">₦{parseFloat(order.price).toLocaleString()}</TableCell>
                        <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Link href={`/admin/orders/${order.id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Wallet & Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {walletLoading ? (
                <div className="text-center py-8 text-slate-500">Loading wallet...</div>
              ) : !walletData?.wallet ? (
                <div className="text-center py-8 text-slate-500">No wallet found</div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg flex-1">
                      <p className="text-sm text-slate-500">Current Balance</p>
                      <p className="text-3xl font-bold">₦{parseFloat(walletData.wallet.balance).toLocaleString()}</p>
                    </div>
                    {!user.fleetOwnerApplication && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAdjustmentType("credit");
                            setAdjustmentAmount("");
                            setAdjustmentReason("");
                            setAdjustmentDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Credit Wallet
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAdjustmentType("debit");
                            setAdjustmentAmount("");
                            setAdjustmentReason("");
                            setAdjustmentDialogOpen(true);
                          }}
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          Debit Wallet
                        </Button>
                      </div>
                    )}
                    {user.fleetOwnerApplication && (
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800 max-w-xs">
                        <p className="font-medium mb-1">Fleet Owner Wallet</p>
                        <p className="text-xs">Fleet Owner wallet adjustments are handled via settlement/payout only.</p>
                      </div>
                    )}
                  </div>

                  {walletData.transactions && walletData.transactions.length > 0 && (
                    <div>
                      <h3 className="font-bold mb-4">Transaction History</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {walletData.transactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell>
                                <Badge className={tx.type === "credit" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                  {tx.type}
                                </Badge>
                              </TableCell>
                              <TableCell>{tx.description || "N/A"}</TableCell>
                              <TableCell className="text-right">₦{parseFloat(tx.amount).toLocaleString()}</TableCell>
                              <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Referral Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              {referralLoading ? (
                <div className="text-center py-8 text-slate-500">Loading referral data...</div>
              ) : !referralData?.referralCode ? (
                <div className="text-center py-8 text-slate-500">No referral code found</div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-500">Referral Code</p>
                      <p className="text-2xl font-bold font-mono">{referralData.referralCode.code}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-500">Total Referrals</p>
                      <p className="text-2xl font-bold">{referralData.referrals.length}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-500">Total Bonuses Earned</p>
                      <p className="text-2xl font-bold">₦{referralData.totalBonus.toLocaleString()}</p>
                    </div>
                  </div>

                  {referralData.referralTransactions && referralData.referralTransactions.length > 0 && (
                    <div>
                      <h3 className="font-bold mb-4">Referral Bonus History</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {referralData.referralTransactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell>{tx.description || "Referral bonus"}</TableCell>
                              <TableCell className="text-right">₦{parseFloat(tx.amount).toLocaleString()}</TableCell>
                              <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === "credit" ? "Credit" : "Debit"} Wallet
            </DialogTitle>
            <DialogDescription>
              Current balance: ₦{walletData?.wallet ? parseFloat(walletData.wallet.balance).toLocaleString() : "0"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for adjustment..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustmentSubmit} disabled={adjustMutation.isPending}>
              {adjustMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
