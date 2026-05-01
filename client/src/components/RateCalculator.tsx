import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Plane, Truck, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const AIR_RATES = {
  "Enugu-Lagos": 10000,
  "Lagos-Enugu": 10000,
  "Enugu-Abuja": 10000,
  "Abuja-Enugu": 10000,
  "Enugu-Port Harcourt": 6000,
  "Port Harcourt-Enugu": 6000,
};

const LOCATIONS = ["Enugu", "Lagos", "Abuja", "Port Harcourt"];

// Zone Definitions
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

// Simplified adjacency map for MVP logic
// This maps each zone to its "Adjacent" zones. Any zone not same or adjacent is considered "Far".
const ADJACENCY_MAP: Record<string, string[]> = {
  "Zone 1": ["Zone 2", "Zone 5"],
  "Zone 2": ["Zone 1", "Zone 3"],
  "Zone 3": ["Zone 2", "Zone 4"],
  "Zone 4": ["Zone 3"],
  "Zone 5": ["Zone 1"]
};

export default function RateCalculator({ className }: { className?: string }) {
  const [origin, setOrigin] = useState("Enugu");
  const [destination, setDestination] = useState("Lagos");
  const [weight, setWeight] = useState("");
  
  // Zone states
  const [pickupZone, setPickupZone] = useState<string>("");
  const [deliveryZone, setDeliveryZone] = useState<string>("");

  const [price, setPrice] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<"air" | "ground">("air");
  const [zoneNote, setZoneNote] = useState<string>("");

  useEffect(() => {
    calculatePrice();
  }, [origin, destination, weight, pickupZone, deliveryZone]);

  const calculatePrice = () => {
    // Reset state
    setPrice(null);
    setZoneNote("");

    // Intra-city logic (Enugu only)
    if (origin === "Enugu" && destination === "Enugu") {
       setServiceType("ground");
       
       if (!pickupZone || !deliveryZone) return;

       if (pickupZone === deliveryZone) {
         setPrice(ZONE_PRICING["Same Zone"]);
         setZoneNote("Same Zone Rate");
       } else if (ADJACENCY_MAP[pickupZone]?.includes(deliveryZone)) {
         setPrice(ZONE_PRICING["Adjacent"]);
         setZoneNote("Adjacent Zone Rate");
       } else {
         setPrice(ZONE_PRICING["Far"]);
         setZoneNote("Far Zone Rate");
       }
       return;
    }

    // Inter-city logic
    if (!weight || isNaN(Number(weight))) {
      return;
    }

    setServiceType("air");
    const routeKey = `${origin}-${destination}`;
    const reverseRouteKey = `${destination}-${origin}`;
    const rate = AIR_RATES[routeKey as keyof typeof AIR_RATES] || AIR_RATES[reverseRouteKey as keyof typeof AIR_RATES];
    
    if (rate) {
      setPrice(rate * Number(weight));
    } else {
      setPrice(null); // Route not supported
    }
  };

  const isIntraCity = origin === "Enugu" && destination === "Enugu";

  return (
    <div className={cn("bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-lg", className)}>
      <div className="flex items-center gap-2 mb-6 text-primary">
        <Calculator className="w-6 h-6" />
        <h3 className="font-display font-bold text-xl">Quick Rate Calculator</h3>
      </div>

      <div className="space-y-4">
        {/* Origin & Destination */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Select value={origin} onValueChange={(val) => {
              setOrigin(val);
              // Reset zones when changing city
              setPickupZone("");
            }}>
              <SelectTrigger className="rounded-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Select value={destination} onValueChange={(val) => {
              setDestination(val);
              setDeliveryZone("");
            }}>
              <SelectTrigger className="rounded-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Intra-City Zone Selection */}
        {isIntraCity && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="p-3 bg-primary/5 border border-primary/10 text-xs text-slate-600 dark:text-slate-400">
              <p className="font-bold text-primary mb-1">Enugu Intra-City Pricing (MVP)</p>
              Select your specific areas to see zone-based rates.
            </div>
            
            <div className="space-y-2">
              <Label>Pickup Area (Zone)</Label>
              <Select value={pickupZone} onValueChange={setPickupZone}>
                <SelectTrigger className="rounded-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700">
                  <SelectValue placeholder="Select Area" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {Object.entries(ZONES).map(([zone, areas]) => (
                    <SelectItem key={zone} value={zone}>
                      <span className="font-bold">{zone}</span> - {areas.join(", ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Delivery Area (Zone)</Label>
              <Select value={deliveryZone} onValueChange={setDeliveryZone}>
                <SelectTrigger className="rounded-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700">
                  <SelectValue placeholder="Select Area" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {Object.entries(ZONES).map(([zone, areas]) => (
                    <SelectItem key={zone} value={zone}>
                      <span className="font-bold">{zone}</span> - {areas.join(", ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Inter-City Weight Input */}
        {!isIntraCity && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <Label>Weight (kg)</Label>
            <Input 
              type="number" 
              placeholder="e.g. 2.5" 
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="rounded-none bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 placeholder:text-slate-400"
            />
          </div>
        )}

        {/* Price Display */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          {price !== null ? (
            <div className="bg-slate-900 dark:bg-slate-800 p-6 rounded-md border border-slate-800 dark:border-slate-700 shadow-inner">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Estimated Cost</span>
                {serviceType === "air" && (
                   <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-sm uppercase tracking-wide border border-primary/20">
                     <Plane className="w-3 h-3" /> Air Express
                   </span>
                )}
                 {serviceType === "ground" && (
                   <span className="flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800 dark:bg-slate-700 px-2 py-0.5 rounded-sm uppercase tracking-wide border border-slate-700">
                     <Truck className="w-3 h-3" /> Intra-City
                   </span>
                )}
              </div>
              
              <div className="mt-2">
                <span className="text-4xl font-display font-bold text-white tracking-tight">₦{price.toLocaleString()}</span>
                {serviceType === "air" && (
                   <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                     Weight-based pricing applied
                   </p>
                )}
                {serviceType === "ground" && (
                   <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                     {zoneNote}
                   </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-500 font-medium uppercase tracking-wide">Estimated Cost</span>
              <div className="text-right">
                <span className="text-xl font-mono text-slate-300">--</span>
                {!isIntraCity && origin !== destination && !AIR_RATES[`${origin}-${destination}` as keyof typeof AIR_RATES] && !AIR_RATES[`${destination}-${origin}` as keyof typeof AIR_RATES] && (
                   <p className="text-xs text-red-400 mt-1">Route not currently available</p>
                )}
              </div>
            </div>
          )}
        </div>
        
        <Button className="w-full rounded-none font-bold" disabled={!price}>
          Book This Shipment
        </Button>
      </div>
    </div>
  );
}
