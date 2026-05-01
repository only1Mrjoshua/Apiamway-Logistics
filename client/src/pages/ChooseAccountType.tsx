import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Package, Truck, Check } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

/**
 * Fallback page for users who logged in without signup_intent cookie
 * (e.g., incognito mode, cleared cookies, direct OAuth login)
 */
export default function ChooseAccountType() {
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setAccountTypeIntent = trpc.fleetOwner.setAccountTypeIntent.useMutation();

  const handleSelection = async (intent: "shipper" | "fleet_owner") => {
    setIsSubmitting(true);
    
    try {
      await setAccountTypeIntent.mutateAsync({ intent });
      
      // Redirect based on selection
      if (intent === "shipper") {
        setLocation("/request-delivery");
      } else {
        setLocation("/fleet-owner/onboarding");
      }
    } catch (error) {
      console.error("Failed to set account type:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4 text-slate-900 dark:text-white">
            Welcome to Apiamway!
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Tell us how you plan to use Apiamway
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Shipper Card */}
          <Card className="border-2 hover:border-primary/50 transition-all cursor-pointer">
            <CardHeader>
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                <Package className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-xl">I want to send packages</CardTitle>
              <CardDescription>
                Request deliveries and track shipments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  <span>Instant delivery requests</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  <span>Real-time tracking</span>
                </li>
              </ul>
              
              <Button 
                className="w-full rounded-none"
                onClick={() => handleSelection("shipper")}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Setting up..." : "Continue as Shipper"}
              </Button>
            </CardContent>
          </Card>

          {/* Fleet Owner Card */}
          <Card className="border-2 hover:border-primary/50 transition-all cursor-pointer">
            <CardHeader>
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                <Truck className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-xl">I want to add my fleet</CardTitle>
              <CardDescription>
                Earn by providing bikes and riders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  <span>Weekly payouts</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary" />
                  <span>Full dispatch support</span>
                </li>
              </ul>
              
              <Button 
                className="w-full rounded-none bg-slate-900 hover:bg-slate-800"
                onClick={() => handleSelection("fleet_owner")}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Setting up..." : "Continue as Fleet Owner"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Note */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            You can change this later in your account settings
          </p>
        </div>
      </div>
    </div>
  );
}
