import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Truck, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";


/**
 * Fleet Owner onboarding form
 * Collects additional information and creates Fleet Owner application
 */
export default function FleetOwnerOnboarding() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: applicationStatus, isLoading: statusLoading } = trpc.fleetOwner.getApplicationStatus.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Route guards
  useEffect(() => {
    if (authLoading) return;

    // Guard 1: Not logged in → redirect to OAuth
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    // Wait for status query to complete
    if (statusLoading) return;

    // Guard 2: Already approved Fleet Owner → redirect to dashboard
    if (applicationStatus?.status === "approved") {
      setLocation("/fleet-owner/dashboard");
      return;
    }

    // Guard 3: Pending approval → redirect to status page
    if (applicationStatus?.status === "pending") {
      setLocation("/fleet-owner/status");
      return;
    }
  }, [authLoading, isAuthenticated, statusLoading, applicationStatus, setLocation]);

  // Show loading while checking auth or status
  if (authLoading || !isAuthenticated || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show loading if redirecting
  if (applicationStatus?.status === "approved" || applicationStatus?.status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  
  const [formData, setFormData] = useState({
    companyType: "individual" as "individual" | "company",
    companyName: "",
    address: "",
    operatingCities: "",
    estimatedBikes: "",
    contactPerson: "",
  });

  const submitOnboarding = trpc.fleetOwner.submitOnboarding.useMutation({
    onSuccess: () => {
      alert("Application submitted successfully! We'll review it and get back to you soon.");
      setLocation("/fleet-owner/status");
    },
    onError: (error) => {
      alert(`Submission failed: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.address || !formData.operatingCities || !formData.estimatedBikes) {
      alert("Please fill in all required fields");
      return;
    }

    if (formData.companyType === "company" && !formData.companyName) {
      alert("Company name is required for company type");
      return;
    }

    const estimatedBikes = parseInt(formData.estimatedBikes);
    if (isNaN(estimatedBikes) || estimatedBikes < 1) {
      alert("Estimated bikes must be at least 1");
      return;
    }

    submitOnboarding.mutate({
      companyType: formData.companyType,
      companyName: formData.companyType === "company" ? formData.companyName : undefined,
      address: formData.address,
      operatingCities: formData.operatingCities,
      estimatedBikes,
      contactPerson: formData.contactPerson || undefined,
    });
  };

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
            Tell us about your fleet. We'll review your application and get back to you within 2-3 business days.
          </p>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Fleet Information</CardTitle>
            <CardDescription>
              Provide details about your delivery fleet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Type */}
              <div className="space-y-3">
                <Label>Business Type *</Label>
                <RadioGroup
                  value={formData.companyType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, companyType: value as "individual" | "company" })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="individual" id="individual" />
                    <Label htmlFor="individual" className="font-normal cursor-pointer">
                      Individual
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="company" id="company" />
                    <Label htmlFor="company" className="font-normal cursor-pointer">
                      Company
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Company Name (conditional) */}
              {formData.companyType === "company" && (
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g., Swift Logistics Ltd"
                    required
                  />
                </div>
              )}

              {/* Contact Person */}
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="Full name of primary contact"
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Business Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full business address"
                  rows={3}
                  required
                />
              </div>

              {/* Operating Cities */}
              <div className="space-y-2">
                <Label htmlFor="operatingCities">Operating Cities *</Label>
                <Input
                  id="operatingCities"
                  value={formData.operatingCities}
                  onChange={(e) => setFormData({ ...formData, operatingCities: e.target.value })}
                  placeholder="e.g., Enugu, Lagos, Abuja"
                  required
                />
                <p className="text-xs text-slate-500">Separate multiple cities with commas</p>
              </div>

              {/* Estimated Bikes */}
              <div className="space-y-2">
                <Label htmlFor="estimatedBikes">Estimated Number of Bikes *</Label>
                <Input
                  id="estimatedBikes"
                  type="number"
                  min="1"
                  value={formData.estimatedBikes}
                  onChange={(e) => setFormData({ ...formData, estimatedBikes: e.target.value })}
                  placeholder="e.g., 5"
                  required
                />
              </div>

              {/* Info Box */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">What happens next?</p>
                    <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                      <li>• Our team will review your application</li>
                      <li>• You'll receive an email within 2-3 business days</li>
                      <li>• You can still send packages while pending approval</li>
                      <li>• Once approved, you can add your bikes and riders</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 text-base rounded-none"
                disabled={submitOnboarding.isPending}
              >
                {submitOnboarding.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-500">
            Need help? Contact us at{" "}
            <a href="mailto:support@apiamway.com" className="text-primary hover:underline">
              support@apiamway.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
