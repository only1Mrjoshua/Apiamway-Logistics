import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Facebook } from "lucide-react";

export default function Login() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-0 shadow-xl rounded-none">
        <CardHeader className="text-center space-y-3">
          <Link href="/" className="mx-auto flex items-center justify-center gap-2">
            <div className="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
              A
            </div>
            <span className="font-display font-bold text-2xl">Apiamway</span>
          </Link>

          <CardTitle className="text-2xl font-bold">
            Welcome back
          </CardTitle>

          <CardDescription>
            Sign in to continue to your Apiamway account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <a href="/api/auth/google" className="block">
            <Button
              variant="outline"
              className="w-full h-12 rounded-none text-base"
            >
              <span className="mr-3 font-bold text-lg">G</span>
              Continue with Google
            </Button>
          </a>

          <a href="/api/auth/facebook" className="block">
            <Button
              className="w-full h-12 rounded-none text-base bg-[#1877F2] hover:bg-[#166FE5] text-white"
            >
              <Facebook className="mr-3 w-5 h-5" />
              Continue with Facebook
            </Button>
          </a>

          <p className="text-xs text-center text-slate-500 pt-4">
            By continuing, you agree to Apiamway&apos;s{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>

          <div className="text-center pt-2">
            <Link href="/" className="text-sm text-primary hover:underline">
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}