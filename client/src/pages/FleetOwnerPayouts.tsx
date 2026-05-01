import { useFleetOwnerAuth } from "@/hooks/useFleetOwnerAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowLeft, Calendar } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

/**
 * Fleet Owner Payouts Page
 * View payout history and status
 */
export default function FleetOwnerPayouts() {
  const { loading: authLoading } = useFleetOwnerAuth();
  const { data, isLoading: payoutsLoading } = trpc.fleetOwner.getPayouts.useQuery();

  const loading = authLoading || payoutsLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading payouts...</p>
        </div>
      </div>
    );
  }

  const payouts = data?.payouts || [];
  const totalPaidOut = payouts.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/fleet-owner/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Payout History</h1>
                <p className="text-sm text-muted-foreground">Track your weekly payouts</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Summary Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₦{totalPaidOut.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {payouts.length} payouts
            </p>
          </CardContent>
        </Card>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-semibold text-sm">Payout Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Orders Included</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout, index) => (
                      <tr
                        key={`${payout.payoutDate}-${index}`}
                        className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(payout.payoutDate), "MMM dd, yyyy")}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold">
                          ₦{payout.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {payout.orderCount} orders
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Paid
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No payouts yet</p>
                <p className="text-sm text-muted-foreground">
                  Your first payout will be processed on the next Friday after you earn from deliveries
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Payout Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>Payout Schedule:</strong> Payouts are processed every Friday at noon. All pending 
                earnings from completed deliveries will be credited to your wallet.
              </p>
              <p>
                <strong>Payout Status:</strong> Once a payout is processed, it appears here with a "Paid" status. 
                The amount is credited to your wallet and can be withdrawn.
              </p>
              <p>
                <strong>Order Details:</strong> Each payout includes earnings from multiple orders completed 
                during the week. View individual order earnings on the Earnings page.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
