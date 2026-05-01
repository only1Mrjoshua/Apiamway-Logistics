import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft,
  AlertTriangle,
  Package,
  User,
  MapPin,
  Calculator
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

// Zone Definitions (same as RateCalculator)
const ZONES = {
  "Zone 1": ["Ogbete", "Asata", "Coal Camp", "Achara Layout", "Maryland", "Uwani"],
  "Zone 2": ["Independence Layout", "GRA", "New Haven"],
  "Zone 3": ["Trans-Ekulu", "Thinkers Corner"],
  "Zone 4": ["Abakpa", "Nike", "Emene", "Sunrise", "Eke-Obinagu"],
  "Zone 5": ["Topland", "Garki", "Akwuke", "Amechi Awkunanaw", "Centenary City", "Monaque Ave.", "Ugwuaji", "Goshen Estate"]
};

const ZONE_PRICING = {
  "Same Zone": 2000,
  "Adjacent": 2500,
  "Far": 3500
};

const ADJACENCY_MAP: Record<string, string[]> = {
  "Zone 1": ["Zone 2", "Zone 5"],
  "Zone 2": ["Zone 1", "Zone 3"],
  "Zone 3": ["Zone 2", "Zone 4"],
  "Zone 4": ["Zone 3"],
  "Zone 5": ["Zone 1"]
};

const AIR_RATES: Record<string, number> = {
  "Enugu-Lagos": 10000,
  "Lagos-Enugu": 10000,
  "Enugu-Abuja": 10000,
  "Abuja-Enugu": 10000,
  "Enugu-Port Harcourt": 6000,
  "Port Harcourt-Enugu": 6000,
};

const CITIES = ["Enugu", "Lagos", "Abuja", "Port Harcourt"];

