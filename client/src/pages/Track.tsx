import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapView } from "@/components/Map";
import { Box, CheckCircle2, Clock, MapPin, Phone, AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

export default function Track() {
  const [match, params] = useRoute("/track/:id");
  const [trackingId, setTrackingId] = useState(match ? params.id : "");
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const riderMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const deliveryMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);

  // Fetch tracking data using tRPC
  const { data, isLoading, refetch } = trpc.orders.getByTrackingNumber.useQuery(
    { trackingNumber: trackingId },
    { enabled: !!trackingId, refetchInterval: trackingId ? 30000 : false } // Auto-refresh every 30s if tracking
  );

  useEffect(() => {
    if (match && params?.id) {
      setTrackingId(params.id);
    }
  }, [match, params]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingId) {
      refetch();
    }
  };

  // Update map markers when data changes
  useEffect(() => {
    if (!mapInstance || !data) return;

    const google = window.google;
    if (!google) return;

    // Clear existing markers and route
    if (riderMarkerRef.current) riderMarkerRef.current.setMap(null);
    if (pickupMarkerRef.current) pickupMarkerRef.current.setMap(null);
    if (deliveryMarkerRef.current) deliveryMarkerRef.current.setMap(null);
    if (routeLineRef.current) routeLineRef.current.setMap(null);

    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    // Add pickup marker if coordinates available
    if (data.pickupLat && data.pickupLng) {
      const pickupLat = parseFloat(data.pickupLat);
      const pickupLng = parseFloat(data.pickupLng);
      if (!isNaN(pickupLat) && !isNaN(pickupLng)) {
        pickupMarkerRef.current = new google.maps.Marker({
          position: { lat: pickupLat, lng: pickupLng },
          map: mapInstance,
          title: "Pickup Location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#10b981",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        bounds.extend({ lat: pickupLat, lng: pickupLng });
        hasMarkers = true;
      }
    }

    // Add delivery marker if coordinates available
    if (data.deliveryLat && data.deliveryLng) {
      const deliveryLat = parseFloat(data.deliveryLat);
      const deliveryLng = parseFloat(data.deliveryLng);
      if (!isNaN(deliveryLat) && !isNaN(deliveryLng)) {
        deliveryMarkerRef.current = new google.maps.Marker({
          position: { lat: deliveryLat, lng: deliveryLng },
          map: mapInstance,
          title: "Delivery Location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        bounds.extend({ lat: deliveryLat, lng: deliveryLng });
        hasMarkers = true;
      }
    }

    // Draw route line between pickup and delivery
    if (pickupMarkerRef.current && deliveryMarkerRef.current) {
      const pickupPos = pickupMarkerRef.current.getPosition();
      const deliveryPos = deliveryMarkerRef.current.getPosition();
      if (pickupPos && deliveryPos) {
        routeLineRef.current = new google.maps.Polyline({
          path: [pickupPos, deliveryPos],
          geodesic: true,
          strokeColor: "#10b981",
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: mapInstance,
        });
      }
    }

    // Add rider marker if in transit and location available
    if (data.status === "in_transit" && data.riderLocation) {
      riderMarkerRef.current = new google.maps.Marker({
        position: { lat: data.riderLocation.lat, lng: data.riderLocation.lng },
        map: mapInstance,
        title: "Rider Location",
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "#f59e0b",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          rotation: 0,
        },
      });
      bounds.extend({ lat: data.riderLocation.lat, lng: data.riderLocation.lng });
      hasMarkers = true;
    }

    // Fit map to show all markers
    if (hasMarkers) {
      mapInstance.fitBounds(bounds);
      // Add padding to bounds
      const padding = { top: 50, right: 50, bottom: 50, left: 50 };
      mapInstance.fitBounds(bounds, padding);
    } else {
      // Default center on Enugu if no markers
      mapInstance.setCenter({ lat: 6.45, lng: 7.50 });
      mapInstance.setZoom(12);
    }
  }, [mapInstance, data]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "in_transit":
        return (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full animate-pulse">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="font-bold uppercase text-xs tracking-wider">In Transit</span>
          </div>
        );
      case "delivered":
        return (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-bold uppercase text-xs tracking-wider">Delivered</span>
          </div>
        );
      case "picked_up":
        return (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full">
            <Clock className="w-4 h-4" />
            <span className="font-bold uppercase text-xs tracking-wider">Picked Up</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-500/10 text-slate-500 border border-slate-500/20 rounded-full">
            <Clock className="w-4 h-4" />
            <span className="font-bold uppercase text-xs tracking-wider">Pending</span>
          </div>
        );
    }
  };

  const getStatusUpdates = () => {
    if (!data) return [];

    const updates = [
      { status: "Order Placed", time: new Date(data.createdAt).toLocaleString('en-NG', { timeStyle: 'short' }), completed: true },
    ];

    if (data.status === "picked_up" || data.status === "in_transit" || data.status === "delivered") {
      updates.push({ status: "Picked Up", time: data.pickedUpAt ? new Date(data.pickedUpAt).toLocaleString('en-NG', { timeStyle: 'short' }) : "-", completed: true });
    }

    if (data.status === "in_transit" || data.status === "delivered") {
      updates.push({ status: "In Transit", time: "Now", completed: false, active: data.status === "in_transit" } as any);
    }

    updates.push({ status: "Delivered", time: data.deliveredAt ? new Date(data.deliveredAt).toLocaleString('en-NG', { timeStyle: 'short' }) : "-", completed: data.status === "delivered" });

    return updates;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="bg-slate-900 text-white py-12">
        <div className="container max-w-2xl text-center">
          <h1 className="text-3xl font-display font-bold mb-6">Track Your Shipment</h1>
          <form onSubmit={onSearchSubmit} className="flex gap-2">
            <div className="relative flex-grow">
              <Box className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <Input 
                placeholder="Enter Tracking ID (e.g. AP-EN-8492)" 
                className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-none focus-visible:ring-primary font-mono text-lg"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
              />
            </div>
            <Button type="submit" className="h-14 px-8 rounded-none bg-primary text-primary-foreground font-bold hover:bg-primary/90">
              Track
            </Button>
          </form>
        </div>
      </div>

      <div className="container max-w-4xl -mt-8">
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 p-12 shadow-xl border border-slate-200 dark:border-slate-800 text-center">
            <Loader2 className="animate-spin w-8 h-8 mx-auto mb-4 text-primary" />
            <p className="text-slate-500">Locating your package...</p>
          </div>
        ) : data ? (
          <div className="bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Status Header */}
            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Tracking ID</p>
                <h2 className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{data.trackingNumber}</h2>
              </div>
              <div className="flex flex-col items-end gap-2">
                {renderStatusBadge(data.status)}
                {data.status === "in_transit" && data.riderLocation && (
                  <p className="text-xs text-slate-500">
                    Last updated: {new Date(data.riderLocation.timestamp).toLocaleString('en-NG', { timeStyle: 'short' })}
                  </p>
                )}
              </div>
            </div>

            {/* Map Area */}
            <div className="h-[400px] w-full bg-slate-100 relative">
              <MapView 
                className="w-full h-full"
                onMapReady={(map) => {
                  setMapInstance(map);
                }}
              />
              {data.status !== "in_transit" && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/5 pointer-events-none">
                  <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-xs font-mono text-slate-600 border border-slate-200 shadow-sm">
                    {data.status === "delivered" ? "Delivery Complete" : "Tracking Inactive"}
                  </div>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
              {/* Timeline */}
              <div className="col-span-2 p-6 md:p-8">
                <h3 className="font-display font-bold text-lg mb-6">Shipment Progress</h3>
                <div className="space-y-0">
                  {getStatusUpdates().map((update: any, index: number) => (
                    <div key={index} className="relative pl-8 pb-8 last:pb-0">
                      {/* Line */}
                      {index !== getStatusUpdates().length - 1 && (
                        <div className={cn(
                          "absolute left-[11px] top-3 bottom-0 w-[2px]",
                          update.completed ? "bg-primary" : "bg-slate-200 dark:bg-slate-800"
                        )}></div>
                      )}
                      
                      {/* Dot */}
                      <div className={cn(
                        "absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-900",
                        update.completed ? "border-primary text-primary" : 
                        update.active ? "border-primary text-primary animate-pulse" : "border-slate-300 dark:border-slate-700 text-slate-300"
                      )}>
                        {update.completed && <div className="w-2 h-2 bg-primary rounded-full" />}
                        {update.active && <div className="w-2 h-2 bg-primary rounded-full animate-ping" />}
                      </div>

                      <div className={cn("transition-opacity", !update.completed && !update.active && "opacity-50")}>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{update.status}</h4>
                        <p className="text-xs text-slate-500 mt-1">{update.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details Sidebar */}
              <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-display font-bold text-lg mb-6">Delivery Details</h3>
                
                <div className="space-y-6">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">From</p>
                    <div className="flex gap-3">
                      <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                      <div>
                        <p className="font-bold text-sm">{data.pickupContactName}</p>
                        <p className="text-xs text-slate-500">{data.pickupAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">To</p>
                    <div className="flex gap-3">
                      <MapPin className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="font-bold text-sm">{data.deliveryContactName}</p>
                        <p className="text-xs text-slate-500">{data.deliveryAddress}</p>
                      </div>
                    </div>
                  </div>

                  {data.riderPhone && (
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Rider Contact</p>
                      <div className="flex gap-3 items-center">
                        <Phone className="w-5 h-5 text-primary" />
                        <a href={`tel:${data.riderPhone}`} className="text-sm font-medium text-primary hover:underline">
                          {data.riderPhone}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-6">
                    <Button variant="outline" className="w-full border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <AlertCircle className="w-4 h-4 mr-2" /> Report Issue
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : trackingId ? (
          <div className="bg-white dark:bg-slate-900 p-12 shadow-xl border border-slate-200 dark:border-slate-800 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Tracking ID Not Found</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              We couldn't find a shipment with ID <span className="font-mono font-bold">{trackingId}</span>. Please check the number and try again.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
