import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, ArrowRight, Check } from "lucide-react";
import Cookies from "js-cookie";

/**
 * Pre-auth role selection page
 * User chooses to sign up as Shipper or Fleet Owner before OAuth login
 */
export default function GetStarted() {
  const handleRoleSelection = (role: "shipper" | "fleet_owner") => {
    // Store signup intent in cookie (7 days expiry)
    Cookies.set("signup_intent", role, { expires: 7 });
    
    // Redirect to Manus OAuth login
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="container max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 text-slate-900 dark:text-white">
            Get Started with Apiamway
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Choose how you want to use Apiamway. You can always change this later.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Shipper Card */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all hover:shadow-xl cursor-pointer group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500"></div>
            <CardHeader className="relative z-10">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Package className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl font-display">I'm a Shipper</CardTitle>
              <CardDescription className="text-base">
                Send packages and track deliveries across Nigeria
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 space-y-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Request deliveries instantly
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Real-time tracking for all shipments
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Flexible payment options
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Earn referral bonuses
                  </span>
                </li>
              </ul>

              <Button 
                className="w-full h-12 text-base rounded-none"
                onClick={() => handleRoleSelection("shipper")}
              >
                Continue as Shipper
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <p className="text-xs text-center text-slate-500">
                Perfect for individuals and businesses sending packages
              </p>
            </CardContent>
          </Card>

          {/* Fleet Owner Card */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all hover:shadow-xl cursor-pointer group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500"></div>
            <CardHeader className="relative z-10">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Truck className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl font-display">I'm a Fleet Owner</CardTitle>
              <CardDescription className="text-base">
                Add your bikes and riders to earn from deliveries
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 space-y-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Earn by adding your fleet to Apiamway
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Weekly payouts every Friday
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Earnings accumulate in your wallet
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Full dispatch and tracking support
                  </span>
                </li>
              </ul>

              <Button 
                className="w-full h-12 text-base rounded-none bg-slate-900 hover:bg-slate-800 text-white"
                onClick={() => handleRoleSelection("fleet_owner")}
              >
                Continue as Fleet Owner
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <p className="text-xs text-center text-slate-500">
                Requires approval - you can still send packages while pending
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <a 
              href="/login" 
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
