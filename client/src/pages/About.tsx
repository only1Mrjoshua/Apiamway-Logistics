import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function About() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://files.manuscdn.com/user_upload_by_module/session_file/114974226/tXnyAZqAGDvSjOiN.jpg')] opacity-20 bg-cover bg-center"></div>
        <div className="container relative z-10 text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">About Apiamway</h1>
          <p className="text-xl text-slate-300">
            Building the digital infrastructure for Africa's logistics future.
          </p>
        </div>
      </div>

      <div className="container max-w-4xl py-16 space-y-16">
        
        {/* Mission */}
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h2 className="font-display font-bold text-3xl mb-6">Our Mission</h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
            Apiamway Logistics was founded with a singular vision: to bring order, speed, and reliability to the chaotic world of last-mile delivery in Nigeria. We believe that logistics is the backbone of any thriving economy. By combining modern electric vehicle technology with robust software infrastructure, we are creating a delivery network that businesses can rely on to scale.
          </p>
        </div>

        {/* Values Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-display font-bold text-xl mb-3 text-primary">Precision</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              We don't do "African time." We measure our performance in minutes and seconds, ensuring your package arrives exactly when promised.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-display font-bold text-xl mb-3 text-primary">Innovation</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              From electric bikes to real-time tracking algorithms, we leverage technology to solve old problems in new, efficient ways.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-display font-bold text-xl mb-3 text-primary">Integrity</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Trust is our currency. We treat every package as if it were our own, with full transparency and accountability at every step.
            </p>
          </div>
        </div>

        {/* Story */}
        <div className="bg-white dark:bg-slate-900 p-8 md:p-12 border border-slate-200 dark:border-slate-800 shadow-lg">
          <h2 className="font-display font-bold text-3xl mb-6">Our Story</h2>
          <div className="space-y-4 text-slate-600 dark:text-slate-400">
            <p>
              Starting in Enugu at our headquarters at 76 Zik Avenue, Uwani, we saw a gap in the market. While e-commerce was booming, the delivery infrastructure was lagging behind. Businesses struggled with unreliable riders, lost packages, and opaque pricing.
            </p>
            <p>
              Apiamway was born to bridge this gap. We started with a simple promise: <strong>Smart. Fast. Reliable.</strong>
            </p>
            <p>
              Today, we are growing into a nationwide network, connecting cities and empowering businesses to reach customers they never thought possible.
            </p>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
            <Link href="/contact">
               <Button className="rounded-none">Join Our Journey</Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
