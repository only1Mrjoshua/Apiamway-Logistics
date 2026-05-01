import { useFleetOwnerAuth } from "@/hooks/useFleetOwnerAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bike, Users, Plus, ArrowLeft, Wrench } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Fleet Owner Fleet Management Page
 * Manage bikes and riders
 */
export default function FleetOwnerFleet() {
  const { loading: authLoading } = useFleetOwnerAuth();
  const { data: fleet, isLoading: fleetLoading } = trpc.fleetOwner.getFleet.useQuery();
  const [bikeStatusFilter, setBikeStatusFilter] = useState<string>("all");

  const loading = authLoading || fleetLoading;

  // Filter bikes by status
  const filteredBikes = fleet?.bikes.filter(bike => {
    if (bikeStatusFilter === "all") return true;
    return bike.status === bikeStatusFilter;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading fleet...</p>
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
            <div className="flex items-center gap-4">
              <Link href="/fleet-owner/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Fleet Management</h1>
                <p className="text-sm text-muted-foreground">Manage your bikes and riders</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Bikes Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bike className="w-5 h-5" />
                Bikes ({fleet?.bikes.length || 0})
              </CardTitle>
              <Select value={bikeStatusFilter} onValueChange={setBikeStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bikes</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredBikes.length > 0 ? (
              <div className="space-y-4">
                {filteredBikes.map((bike) => (
                  <div
                    key={bike.id}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-semibold">{bike.name}</div>
                        {bike.label && (
                          <Badge variant="outline" className="text-xs">
                            {bike.label}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Traccar ID: {bike.traccarDeviceId}
                      </div>
                      <Badge className={
                        bike.status === "available" ? "bg-green-100 text-green-800" :
                        bike.status === "in_transit" ? "bg-blue-100 text-blue-800" :
                        bike.status === "maintenance" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }>
                        {bike.status === "available" ? "Available" :
                         bike.status === "in_transit" ? "In Transit" :
                         bike.status === "maintenance" ? "Maintenance" :
                         "Inactive"}
                      </Badge>
                      
                      {/* Maintenance Info (Read-only) */}
                      {bike.status === "maintenance" && bike.maintenanceReason && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs mt-2">
                                <Wrench className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-yellow-900 truncate">{bike.maintenanceReason}</p>
                                  {bike.maintenanceUntil && (
                                    <p className="text-yellow-700 mt-1">
                                      Expected: {new Date(bike.maintenanceUntil).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{bike.maintenanceReason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bike className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                {fleet?.bikes && fleet.bikes.length > 0 ? (
                  <>
                    <p className="text-muted-foreground mb-4">No bikes match the selected filter</p>
                    <Button variant="outline" onClick={() => setBikeStatusFilter("all")}>
                      Show All Bikes
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-4">No bikes in your fleet yet</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Contact admin to assign bikes to your fleet
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Riders Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Riders ({fleet?.riders.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fleet?.riders && fleet.riders.length > 0 ? (
              <div className="space-y-4">
                {fleet.riders.map((rider) => (
                  <div
                    key={rider.id}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg"
                  >
                    <div>
                      <div className="font-semibold">{rider.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Phone: {rider.phone || "Not provided"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Status: {rider.status || "active"}
                      </div>
                      {rider.partnerCompanyId && (
                        <Badge variant="outline" className="mt-2">
                          Assigned to Fleet Owner
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No riders in your fleet yet</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Contact admin to assign riders to your fleet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Fleet Management Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>Note:</strong> Fleet management (adding/editing/removing bikes and riders) is currently 
                handled by the admin panel. Contact Apiamway support to add or modify your fleet.
              </p>
              <p>
                Once your bikes and riders are assigned, they will appear here and start receiving delivery assignments.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
