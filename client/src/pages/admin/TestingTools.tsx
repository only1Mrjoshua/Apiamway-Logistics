import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Testing Tools Page (STAGING ONLY)
 * Manual triggers for testing settlement and payout flows
 */
export default function TestingTools() {
  const [orderIdentifier, setOrderIdentifier] = useState("");
  const [resolvedOrderId, setResolvedOrderId] = useState<number | null>(null);
  const [settlementResult, setSettlementResult] = useState<string | null>(null);
  const [payoutResult, setPayoutResult] = useState<string | null>(null);
  const [opayVerifyRef, setOpayVerifyRef] = useState("");
  const [opayVerifyResult, setOpayVerifyResult] = useState<string | null>(null);

  const triggerSettlement = trpc.partners.triggerSettlement.useMutation({
    onSuccess: (data) => {
      setSettlementResult(JSON.stringify(data, null, 2));
      // Extract resolved orderId from response if available
      if (data && typeof data === 'object' && 'orderId' in data) {
        setResolvedOrderId(data.orderId as number);
      }
    },
    onError: (error) => {
      setSettlementResult(`Error: ${error.message}`);
    },
  });

  const processWeeklyPayouts = trpc.partners.processWeeklyPayouts.useMutation({
    onSuccess: (data) => {
      setPayoutResult(JSON.stringify(data, null, 2));
    },
    onError: (error) => {
      setPayoutResult(`Error: ${error.message}`);
    },
  });

  const handleTriggerSettlement = () => {
    if (!orderIdentifier) {
      alert("Please enter an Order ID or Tracking Number");
      return;
    }
    setSettlementResult(null);
    setResolvedOrderId(null);
    
    // Check if input is a number (orderId) or string (trackingNumber)
    const isNumeric = /^\d+$/.test(orderIdentifier);
    
    if (isNumeric) {
      triggerSettlement.mutate({ orderId: parseInt(orderIdentifier) });
    } else {
      triggerSettlement.mutate({ trackingNumber: orderIdentifier });
    }
  };

  // OPay health check (admin)
  const { data: opayHealth, isLoading: opayHealthLoading, refetch: refetchOpayHealth } =
    trpc.payments.opayHealth.useQuery(undefined, { enabled: false });

  // OPay manual verify
  const verifyOpayAdmin = trpc.payments.verifyOpay.useMutation({
    onSuccess: (data: any) => {
      setOpayVerifyResult(JSON.stringify(data, null, 2));
    },
    onError: (error: any) => {
      setOpayVerifyResult(`Error: ${error.message}`);
    },
  });

  const handleProcessPayouts = () => {
    setPayoutResult(null);
    processWeeklyPayouts.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Testing Tools</h1>
        <p className="text-muted-foreground mt-2">
          Manual triggers for testing settlement and payout flows. <strong>STAGING ONLY.</strong>
        </p>
      </div>

      {/* Manual Settlement Trigger */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Settlement Trigger</CardTitle>
          <CardDescription>
            Manually trigger settlement for a delivered order. This will calculate Fleet Owner earnings
            and credit their wallet (if applicable).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orderIdentifier">Order ID or Tracking Number</Label>
            <Input
              id="orderIdentifier"
              type="text"
              placeholder="Enter order ID (e.g., 123) or tracking number (e.g., AP-EN-8492)"
              value={orderIdentifier}
              onChange={(e) => setOrderIdentifier(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              You can enter either a numeric order ID or an alphanumeric tracking number.
            </p>
          </div>
          {resolvedOrderId && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Resolved Order ID:</strong> {resolvedOrderId}
              </p>
            </div>
          )}
          <Button
            onClick={handleTriggerSettlement}
            disabled={triggerSettlement.isPending}
          >
            {triggerSettlement.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Trigger Settlement
          </Button>

          {settlementResult && (
            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg border">
              <div className="flex items-start gap-2 mb-2">
                {settlementResult.startsWith("Error") ? (
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold mb-2">Settlement Result:</p>
                  <pre className="text-xs overflow-auto whitespace-pre-wrap">
                    {settlementResult}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Payout Trigger */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Payout Trigger</CardTitle>
          <CardDescription>
            Manually trigger weekly payout processing. This will aggregate all pending earnings
            for all Fleet Owners and mark them as credited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> This will process payouts for ALL Fleet Owners with pending earnings.
              Use with caution.
            </p>
          </div>
          <Button
            onClick={handleProcessPayouts}
            disabled={processWeeklyPayouts.isPending}
            variant="default"
          >
            {processWeeklyPayouts.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Process Weekly Payouts
          </Button>

          {payoutResult && (
            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg border">
              <div className="flex items-start gap-2 mb-2">
                {payoutResult.startsWith("Error") ? (
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold mb-2">Payout Result:</p>
                  <pre className="text-xs overflow-auto whitespace-pre-wrap">
                    {payoutResult}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OPay Payment Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            OPay Payment Tools
          </CardTitle>
          <CardDescription>
            Check OPay connectivity and manually verify a payment reference.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Health check */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">OPay Health Check</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchOpayHealth()}
              disabled={opayHealthLoading}
            >
              {opayHealthLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4 mr-2" />
              )}
              Check OPay Status
            </Button>
            {opayHealth && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Configured:</span>
                  <Badge variant={opayHealth.configured ? "default" : "secondary"}>
                    {opayHealth.configured ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Connected:</span>
                  {opayHealth.connected ? (
                    <span className="flex items-center gap-1 text-green-600"><Wifi className="w-3 h-3" /> Yes</span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-500"><WifiOff className="w-3 h-3" /> No</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Mode:</span>
                  <Badge variant={opayHealth.mode === "production" ? "destructive" : "secondary"}>
                    {opayHealth.mode}
                  </Badge>
                </div>
                {opayHealth.error && (
                  <p className="text-xs text-red-500 mt-1">{opayHealth.error}</p>
                )}
              </div>
            )}
          </div>

          {/* Manual OPay verify */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Manual OPay Reference Verify</p>
            <p className="text-xs text-muted-foreground">
              Enter an OPay payment reference (OPY-…) to manually verify its status and credit the wallet if successful.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="OPY-XXXXXXXX-XXXXXXXX"
                value={opayVerifyRef}
                onChange={(e) => setOpayVerifyRef(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!opayVerifyRef.trim()) return;
                  setOpayVerifyResult(null);
                  verifyOpayAdmin.mutate({ reference: opayVerifyRef.trim() });
                }}
                disabled={verifyOpayAdmin.isPending || !opayVerifyRef.trim()}
              >
                {verifyOpayAdmin.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
            {opayVerifyResult && (
              <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-lg border">
                <div className="flex items-start gap-2">
                  {opayVerifyResult.startsWith("Error") ? (
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  )}
                  <pre className="text-xs overflow-auto whitespace-pre-wrap flex-1">{opayVerifyResult}</pre>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-2">Manual Settlement Trigger:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create an order and assign it to a Fleet Owner's rider</li>
              <li>Mark the order as DELIVERED</li>
              <li>Enter the Order ID or Tracking Number above and click "Trigger Settlement"</li>
              <li>Check the Fleet Owner's earnings ledger to verify the credit</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-2">Weekly Payout Trigger:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ensure there are Fleet Owners with pending earnings</li>
              <li>Click "Process Weekly Payouts"</li>
              <li>Check Fleet Owner wallets to verify credits</li>
              <li>Check payout history on Fleet Owner dashboard</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
