import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Box, Map, ShieldCheck, Clock, Zap, Truck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Home() {
  const [trackingId, setTrackingId] = useState("");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingId.trim()) {
      setLocation(`/track/${trackingId}`);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-950 text-white pt-20">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://files.manuscdn.com/user_upload_by_module/session_file/114974226/tXnyAZqAGDvSjOiN.jpg" 
            alt="Logistics Network" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
        </div>

        <div className="container relative z-10 grid lg:grid-cols-2 gap-12 items-start pt-10">
          <div className="space-y-8 animate-in slide-in-from-left-10 fade-in duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Live in Enugu • Lagos • Abuja • PH
            </div>
            
            <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight">
              Smart. Fast. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Reliable.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-300 max-w-lg leading-relaxed font-light">
              Next-generation logistics for Nigeria's modern economy. From intra-city bike delivery to nationwide air express cargo.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              {!isAuthenticated && (
                <Link href="/get-started">
                  <Button size="lg" className="h-14 px-8 text-lg rounded-none bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all">
                    Get Started <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              )}
              <Link href="/track">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg rounded-none border-white/20 text-white hover:bg-white/10 hover:border-white/40 bg-transparent backdrop-blur-sm"
                >
                  Track Shipment
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: Tracking */}
          <div className="lg:pl-12 space-y-6 animate-in slide-in-from-right-10 fade-in duration-700 delay-200" id="track-section">
            {/* Tracking Box */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
              <h3 className="text-lg font-display font-bold mb-2">Track your package</h3>
              <form onSubmit={handleTrack} className="flex gap-2">
                <div className="relative flex-grow">
                  <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <Input 
                    placeholder="AP-EN-8492" 
                    className="h-10 pl-9 bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600 rounded-none focus-visible:ring-primary font-mono text-sm"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                  />
                </div>
                <Button type="submit" className="h-10 px-4 rounded-none bg-white text-slate-950 hover:bg-slate-200 font-bold text-sm">
                  Track
                </Button>
              </form>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-slate-500">
          <ArrowRight className="rotate-90 w-6 h-6" />
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-slate-900 dark:text-white">Our Logistics Solutions</h2>
            <p className="text-slate-600 dark:text-slate-400">Tailored services designed to meet the speed and scale of your business.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1 duration-300">
              <div className="w-14 h-14 bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-primary">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-display">On-Demand Courier</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Fast, reliable intra-city delivery for documents and small parcels. Perfect for urgent business needs.
              </p>
              <Link href="/services" className="inline-flex items-center text-sm font-bold text-primary hover:text-primary/80 uppercase tracking-wide">
                Learn more <ArrowRight className="ml-1 w-4 h-4" />
              </Link>
            </div>

            {/* Service 2 */}
            <div className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1 duration-300">
              <div className="w-14 h-14 bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-primary">
                <Truck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-display">Inter-City Shipping</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Secure shipping between major Nigerian cities. Real-time status updates and professional handling.
              </p>
              <Link href="/services" className="inline-flex items-center text-sm font-bold text-primary hover:text-primary/80 uppercase tracking-wide">
                Learn more <ArrowRight className="ml-1 w-4 h-4" />
              </Link>
            </div>

            {/* Service 3 */}
            <div className="group bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 hover:border-primary/50 transition-all hover:shadow-xl hover:-translate-y-1 duration-300">
              <div className="w-14 h-14 bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-primary">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 font-display">Corporate Logistics</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Retainer packages and dedicated fleets for businesses. Custom SLAs and monthly invoicing.
              </p>
              <Link href="/services" className="inline-flex items-center text-sm font-bold text-primary hover:text-primary/80 uppercase tracking-wide">
                Learn more <ArrowRight className="ml-1 w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals Section */}
      <section className="py-16 bg-white dark:bg-background border-y border-slate-200 dark:border-slate-800">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="space-y-3">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Map className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Real-Time Tracking</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Monitor your delivery live on the map from pickup to drop-off.</p>
            </div>
            <div className="space-y-3">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Secure Payments</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pay safely online or on pickup with verified payment methods.</p>
            </div>
            <div className="space-y-3">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Truck className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Verified Riders & Fleets</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">All riders are vetted, trained, and managed for your peace of mind.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="py-24 bg-white dark:bg-background overflow-hidden">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-50"></div>
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/114974226/ICoBIvHgAMSprTPB.jpg" 
                alt="Apiamway Rider" 
                className="relative z-10 w-full shadow-2xl grayscale hover:grayscale-0 transition-all duration-700 border border-slate-200 dark:border-slate-800"
              />
              {/* Floating Badge */}
              <div className="absolute -bottom-6 -right-6 z-20 bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-100 dark:border-slate-800 max-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-primary w-5 h-5" />
                  <span className="font-bold font-display">On-Time</span>
                </div>
                <p className="text-xs text-slate-500">We prioritize punctuality with a greater than 95% on-time delivery rate.</p>
              </div>
            </div>
            
            <div className="order-1 lg:order-2 space-y-8">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                Why businesses choose <span className="text-primary">Apiamway</span>
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                We are building the infrastructure for the future of commerce in Nigeria. Our approach combines the agility of a startup with the reliability of an enterprise partner.
              </p>
              
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-primary">
                    <Map className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold font-display text-lg mb-1">Real-Time Visibility</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Track your shipments live on the map. No more guessing games.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-primary">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold font-display text-lg mb-1">Electric Fleet</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Sustainable, quiet, and efficient delivery using modern e-bikes.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-primary">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold font-display text-lg mb-1">Professional Riders</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Vetted, trained, and uniformed riders who represent your brand well.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet Owner CTA Section */}
      <section className="py-20 bg-slate-100 dark:bg-slate-900">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Own Delivery Bikes or Vehicles?</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
              Add your fleet to Apiamway and earn weekly payouts. We handle dispatch, tracking, and customer service—you focus on growing your fleet.
            </p>
            <Link href="/fleet-owner/onboarding">
              <Button size="lg" className="h-14 px-10 text-lg rounded-none bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">
                Add Your Fleet <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://files.manuscdn.com/user_upload_by_module/session_file/114974226/tXnyAZqAGDvSjOiN.jpg')] opacity-10 bg-cover bg-center mix-blend-overlay"></div>
        <div className="container relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Ready to move your business forward?</h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">Join the hundreds of businesses in Enugu who trust Apiamway for their daily logistics.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!isAuthenticated && (
              <Link href="/get-started">
                <Button
                  size="lg"
                  className="h-16 px-10 text-lg rounded-none bg-slate-900 text-white hover:bg-slate-800 border-none shadow-xl"
                >
                  Get Started Now
                </Button>
              </Link>
            )}
            <Link href="/contact">
              <Button size="lg" variant="outline" className="h-16 px-10 text-lg rounded-none border-slate-900 text-slate-900 hover:bg-slate-900/10 bg-transparent">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
