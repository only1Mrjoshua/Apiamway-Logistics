import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Clock, CheckCircle2, XCircle, AlertCircle, Truck } from "lucide-react";
import { Link } from "wouter";

/**
 * Fleet Owner application status page
 * Shows current status of Fleet Owner application
 */
export default function FleetOwnerStatus() {
  const { data: status, isLoading } = trpc.fleetOwner.getApplicationStatus.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading application status...</p>
        </div>
      </div>
    );
  }

  if (!status?.hasApplication) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Application Found</CardTitle>
            <CardDescription>
              You haven't submitted a Fleet Owner application yet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              To become a Fleet Owner and earn from deliveries, you need to submit an application first.
            </p>
            <Link href="/fleet-owner/onboarding">
              <Button className="w-full rounded-none">
                Submit Application
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { application } = status;
  
  if (!application) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Application Found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }
  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
      borderColor: "border-yellow-200 dark:border-yellow-900",
      title: "Application Under Review",
      description: "We're reviewing your application. You'll hear from us within 2-3 business days.",
    },
    approved: {
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      borderColor: "border-green-200 dark:border-green-900",
      title: "Application Approved!",
      description: "Congratulations! You can now add your bikes and riders to start earning.",
    },
    rejected: {
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      borderColor: "border-red-200 dark:border-red-900",
      title: "Application Rejected",
      description: "Unfortunately, we couldn't approve your application at this time.",
    },
    suspended: {
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      borderColor: "border-orange-200 dark:border-orange-900",
      title: "Account Suspended",
      description: "Your Fleet Owner account has been suspended. Please contact support.",
    },
  };

  const config = statusConfig[application.status];
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="container max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold mb-2">Fleet Owner Application</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Track the status of your application
          </p>
        </div>

        {/* Status Card */}
        <Card className={`border-2 ${config.borderColor} ${config.bgColor} mb-6`}>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full ${config.bgColor} flex items-center justify-center`}>
                <StatusIcon className={`w-6 h-6 ${config.color}`} />
              </div>
              <div>
                <CardTitle className={config.color}>{config.title}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Application Details */}
        <Card>
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Company Name</p>
                <p className="font-medium">{application.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Contact Name</p>
                <p className="font-medium">{application.contactName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Status</p>
                <p className="font-medium capitalize">{application.status}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Submitted On</p>
                <p className="font-medium">
                  {new Date(application.createdAt).toLocaleDateString()}
                </p>
              </div>
              {application.approvedAt && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Approved On</p>
                  <p className="font-medium">
                    {new Date(application.approvedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t space-y-3">
              {application.status === "pending" && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">While you wait...</p>
                  <p>You can still send packages as a regular shipper. Your Fleet Owner features will be unlocked once approved.</p>
                </div>
              )}

              {application.status === "approved" && (
                <Link href="/admin/partners">
                  <Button className="w-full rounded-none">
                    Go to Fleet Dashboard
                  </Button>
                </Link>
              )}

              <Link href="/request-delivery">
                <Button variant="outline" className="w-full rounded-none">
                  Send a Package
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-500">
            Questions about your application?{" "}
            <Link href="/contact">
              <a className="text-primary hover:underline">Contact Support</a>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
