import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapView } from "@/components/Map";
import { Mail, MapPin, Phone } from "lucide-react";

export default function Contact() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="container max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-display font-bold mb-4 text-slate-900 dark:text-white">Contact Us</h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Have questions about our services or need support with a delivery? Our team is ready to assist you.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Contact Info & Map */}
          <div className="space-y-8">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary/50 transition-colors group">
                <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-2">Phone / WhatsApp</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Mon-Sat from 8am to 6pm</p>
                <a href="tel:08033485885" className="font-mono font-bold text-primary hover:underline">0803 348 5885</a>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary/50 transition-colors group">
                <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-2">Email</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Online support 24/7</p>
                <a href="mailto:contactus@apiamway.com" className="font-mono font-bold text-primary hover:underline">contactus@apiamway.com</a>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Head Office</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    76 Zik Avenue,<br />
                    Beside Ohafia Bus Stop,<br />
                    Uwani, Enugu.
                  </p>
                </div>
              </div>
              
              <div className="h-[300px] w-full bg-slate-100 border border-slate-200 dark:border-slate-700">
                <MapView className="w-full h-full" />
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 shadow-lg">
            <h2 className="text-2xl font-display font-bold mb-6">Send us a message</h2>
            <form className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input placeholder="John" className="rounded-none bg-slate-50 dark:bg-slate-950" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input placeholder="Doe" className="rounded-none bg-slate-50 dark:bg-slate-950" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" placeholder="john@example.com" className="rounded-none bg-slate-50 dark:bg-slate-950" />
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Input placeholder="Tracking Inquiry, Partnership, etc." className="rounded-none bg-slate-50 dark:bg-slate-950" />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea placeholder="How can we help you today?" className="min-h-[150px] rounded-none bg-slate-50 dark:bg-slate-950" />
              </div>

              <Button type="submit" className="w-full h-12 rounded-none bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                Send Message
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