export default function NewOrder() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupZone, setPickupZone] = useState("");
  const [pickupContactName, setPickupContactName] = useState("");
  const [pickupContactPhone, setPickupContactPhone] = useState("");
  
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [deliveryContactName, setDeliveryContactName] = useState("");
  const [deliveryContactPhone, setDeliveryContactPhone] = useState("");
  
  const [serviceType, setServiceType] = useState<"intra-city" | "inter-city-air">("intra-city");
  const [originCity, setOriginCity] = useState("Enugu");
  const [destinationCity, setDestinationCity] = useState("Enugu");
  const [weightKg, setWeightKg] = useState("");
  
  const [packageDescription, setPackageDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (order) => {
      toast.success(`Order ${order?.trackingNumber} created successfully!`);
      setLocation(`/admin/orders/${order?.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Calculate price
  const calculatePrice = (): number => {
    if (serviceType === "intra-city") {
      if (!pickupZone || !deliveryZone) return 0;
      if (pickupZone === deliveryZone) return ZONE_PRICING["Same Zone"];
      if (ADJACENCY_MAP[pickupZone]?.includes(deliveryZone)) return ZONE_PRICING["Adjacent"];
      return ZONE_PRICING["Far"];
    } else {
      // Inter-city
      const weight = parseFloat(weightKg) || 0;
      if (weight <= 0) return 0;
      const routeKey = `${originCity}-${destinationCity}`;
      const rate = AIR_RATES[routeKey] || 0;
      return rate * weight;
    }
  };

  const price = calculatePrice();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerPhone || !pickupAddress || !deliveryAddress) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (price <= 0) {
      toast.error("Please complete the pricing information");
      return;
    }

    createOrder.mutate({
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      pickupAddress,
      pickupZone: pickupZone || undefined,
      pickupContactName: pickupContactName || customerName,
      pickupContactPhone: pickupContactPhone || customerPhone,
      deliveryAddress,
      deliveryZone: deliveryZone || undefined,
      deliveryContactName: deliveryContactName || "",
      deliveryContactPhone: deliveryContactPhone || "",
      serviceType,
      originCity,
      destinationCity,
      weightKg: weightKg || undefined,
      price: price.toString(),
      paymentMethod,
      packageDescription: packageDescription || undefined,
    });
  };

  if (authLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user || !["admin", "dispatcher"].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <Button onClick={() => setLocation("/")}>Return Home</Button>
        </div>
      </div>
    );
  }

  const isIntraCity = serviceType === "intra-city";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/orders")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create New Order</h1>
          <p className="text-muted-foreground">Fill in the delivery details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Service Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className={`p-4 border rounded-lg text-left transition-colors ${
                  serviceType === "intra-city" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => {
                  setServiceType("intra-city");
                  setOriginCity("Enugu");
                  setDestinationCity("Enugu");
                }}
              >
                <p className="font-medium">Intra-City</p>
                <p className="text-sm text-muted-foreground">Within Enugu</p>
              </button>
              <button
                type="button"
                className={`p-4 border rounded-lg text-left transition-colors ${
                  serviceType === "inter-city-air" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => {
                  setServiceType("inter-city-air");
                  setPickupZone("");
                  setDeliveryZone("");
                }}
              >
                <p className="font-medium">Inter-City Air</p>
                <p className="text-sm text-muted-foreground">Between cities</p>
              </button>
            </div>

            {!isIntraCity && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Origin City</Label>
                  <Select value={originCity} onValueChange={setOriginCity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CITIES.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Destination City</Label>
                  <Select value={destinationCity} onValueChange={setDestinationCity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CITIES.filter(c => c !== originCity).map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Name *</Label>
                <Input 
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone *</Label>
                <Input 
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08012345678"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customerEmail">Email (optional)</Label>
                <Input 
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@email.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pickup Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-500" />
              Pickup Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pickupAddress">Pickup Address *</Label>
              <Textarea 
                id="pickupAddress"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Full pickup address"
                required
              />
            </div>
            
            {isIntraCity && (
              <div className="space-y-2">
                <Label>Pickup Zone *</Label>
                <Select value={pickupZone} onValueChange={setPickupZone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ZONES).map(([zone, areas]) => (
                      <SelectItem key={zone} value={zone}>
                        <span className="font-medium">{zone}</span> - {areas.join(", ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickupContactName">Contact Name</Label>
                <Input 
                  id="pickupContactName"
                  value={pickupContactName}
                  onChange={(e) => setPickupContactName(e.target.value)}
                  placeholder="Person to meet"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupContactPhone">Contact Phone</Label>
                <Input 
                  id="pickupContactPhone"
                  value={pickupContactPhone}
                  onChange={(e) => setPickupContactPhone(e.target.value)}
                  placeholder="08012345678"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-500" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryAddress">Delivery Address *</Label>
              <Textarea 
                id="deliveryAddress"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Full delivery address"
                required
              />
            </div>
            
            {isIntraCity && (
              <div className="space-y-2">
                <Label>Delivery Zone *</Label>
                <Select value={deliveryZone} onValueChange={setDeliveryZone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ZONES).map(([zone, areas]) => (
                      <SelectItem key={zone} value={zone}>
                        <span className="font-medium">{zone}</span> - {areas.join(", ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryContactName">Contact Name</Label>
                <Input 
                  id="deliveryContactName"
                  value={deliveryContactName}
                  onChange={(e) => setDeliveryContactName(e.target.value)}
                  placeholder="Recipient name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryContactPhone">Contact Phone</Label>
                <Input 
                  id="deliveryContactPhone"
                  value={deliveryContactPhone}
                  onChange={(e) => setDeliveryContactPhone(e.target.value)}
                  placeholder="08012345678"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Package & Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Package & Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isIntraCity && (
              <div className="space-y-2">
                <Label htmlFor="weightKg">Weight (kg) *</Label>
                <Input 
                  id="weightKg"
                  type="number"
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="e.g. 2.5"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="packageDescription">Package Description</Label>
              <Textarea 
                id="packageDescription"
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
                placeholder="What's being delivered?"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash on Pickup</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Display */}
            <div className="bg-slate-900 text-white p-6 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-400">Calculated Price</p>
                  <p className="text-3xl font-bold">₦{price.toLocaleString()}</p>
                </div>
                {isIntraCity && pickupZone && deliveryZone && (
                  <div className="text-right text-sm text-slate-400">
                    {pickupZone === deliveryZone 
                      ? "Same Zone Rate" 
                      : ADJACENCY_MAP[pickupZone]?.includes(deliveryZone) 
                        ? "Adjacent Zone Rate"
                        : "Far Zone Rate"}
                  </div>
                )}
                {!isIntraCity && weightKg && (
                  <div className="text-right text-sm text-slate-400">
                    {weightKg}kg × ₦{AIR_RATES[`${originCity}-${destinationCity}`]?.toLocaleString() || 0}/kg
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => setLocation("/admin/orders")}>
            Cancel
          </Button>
          <Button type="submit" disabled={createOrder.isPending || price <= 0}>
            {createOrder.isPending ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}
