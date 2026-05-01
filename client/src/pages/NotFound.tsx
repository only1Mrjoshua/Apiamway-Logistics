import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-center px-4">
      <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 text-slate-400">
        <AlertTriangle className="w-12 h-12" />
      </div>
      <h1 className="text-4xl font-display font-bold mb-4 text-slate-900 dark:text-white">Page Not Found</h1>
      <p className="text-slate-600 dark:text-slate-400 max-w-md mb-8">
        The page you are looking for might have been moved, deleted, or possibly never existed.
      </p>
      <Link href="/">
        <Button size="lg" className="rounded-none">Return Home</Button>
      </Link>
    </div>
  );
}
