import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Package, MapPin, Phone, Mail, Facebook, Linkedin, Twitter, Wallet, Gift, LogOut, UserCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { data: fleetOwnerApp } = trpc.fleetOwner.getApplicationStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Logged out successfully");
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message || "Logout failed");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getMyAccountUrl = () => {
    if (fleetOwnerApp?.status === "approved") {
      return "/fleet-owner/dashboard";
    } else if (fleetOwnerApp?.status === "pending") {
      return "/fleet-owner/status";
    }
    return "/orders"; // Default for shippers
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Navbar */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent",
          scrolled ? "bg-background/90 backdrop-blur-md border-border py-3 shadow-lg" : "bg-transparent py-5"
        )}
      >
        <div className="container flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-none flex items-center justify-center text-primary-foreground font-bold font-display text-xl group-hover:scale-105 transition-transform">
              A
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              Apiamway
            </span>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/services" className="text-sm font-medium hover:text-primary transition-colors">Services</Link>
            <Link href="/about" className="text-sm font-medium hover:text-primary transition-colors">About Us</Link>
            <Link href="/contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/wallet">
                  <Button variant="ghost" size="sm" className="text-foreground hover:text-primary hover:bg-primary/10">
                    <Wallet className="w-4 h-4 mr-2" />
                    Finance
                  </Button>
                </Link>
                <Link href="/referral">
                  <Button variant="ghost" size="sm" className="text-foreground hover:text-primary hover:bg-primary/10">
                    <Gift className="w-4 h-4 mr-2" />
                    Referral
                  </Button>
                </Link>
                {fleetOwnerApp?.status === "approved" && (
                  <Link href="/fleet-owner/dashboard">
                    <Button variant="ghost" size="sm" className="text-foreground hover:text-primary hover:bg-primary/10">
                      Fleet Dashboard
                    </Button>
                  </Link>
                )}
                {fleetOwnerApp?.status === "pending" && (
                  <Link href="/fleet-owner/status">
                    <Button variant="ghost" size="sm" className="text-foreground hover:text-primary hover:bg-primary/10">
                      Fleet Status
                    </Button>
                  </Link>
                )}
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="text-foreground hover:text-primary hover:bg-primary/10">
                    <UserCircle className="w-4 h-4 mr-2" />
                    My Account
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="text-foreground hover:text-primary hover:bg-primary/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {logoutMutation.isPending ? "Logging out..." : "Logout"}
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="ghost" className="text-foreground hover:text-primary hover:bg-primary/10">
                  Login
                </Button>
              </Link>
            )}
            <Link href="/track">
              <Button variant="ghost" className="text-foreground hover:text-primary hover:bg-primary/10">
                Track Package
              </Button>
            </Link>
            <Link href="/request-delivery">
              <Button className="rounded-none font-medium shadow-md hover:shadow-lg transition-all">
                Request Delivery
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background pt-24 px-6 md:hidden animate-in slide-in-from-top-10 fade-in duration-200">
          <nav className="flex flex-col gap-6 text-lg font-display font-medium">
            <Link href="/" className="border-b border-border pb-4">Home</Link>
            <Link href="/services" className="border-b border-border pb-4">Services</Link>
            <Link href="/about" className="border-b border-border pb-4">About Us</Link>
            <Link href="/contact" className="border-b border-border pb-4">Contact</Link>
            {isAuthenticated ? (
              <>
                <Link href="/wallet" className="flex items-center gap-2 text-primary border-b border-border pb-4">
                  <Wallet size={20} /> Finance
                </Link>
                <Link href="/referral" className="flex items-center gap-2 text-primary border-b border-border pb-4">
                  <Gift size={20} /> Referral
                </Link>
                {fleetOwnerApp?.status === "approved" && (
                  <Link href="/fleet-owner/dashboard" className="flex items-center gap-2 text-primary border-b border-border pb-4">
                    Fleet Dashboard
                  </Link>
                )}
                {fleetOwnerApp?.status === "pending" && (
                  <Link href="/fleet-owner/status" className="flex items-center gap-2 text-primary border-b border-border pb-4">
                    Fleet Status
                  </Link>
                )}
                <Link href="/profile" className="flex items-center gap-2 text-primary border-b border-border pb-4">
                  <UserCircle size={20} /> My Account
                </Link>
                <button 
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="flex items-center gap-2 text-primary border-b border-border pb-4 text-left"
                >
                  <LogOut size={20} /> {logoutMutation.isPending ? "Logging out..." : "Logout"}
                </button>
              </>
            ) : (
              <Link href="/login" className="border-b border-border pb-4">
                Login
              </Link>
            )}
            <Link href="/track" className="flex items-center gap-2 text-primary border-b border-border pb-4">
              <Package size={20} /> Track Package
            </Link>
            <Link href="/request-delivery">
              <Button className="w-full mt-4 rounded-none text-lg py-6">
                Request Delivery
              </Button>
            </Link>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow pt-20">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900 relative overflow-hidden">
        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-10 pointer-events-none"></div>
        
        <div className="container relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-white mb-4">
                <div className="w-6 h-6 bg-primary flex items-center justify-center text-primary-foreground font-bold font-display text-sm">
                  A
                </div>
                <span className="font-display font-bold text-lg tracking-tight">
                  Apiamway
                </span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">
                Next-generation logistics for Nigeria's modern economy. Smart, fast, and reliable delivery solutions powered by technology.
              </p>
              <div className="mt-6 space-y-2 text-xs">
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Operating in Enugu</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Weekly payouts for fleet owners</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Customer support available Mon-Sat</span>
                </p>
              </div>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-white font-display font-bold mb-6">Services</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/services" className="hover:text-primary transition-colors">On-Demand Courier</Link></li>
                <li><Link href="/services" className="hover:text-primary transition-colors">Inter-City Shipping</Link></li>
                <li><Link href="/services" className="hover:text-primary transition-colors">Corporate Logistics</Link></li>
                <li><Link href="/services" className="hover:text-primary transition-colors">E-commerce Fulfillment</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-display font-bold mb-6">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/about" className="hover:text-primary transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
                <li><Link href="/terms" className="hover:text-primary transition-colors">Terms & Conditions</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            {/* Connect */}
            <div>
              <h4 className="text-white font-display font-bold mb-6">Connect</h4>
              <div className="flex gap-4 mb-6">
                <a href="#" className="w-10 h-10 rounded-none border border-slate-800 flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"><Twitter size={18} /></a>
                <a href="#" className="w-10 h-10 rounded-none border border-slate-800 flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"><Facebook size={18} /></a>
                <a href="#" className="w-10 h-10 rounded-none border border-slate-800 flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"><Linkedin size={18} /></a>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-primary mt-1" />
                  <span>76 Zik Avenue, Beside Ohafia Bus Stop, Uwani, Enugu</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-primary" />
                  <span>0803 348 5885</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-primary" />
                  <span>contactus@apiamway.com</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            <p>&copy; 2026 Apiamway Logistics. All rights reserved.</p>
            <p className="flex items-center gap-1 opacity-50">
              Built with precision <span className="text-primary">•</span> Enugu
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
