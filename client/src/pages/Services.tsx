import { Button } from "@/components/ui/button";
import { ArrowRight, Box, ShieldCheck, Truck, Zap, Briefcase, Globe, Plane } from "lucide-react";
import { Link } from "wouter";

export default function Services() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://files.manuscdn.com/user_upload_by_module/session_file/114974226/tXnyAZqAGDvSjOiN.jpg')] opacity-20 bg-cover bg-center"></div>
        <div className="container relative z-10 text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">Our Logistics Solutions</h1>
          <p className="text-xl text-slate-300">
            Comprehensive delivery services tailored to the needs of individuals and businesses across Nigeria.
          </p>
        </div>
      </div>

      <div className="container max-w-5xl -mt-12 relative z-20 space-y-16">
        
        {/* Service 1: On-Demand */}
        <div className="bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 grid md:grid-cols-2 overflow-hidden group">
          <div className="p-8 md:p-12 flex flex-col justify-center">
            <div className="w-14 h-14 bg-primary/10 text-primary flex items-center justify-center mb-6">
              <Zap className="w-7 h-7" />
            </div>
            <h2 className="text-3xl font-display font-bold mb-4">On-Demand Courier</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Need it there now? Our on-demand fleet of electric bikes ensures your documents and small parcels move across the city in minutes, not hours.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm font-medium">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Pickup within 30 minutes
              </li>
              <li className="flex items-center gap-3 text-sm font-medium">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Real-time GPS tracking
              </li>
              <li className="flex items-center gap-3 text-sm font-medium">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Starting at just ₦1,800
              </li>
            </ul>
            <Link href="/request-delivery">
              <Button className="w-fit rounded-none">Book Now <ArrowRight className="ml-2 w-4 h-4" /></Button>
            </Link>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 h-64 md:h-auto relative overflow-hidden">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/114974226/ICoBIvHgAMSprTPB.jpg" 
              alt="Courier Bike" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          </div>
        </div>

        {/* Service 2: Air Express Inter-City */}
        <div className="bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 grid md:grid-cols-2 overflow-hidden group">
          <div className="bg-slate-100 dark:bg-slate-800 h-64 md:h-auto relative overflow-hidden order-2 md:order-1">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/114974226/czsvYxxOsPJYynGQ.jpg" 
              alt="Air Express Cargo" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute top-4 left-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 uppercase tracking-wider">
              New Service
            </div>
          </div>
          <div className="p-8 md:p-12 flex flex-col justify-center order-1 md:order-2">
            <div className="w-14 h-14 bg-primary/10 text-primary flex items-center justify-center mb-6">
              <Plane className="w-7 h-7" />
            </div>
            <h2 className="text-3xl font-display font-bold mb-4">Air Express Inter-City</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Fastest way to move packages between major cities. We leverage air cargo networks to ensure same-day or next-day delivery between Enugu, Lagos, Abuja, and Port Harcourt.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8">
               <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800">
                 <p className="text-xs font-bold text-slate-400 uppercase mb-1">Enugu ↔ Lagos</p>
                 <p className="font-bold text-primary">₦10,000<span className="text-xs text-slate-500 font-normal">/kg</span></p>
               </div>
               <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800">
                 <p className="text-xs font-bold text-slate-400 uppercase mb-1">Enugu ↔ Abuja</p>
                 <p className="font-bold text-primary">₦10,000<span className="text-xs text-slate-500 font-normal">/kg</span></p>
               </div>
               <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800 col-span-2">
                 <p className="text-xs font-bold text-slate-400 uppercase mb-1">Enugu ↔ Port Harcourt</p>
                 <p className="font-bold text-primary">₦6,000<span className="text-xs text-slate-500 font-normal">/kg</span></p>
               </div>
            </div>
            <Link href="/request-delivery">
              <Button variant="outline" className="w-fit rounded-none border-slate-300 dark:border-slate-700">Book Air Cargo</Button>
            </Link>
          </div>
        </div>

        {/* Service 3: Corporate */}
        <div className="bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 grid md:grid-cols-2 overflow-hidden group">
          <div className="p-8 md:p-12 flex flex-col justify-center">
            <div className="w-14 h-14 bg-primary/10 text-primary flex items-center justify-center mb-6">
              <Briefcase className="w-7 h-7" />
            </div>
            <h2 className="text-3xl font-display font-bold mb-4">Corporate Logistics</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Scalable logistics solutions for businesses. Whether you're an e-commerce store, a law firm, or a pharmacy, we become your dedicated delivery partner.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm font-medium">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Monthly retainer packages
              </li>
              <li className="flex items-center gap-3 text-sm font-medium">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Dedicated riders & branded options
              </li>
              <li className="flex items-center gap-3 text-sm font-medium">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Priority SLA & account management
              </li>
            </ul>
            <Link href="/contact">
              <Button className="w-fit rounded-none">Contact Sales <ArrowRight className="ml-2 w-4 h-4" /></Button>
            </Link>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 h-64 md:h-auto relative overflow-hidden flex items-center justify-center">
             <div className="text-center p-8">
               <Globe className="w-32 h-32 text-slate-300 mx-auto mb-4" />
               <p className="font-display font-bold text-slate-400">Enterprise Solutions</p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
