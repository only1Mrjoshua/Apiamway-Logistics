import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MapView } from "@/components/Map";
import { ArrowRight, Box, CheckCircle2, Clock, MapPin, ShieldCheck, Truck, User, Zap, AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

// Types for form steps
type Step = "route" | "package" | "service" | "review" | "success";

// Validation error type
interface ValidationErrors {
  pickup: {
    address?: string;
    name?: string;
    phone?: string;
  };
  dropoff: {
    address?: string;
    name?: string;
    phone?: string;
  };
}

const FORM_STORAGE_KEY = "request_delivery_draft";
const FORM_EXPIRY_HOURS = 2;

export default function RequestDelivery() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<Step>("route");
  const [formData, setFormData] = useState({
    pickup: { address: "", name: "", phone: "" },
    dropoff: { address: "", name: "", phone: "" },
    package: { description: "", weight: "0-2kg", value: "", fragile: false },
    service: "standard"
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [submittedPrice, setSubmittedPrice] = useState<number | null>(null);
  
  // Track which fields have been touched (for showing errors)
  const [touched, setTouched] = useState({
    pickup: { address: false, name: false, phone: false },
    dropoff: { address: false, name: false, phone: false }
  });
  
  // Track if user tried to proceed without valid data
  const [attemptedNext, setAttemptedNext] = useState(false);

  // Validation logic
  const validatePhone = (phone: string): boolean => {
    // Nigerian phone number: 11 digits starting with 0, or 13 digits starting with +234
    const cleaned = phone.replace(/\s/g, '');
    return /^0[789][01]\d{8}$/.test(cleaned) || /^\+234[789][01]\d{8}$/.test(cleaned) || cleaned.length >= 10;
  };

  const errors = useMemo<ValidationErrors>(() => {
    const errs: ValidationErrors = { pickup: {}, dropoff: {} };
    
    // Pickup validation
    if (!formData.pickup.address.trim()) {
      errs.pickup.address = "Pickup address is required";
    } else if (formData.pickup.address.trim().length < 5) {
      errs.pickup.address = "Please enter a valid address";
    }
    
    if (!formData.pickup.name.trim()) {
      errs.pickup.name = "Sender name is required";
    } else if (formData.pickup.name.trim().length < 2) {
      errs.pickup.name = "Name must be at least 2 characters";
    }
    
    if (!formData.pickup.phone.trim()) {
      errs.pickup.phone = "Sender phone is required";
    } else if (!validatePhone(formData.pickup.phone)) {
      errs.pickup.phone = "Please enter a valid phone number";
    }
    
    // Dropoff validation
    if (!formData.dropoff.address.trim()) {
      errs.dropoff.address = "Drop-off address is required";
    } else if (formData.dropoff.address.trim().length < 5) {
      errs.dropoff.address = "Please enter a valid address";
    }
    
    if (!formData.dropoff.name.trim()) {
      errs.dropoff.name = "Recipient name is required";
    } else if (formData.dropoff.name.trim().length < 2) {
      errs.dropoff.name = "Name must be at least 2 characters";
    }
    
    if (!formData.dropoff.phone.trim()) {
      errs.dropoff.phone = "Recipient phone is required";
    } else if (!validatePhone(formData.dropoff.phone)) {
      errs.dropoff.phone = "Please enter a valid phone number";
    }
    
    return errs;
  }, [formData.pickup, formData.dropoff]);

  // Check if route step is valid
  const isRouteValid = useMemo(() => {
    return Object.keys(errors.pickup).length === 0 && Object.keys(errors.dropoff).length === 0;
  }, [errors]);

  // Redirect protection: if user tries to access later steps directly without valid route
  useEffect(() => {
    if (currentStep !== "route" && !isRouteValid) {
      setCurrentStep("route");
      setAttemptedNext(true);
    }
  }, [currentStep, isRouteValid]);

  const handleNext = () => {
    const steps: Step[] = ["route", "package", "service", "review", "success"];
    const currentIndex = steps.indexOf(currentStep);
    
    // Validate route step before proceeding
    if (currentStep === "route") {
      setAttemptedNext(true);
      // Mark all fields as touched
      setTouched({
        pickup: { address: true, name: true, phone: true },
        dropoff: { address: true, name: true, phone: true }
      });
      
      if (!isRouteValid) {
        return; // Don't proceed if validation fails
      }
    }
    
    // If on review step, submit the order
    if (currentStep === "review") {
      handleSubmit();
      return;
    }
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
      setAttemptedNext(false);
    }
  };

  const handleBack = () => {
    const steps: Step[] = ["route", "package", "service", "review", "success"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const updateForm = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: typeof prev[section as keyof typeof prev] === 'object' 
        ? { ...(prev[section as keyof typeof prev] as object), [field]: value }
        : value
    }));
  };

  const handleBlur = (section: "pickup" | "dropoff", field: "address" | "name" | "phone") => {
    setTouched(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: true }
    }));
  };

  const shouldShowError = (section: "pickup" | "dropoff", field: "address" | "name" | "phone"): boolean => {
    return (touched[section][field] || attemptedNext) && !!errors[section][field];
  };

  const calculatePrice = () => {
    // Mock pricing logic
    let base = 1800;
    if (formData.service === "express") base += 1000;
    if (formData.package.weight === "5-10kg") base += 500;
    return base.toLocaleString();
  };

  // tRPC mutation for order creation
  const createOrderMutation = trpc.orders.createPublic.useMutation({
    onSuccess: (data) => {
      setTrackingNumber(data.trackingNumber);
      setSubmittedPrice(data.price);
      setCurrentStep("success");
      toast.success("Order created successfully!");
      // Clear form draft from localStorage
      localStorage.removeItem(FORM_STORAGE_KEY);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create order. Please try again.");
    },
  });

  // Save form state to localStorage
  const saveFormDraft = () => {
    const draft = {
      formData,
      currentStep,
      timestamp: new Date().getTime(),
    };
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(draft));
  };

  // Restore form state from localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem(FORM_STORAGE_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        const now = new Date().getTime();
        const expiryTime = FORM_EXPIRY_HOURS * 60 * 60 * 1000;
        
        // Check if draft is not expired
        if (now - draft.timestamp < expiryTime) {
          setFormData(draft.formData);
          setCurrentStep(draft.currentStep);
          toast.info("Your previous order draft has been restored.");
        } else {
          // Remove expired draft
          localStorage.removeItem(FORM_STORAGE_KEY);
        }
      } catch (error) {
        console.error("Failed to restore form draft:", error);
        localStorage.removeItem(FORM_STORAGE_KEY);
      }
    }
  }, []);

  // Save draft whenever form data changes
  useEffect(() => {
    if (currentStep !== "success" && currentStep !== "route") {
      saveFormDraft();
    }
  }, [formData, currentStep]);

  // Handle order submission
  const handleSubmit = () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      saveFormDraft(); // Save before redirecting to login
      setShowAuthModal(true);
      return;
    }

    // Submit order
    createOrderMutation.mutate({
      pickupAddress: formData.pickup.address,
      pickupContactName: formData.pickup.name,
      pickupContactPhone: formData.pickup.phone,
      deliveryAddress: formData.dropoff.address,
      deliveryContactName: formData.dropoff.name,
      deliveryContactPhone: formData.dropoff.phone,
      packageDescription: formData.package.description || undefined,
      weightCategory: formData.package.weight,
      declaredValue: formData.package.value || undefined,
      isFragile: formData.package.fragile,
      serviceType: formData.service as "standard" | "express",
      originCity: "Enugu",
      destinationCity: "Enugu",
    });
  };

  // Error message component
  const ErrorMessage = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {message}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 pt-10">
      <div className="container max-w-4xl">
        
        {/* Progress Stepper */}
        <div className="mb-12">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-slate-800 -z-10"></div>
            {["route", "package", "service", "review"].map((step, index) => {
              const steps: Step[] = ["route", "package", "service", "review", "success"];
              const isActive = steps.indexOf(currentStep) >= index;
              const isCurrent = currentStep === step;
              // Disable steps after route if route is not valid
              const isDisabled = index > 0 && !isRouteValid;
              
              return (
                <div key={step} className="flex flex-col items-center gap-2 bg-slate-50 dark:bg-slate-950 px-2">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all font-bold font-mono",
                    isDisabled ? "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-300 cursor-not-allowed" :
                    isActive ? "bg-primary border-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400"
                  )}>
                    {index + 1}
                  </div>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider hidden sm:block",
                    isDisabled ? "text-slate-300" :
                    isCurrent ? "text-primary" : "text-slate-400"
                  )}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {currentStep === "success" ? (
          <div className="bg-white dark:bg-slate-900 p-12 shadow-xl border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-display font-bold mb-4">Booking Confirmed!</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
              Your delivery request has been received. A dispatcher will contact you shortly to confirm pickup.
            </p>
            
            <div className="bg-slate-50 dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 max-w-sm mx-auto mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Tracking Number</p>
              <p className="text-3xl font-mono font-bold text-primary">{trackingNumber || "N/A"}</p>
            </div>

            {submittedPrice && (
              <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 max-w-sm mx-auto mb-8">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Total Cost</p>
                <p className="text-2xl font-display font-bold text-primary">₦{submittedPrice.toLocaleString()}</p>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button onClick={() => setLocation(`/track/${trackingNumber}`)} className="h-12 px-8 rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                Track Package
              </Button>
              <Button variant="outline" onClick={() => setLocation('/')} className="h-12 px-8 rounded-none">
                Back Home
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Form Area */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-8">
              
              {/* Validation Warning Banner */}
              {currentStep === "route" && attemptedNext && !isRouteValid && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-700 dark:text-red-400 text-sm">Please complete all required fields</p>
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                      Pickup and drop-off details are required to proceed with your booking.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Step 1: Route */}
              {currentStep === "route" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <MapPin className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-display font-bold">Route Details</h2>
                  </div>

                  {/* Pickup */}
                  <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                    <h3 className="font-bold text-sm uppercase tracking-wide text-slate-500">
                      Pickup Location <span className="text-red-500">*</span>
                    </h3>
                    
                    <div className="space-y-2">
                      <Label>Address <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="Start typing pickup address..." 
                        value={formData.pickup.address}
                        onChange={(e) => updateForm("pickup", "address", e.target.value)}
                        onBlur={() => handleBlur("pickup", "address")}
                        className={cn(
                          "rounded-none bg-white dark:bg-slate-900",
                          shouldShowError("pickup", "address") && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                      {shouldShowError("pickup", "address") && <ErrorMessage message={errors.pickup.address} />}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Contact Name <span className="text-red-500">*</span></Label>
                        <Input 
                          placeholder="Sender's Name" 
                          value={formData.pickup.name}
                          onChange={(e) => updateForm("pickup", "name", e.target.value)}
                          onBlur={() => handleBlur("pickup", "name")}
                          className={cn(
                            "rounded-none bg-white dark:bg-slate-900",
                            shouldShowError("pickup", "name") && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                        {shouldShowError("pickup", "name") && <ErrorMessage message={errors.pickup.name} />}
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number <span className="text-red-500">*</span></Label>
                        <Input 
                          placeholder="080..." 
                          value={formData.pickup.phone}
                          onChange={(e) => updateForm("pickup", "phone", e.target.value)}
                          onBlur={() => handleBlur("pickup", "phone")}
                          className={cn(
                            "rounded-none bg-white dark:bg-slate-900",
                            shouldShowError("pickup", "phone") && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                        {shouldShowError("pickup", "phone") && <ErrorMessage message={errors.pickup.phone} />}
                      </div>
                    </div>
                  </div>

                  {/* Dropoff */}
                  <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                    <h3 className="font-bold text-sm uppercase tracking-wide text-slate-500">
                      Dropoff Location <span className="text-red-500">*</span>
                    </h3>
                    
                    <div className="space-y-2">
                      <Label>Address <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="Start typing dropoff address..." 
                        value={formData.dropoff.address}
                        onChange={(e) => updateForm("dropoff", "address", e.target.value)}
                        onBlur={() => handleBlur("dropoff", "address")}
                        className={cn(
                          "rounded-none bg-white dark:bg-slate-900",
                          shouldShowError("dropoff", "address") && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                      {shouldShowError("dropoff", "address") && <ErrorMessage message={errors.dropoff.address} />}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Contact Name <span className="text-red-500">*</span></Label>
                        <Input 
                          placeholder="Recipient's Name" 
                          value={formData.dropoff.name}
                          onChange={(e) => updateForm("dropoff", "name", e.target.value)}
                          onBlur={() => handleBlur("dropoff", "name")}
                          className={cn(
                            "rounded-none bg-white dark:bg-slate-900",
                            shouldShowError("dropoff", "name") && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                        {shouldShowError("dropoff", "name") && <ErrorMessage message={errors.dropoff.name} />}
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number <span className="text-red-500">*</span></Label>
                        <Input 
                          placeholder="080..." 
                          value={formData.dropoff.phone}
                          onChange={(e) => updateForm("dropoff", "phone", e.target.value)}
                          onBlur={() => handleBlur("dropoff", "phone")}
                          className={cn(
                            "rounded-none bg-white dark:bg-slate-900",
                            shouldShowError("dropoff", "phone") && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                        {shouldShowError("dropoff", "phone") && <ErrorMessage message={errors.dropoff.phone} />}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Package */}
              {currentStep === "package" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <Box className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-display font-bold">Package Details</h2>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label>Item Description</Label>
                      <Textarea 
                        placeholder="e.g. Box of shoes, Legal documents, Laptop charger..." 
                        value={formData.package.description}
                        onChange={(e) => updateForm("package", "description", e.target.value)}
                        className="rounded-none bg-white dark:bg-slate-900 min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Weight Category</Label>
                      <RadioGroup 
                        value={formData.package.weight} 
                        onValueChange={(val) => updateForm("package", "weight", val)}
                        className="grid grid-cols-2 gap-4"
                      >
                        {["0-2kg", "2-5kg", "5-10kg", ">10kg"].map((weight) => (
                          <div key={weight}>
                            <RadioGroupItem value={weight} id={weight} className="peer sr-only" />
                            <Label
                              htmlFor={weight}
                              className="flex flex-col items-center justify-center p-4 border-2 border-slate-200 dark:border-slate-800 rounded-none cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:border-primary/50 transition-all"
                            >
                              <span className="font-bold">{weight}</span>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Declared Value (₦)</Label>
                        <Input 
                          type="number"
                          placeholder="0.00" 
                          value={formData.package.value}
                          onChange={(e) => updateForm("package", "value", e.target.value)}
                          className="rounded-none bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div className="flex items-end pb-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="fragile" 
                            checked={formData.package.fragile}
                            onCheckedChange={(checked) => updateForm("package", "fragile", checked)}
                          />
                          <Label htmlFor="fragile" className="cursor-pointer">Fragile / Handle with Care</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Service */}
              {currentStep === "service" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <Truck className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-display font-bold">Select Service</h2>
                  </div>

                  <RadioGroup 
                    value={formData.service} 
                    onValueChange={(val) => {
                      setFormData(prev => ({ ...prev, service: val }));
                    }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <RadioGroupItem value="standard" id="standard" className="peer sr-only" />
                      <Label
                        htmlFor="standard"
                        className="flex items-start gap-4 p-6 border-2 border-slate-200 dark:border-slate-800 rounded-none cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:border-primary/50 transition-all"
                      >
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600">
                          <Truck className="w-6 h-6" />
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-lg">Standard Delivery</h3>
                            <span className="font-bold text-lg">₦1,800</span>
                          </div>
                          <p className="text-sm text-slate-500 mb-2">Within 2-4 hours</p>
                          <p className="text-xs text-slate-400">Best for non-urgent parcels. Reliable same-day service.</p>
                        </div>
                      </Label>
                    </div>

                    <div className="relative">
                      <RadioGroupItem value="express" id="express" className="peer sr-only" />
                      <Label
                        htmlFor="express"
                        className="flex items-start gap-4 p-6 border-2 border-slate-200 dark:border-slate-800 rounded-none cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:border-primary/50 transition-all"
                      >
                        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                          <Zap className="w-6 h-6" />
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-lg">Express Delivery</h3>
                            <span className="font-bold text-lg">₦2,800</span>
                          </div>
                          <p className="text-sm text-slate-500 mb-2">Direct - Immediate Dispatch</p>
                          <p className="text-xs text-slate-400">Priority pickup. Direct rider assignment. No stops in between.</p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Step 4: Review */}
              {currentStep === "review" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-display font-bold">Review & Book</h2>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/50 p-6 space-y-6 border border-slate-100 dark:border-slate-800">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xs uppercase font-bold text-slate-500 mb-2">Route</h4>
                        <div className="space-y-4">
                          <div className="flex gap-3">
                            <div className="w-2 h-2 mt-2 bg-primary rounded-full shrink-0" />
                            <div>
                              <p className="text-sm font-bold">{formData.pickup.address}</p>
                              <p className="text-xs text-slate-500">{formData.pickup.name} • {formData.pickup.phone}</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="w-2 h-2 mt-2 bg-red-500 rounded-full shrink-0" />
                            <div>
                              <p className="text-sm font-bold">{formData.dropoff.address}</p>
                              <p className="text-xs text-slate-500">{formData.dropoff.name} • {formData.dropoff.phone}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-xs uppercase font-bold text-slate-500 mb-2">Package & Service</h4>
                        <div className="space-y-2">
                          <p className="text-sm"><span className="font-medium">Item:</span> {formData.package.description || "N/A"}</p>
                          <p className="text-sm"><span className="font-medium">Weight:</span> {formData.package.weight}</p>
                          <p className="text-sm"><span className="font-medium">Service:</span> <span className="uppercase text-primary font-bold">{formData.service}</span></p>
                          {formData.package.fragile && (
                            <span className="inline-block px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-sm">FRAGILE</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-end">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Payment Method</p>
                        <p className="font-bold text-sm">Pay on Pickup (Transfer/Cash)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Total Estimated Cost</p>
                        <p className="text-3xl font-display font-bold text-primary">₦{calculatePrice()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reassurance Text (Review Step Only) */}
              {currentStep === "review" && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-sm">
                  <p className="text-sm text-blue-900 dark:text-blue-300 leading-relaxed">
                    <strong>Note:</strong> You'll be asked to log in before confirming your booking. Login helps you track deliveries and manage orders easily.
                  </p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={handleBack} 
                  disabled={currentStep === "route"}
                  className="rounded-none border-slate-200 dark:border-slate-700"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleNext} 
                  disabled={createOrderMutation.isPending || (currentStep === "route" && !isRouteValid)}
                  className={cn(
                    "rounded-none min-w-[140px]",
                    currentStep === "route" && !isRouteValid 
                      ? "bg-slate-400 hover:bg-slate-400 cursor-not-allowed" 
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    <>
                      {currentStep === "review" ? "Confirm Booking" : "Next Step"} <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

            </div>

            {/* Sidebar Map Preview */}
            <div className="hidden lg:block">
              <div className="sticky top-24 bg-slate-100 dark:bg-slate-800 h-[400px] border border-slate-200 dark:border-slate-700 shadow-lg">
                <MapView className="w-full h-full" />
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-4 text-xs text-slate-600 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="font-bold">Estimated Time: ~25 mins</span>
                  </div>
                  <p>Traffic is light on Ogui Road.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ Section */}
        {currentStep !== "success" && (
          <section className="py-16 bg-slate-50 dark:bg-slate-900/50">
            <div className="container max-w-3xl">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-display font-bold mb-3">Frequently Asked Questions</h2>
                <p className="text-slate-600 dark:text-slate-400">Quick answers to common questions about our delivery service</p>
              </div>
              
              <Accordion type="single" collapsible className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <AccordionItem value="item-1" className="border-b border-slate-200 dark:border-slate-800 px-6">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                    How is delivery price calculated?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 pb-5 leading-relaxed">
                    Delivery price is based on service type (Standard or Express), package weight, and distance. Standard intra-city delivery starts at ₦1,800. Heavier packages incur additional charges. You'll see the total estimated cost before confirming your booking.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="border-b border-slate-200 dark:border-slate-800 px-6">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                    How long does delivery take?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 pb-5 leading-relaxed">
                    Standard intra-city delivery typically takes 2-4 hours. Express delivery is completed within 1-2 hours. Actual delivery time depends on traffic conditions and pickup/drop-off locations. You'll receive real-time updates via tracking.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3" className="border-b border-slate-200 dark:border-slate-800 px-6">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                    When do I need to pay?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 pb-5 leading-relaxed">
                    Payment is due at pickup. You can pay via bank transfer or cash to the rider. Our dispatcher will contact you to confirm pickup time and payment method before the rider arrives.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4" className="border-b border-slate-200 dark:border-slate-800 px-6">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                    Can I track my delivery?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 pb-5 leading-relaxed">
                    Yes! After booking, you'll receive a unique tracking number. Use it on our Track Package page to monitor your delivery in real-time on the map. You'll see pickup confirmation, rider location, and delivery completion updates.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5" className="border-b border-slate-200 dark:border-slate-800 px-6">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                    What if I'm not logged in yet?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 pb-5 leading-relaxed">
                    You can fill out the delivery request form without logging in. When you click "Confirm Booking", you'll be prompted to log in or create an account. Your form data will be saved, so you won't lose any information during the login process.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-6" className="px-6">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                    Who delivers my package?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 pb-5 leading-relaxed">
                    Your package is delivered by our network of verified and trained riders. All riders undergo background checks and safety training. You'll receive the rider's name and contact information once they're assigned to your delivery.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </section>
        )}

        {/* Auth Gate Modal */}
        <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Login Required</DialogTitle>
              <DialogDescription>
                Please login or create an account to continue and track your delivery.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowAuthModal(false)}
                className="rounded-none"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  saveFormDraft();
                  window.location.href = getLoginUrl();
                }}
                className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue to Login
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
