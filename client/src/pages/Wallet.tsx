import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  AlertCircle,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Provider = "paystack" | "opay";

export default function Wallet() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Top-up dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider>("paystack");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: balance, isLoading: balanceLoading } = trpc.wallet.get.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: transactions, isLoading: transactionsLoading } = trpc.wallet.transactions.useQuery(
    { limit: 20 },
    { enabled: isAuthenticated }
  );

  // Check if OPay is configured (public query — no auth required)
  const { data: opayStatus } = trpc.payments.opayStatus.useQuery();

  // Paystack top-up mutation
  const initializePaystackTopup = trpc.payments.initializeTopup.useMutation({
    onSuccess: (data: any) => {
      window.location.href = data.authorizationUrl;
    },
    onError: (error: any) => {
      toast.error(`Failed to initialize payment: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const utils = trpc.useUtils();

  // OPay verify mutation — called automatically when user returns from OPay hosted checkout
  const verifyOpay = trpc.payments.verifyOpay.useMutation({
    onSuccess: () => {
      toast.success("OPay payment verified — wallet credited!");
      utils.wallet.get.invalidate();
      utils.wallet.transactions.invalidate();
      // Remove the reference from the URL without a full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("reference");
      url.searchParams.delete("status");
      window.history.replaceState({}, "", url.toString());
    },
    onError: (error: any) => {
      toast.error(`OPay payment could not be verified: ${error.message}`);
    },
  });

  // OPay top-up mutation
  const initializeOpayTopup = trpc.payments.initializeOpayTopup.useMutation({
    onSuccess: (data: any) => {
      window.location.href = data.cashierUrl;
    },
    onError: (error: any) => {
      toast.error(`Failed to initialize OPay payment: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const handleOpenTopup = () => {
    setAmount("");
    setSelectedProvider("paystack");
    setDialogOpen(true);
  };

  const handleConfirmTopup = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 100) {
      toast.error("Please enter a valid amount (minimum ₦100)");
      return;
    }
    if (parsed > 1_000_000) {
      toast.error("Maximum top-up is ₦1,000,000");
      return;
    }

    setIsProcessing(true);
    const callbackUrl = `${window.location.origin}/wallet`;

    if (selectedProvider === "opay") {
      if (!opayStatus?.configured) {
        toast.error("OPay is not configured yet. Please use Paystack.");
        setIsProcessing(false);
        return;
      }
      initializeOpayTopup.mutate({ amount: parsed, callbackUrl });
    } else {
      initializePaystackTopup.mutate({ amount: parsed, callbackUrl });
    }
  };

  // Handle OPay return redirect: /wallet?reference=OPY-…
  // OPay appends ?reference=<ref>&status=SUCCESS to the callbackUrl after payment
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (reference && reference.startsWith("OPY-")) {
      verifyOpay.mutate({ reference });
    }
  // verifyOpay is stable across renders; only re-run when auth state resolves
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  if (!authLoading && !isAuthenticated) return null;

  if (authLoading || balanceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => setLocation("/")} className="mb-4">
            ← Back to Home
          </Button>
          <h1 className="text-3xl font-display font-bold mb-2">My Wallet</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your wallet balance and view transaction history
          </p>
        </div>

        {/* Balance Card */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="w-5 h-5" />
              Wallet Balance
            </CardTitle>
            <CardDescription>Available funds for deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-display font-bold text-primary">
                  ₦{(parseFloat(balance?.balance || "0") / 100).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Last updated: {new Date().toLocaleString()}
                </p>
              </div>
              <Button
                onClick={handleOpenTopup}
                className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Top Up
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your recent wallet transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.type === "credit"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                            : "bg-red-100 dark:bg-red-900/30 text-red-600"
                        }`}
                      >
                        {tx.type === "credit" ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{tx.description}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(tx.createdAt).toLocaleString("en-NG", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                        {tx.referenceId && (
                          <p className="text-xs text-slate-400 font-mono">
                            Ref: {tx.referenceId}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          tx.type === "credit" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {tx.type === "credit" ? "+" : "-"}₦
                        {(tx.amount / 100).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-xs text-slate-500">
                        Balance: ₦
                        {(tx.balanceAfter / 100).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No transactions yet</p>
                <p className="text-sm text-slate-400 mt-2">Top up your wallet to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Top-up Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Top Up Wallet</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Amount input */}
            <div className="space-y-2">
              <Label htmlFor="topup-amount">Amount (₦)</Label>
              <Input
                id="topup-amount"
                type="number"
                placeholder="e.g. 5000"
                min={100}
                max={1000000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isProcessing}
              />
              <p className="text-xs text-slate-500">Minimum ₦100 · Maximum ₦1,000,000</p>
            </div>

            {/* Provider selector */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Paystack option */}
                <button
                  type="button"
                  onClick={() => setSelectedProvider("paystack")}
                  disabled={isProcessing}
                  className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-all ${
                    selectedProvider === "paystack"
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  <CreditCard className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">Paystack</span>
                  <span className="text-xs text-slate-500">Card / Bank Transfer</span>
                </button>

                {/* OPay option */}
                <button
                  type="button"
                  onClick={() => {
                    if (!opayStatus?.configured) return; // prevent selecting if unconfigured
                    setSelectedProvider("opay");
                  }}
                  disabled={isProcessing || !opayStatus?.configured}
                  className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-all relative ${
                    !opayStatus?.configured
                      ? "border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed"
                      : selectedProvider === "opay"
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Smartphone className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">OPay</span>
                  {opayStatus?.configured ? (
                    <span className="text-xs text-slate-500">Bank Transfer</span>
                  ) : (
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      Not configured
                    </Badge>
                  )}
                </button>
              </div>

              {/* Fallback notice when OPay is unconfigured */}
              {!opayStatus?.configured && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  OPay is not configured yet. Please use Paystack to top up.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmTopup}
              disabled={isProcessing || !amount || parseFloat(amount) < 100}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting…
                </>
              ) : (
                `Pay with ${selectedProvider === "opay" ? "OPay" : "Paystack"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
