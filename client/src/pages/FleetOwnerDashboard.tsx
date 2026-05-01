import { useFleetOwnerAuth } from "@/hooks/useFleetOwnerAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bike, Users, DollarSign, Clock } from "lucide-react";
import { Link } from "wouter";

/**
 * Fleet Owner Dashboard - Overview Page
 * Shows key metrics: earnings, payouts, bikes, riders
 */
export default function FleetOwnerDashboard() {
  const { loading: authLoading, isApproved } = useFleetOwnerAuth();
  const { data: stats, isLoading: statsLoading } = trpc.fleetOwner.getDashboardStats.useQuery(
    undefined,
    { enabled: isApproved === true }
  );

  const loading = authLoading || statsLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Fleet Owner Dashboard</h1>
              <p className="text-sm text-muted-foreground">View your fleet and track earnings</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Earnings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{stats?.totalEarnings || "0.00"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All-time earnings from deliveries
              </p>
            </CardContent>
          </Card>

          {/* Pending Payouts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{stats?.pendingPayouts || "0.00"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Next payout on Friday
              </p>
            </CardContent>
          </Card>

          {/* Total Bikes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bikes</CardTitle>
              <Bike className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalBikes || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active bikes in your fleet
              </p>
            </CardContent>
          </Card>

          {/* Total Riders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Riders</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalRiders || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active riders in your fleet
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bike Status Widget */}
        {stats?.bikeStatusCounts && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bike className="w-5 h-5" />
                Bike Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">Available</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.bikeStatusCounts.available}</div>
                </div>
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium">In Transit</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.bikeStatusCounts.in_transit}</div>
                </div>
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm font-medium">Maintenance</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.bikeStatusCounts.maintenance}</div>
                </div>
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                    <span className="text-sm font-medium">Inactive</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.bikeStatusCounts.inactive}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/fleet-owner/fleet">
                <Button variant="outline" className="w-full">
                  <Bike className="w-4 h-4 mr-2" />
                  Manage Fleet
                </Button>
              </Link>
              <Link href="/fleet-owner/earnings">
                <Button variant="outline" className="w-full">
                  <DollarSign className="w-4 h-4 mr-2" />
                  View Earnings
                </Button>
              </Link>
              <Link href="/fleet-owner/payouts">
                <Button variant="outline" className="w-full">
                  <Clock className="w-4 h-4 mr-2" />
                  Payout History
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Earning Model</h3>
                <p className="text-sm text-muted-foreground">
                  You earn the <strong>full trip revenue</strong> minus Apiamway's commission for fleet management, 
                  dispatch, tracking, and payment processing. Earnings accumulate in your wallet.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Weekly Payouts</h3>
                <p className="text-sm text-muted-foreground">
                  Payouts are processed every <strong>Friday</strong>. All pending earnings from completed deliveries 
                  will be credited to your wallet on the next payout date.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Fleet Management</h3>
                <p className="text-sm text-muted-foreground">
                  Add your bikes and riders to start receiving delivery assignments. Assign riders to bikes 
                  to optimize dispatch and tracking.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
