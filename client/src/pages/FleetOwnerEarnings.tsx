import { useFleetOwnerAuth } from "@/hooks/useFleetOwnerAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ArrowLeft, Calendar } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

/**
 * Fleet Owner Earnings Page
 * View earnings history with order references
 */
export default function FleetOwnerEarnings() {
  const { loading: authLoading } = useFleetOwnerAuth();
  const { data, isLoading: earningsLoading } = trpc.fleetOwner.getEarnings.useQuery();

  const loading = authLoading || earningsLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading earnings...</p>
        </div>
      </div>
    );
  }

  const earnings = data?.earnings || [];
  const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.partnerAmount), 0);
  const pendingEarnings = earnings.filter(e => e.status === "pending").reduce((sum, e) => sum + parseFloat(e.partnerAmount), 0);

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
                <h1 className="text-2xl font-bold">Earnings</h1>
                <p className="text-sm text-muted-foreground">Track your delivery earnings</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₦{totalEarnings.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All-time earnings from {earnings.length} deliveries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₦{pendingEarnings.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Will be paid out on next Friday
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Earnings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings History</CardTitle>
          </CardHeader>
          <CardContent>
            {earnings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Order ID</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Order Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Your Earnings</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((earning) => (
                      <tr
                        key={earning.id}
                        className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(earning.createdAt), "MMM dd, yyyy")}
                        </td>
                        <td className="py-3 px-4 text-sm font-mono">
                          <Link href={`/admin/orders/${earning.orderId}`}>
                            <span className="text-primary hover:underline">
                              #{earning.orderId}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          ₦{parseFloat(earning.orderPrice).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold">
                          ₦{parseFloat(earning.partnerAmount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {earning.status === "pending" && (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              Pending
                            </Badge>
                          )}
                          {earning.status === "credited" && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Paid Out
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No earnings yet</p>
                <p className="text-sm text-muted-foreground">
                  Earnings will appear here once your riders complete deliveries
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Earnings Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>Earning Model:</strong> You earn the full trip revenue minus Apiamway's commission 
                for fleet management, dispatch, tracking, and payment processing.
              </p>
              <p>
                <strong>Payout Schedule:</strong> Earnings marked as "Pending" will be paid out every Friday. 
                Once paid, the status changes to "Paid Out".
              </p>
              <p>
                <strong>Order References:</strong> Click on an Order ID to view the full delivery details.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
