import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Gift, Copy, Users, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Referral() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);

  const { data: referralCode, isLoading: codeLoading } = trpc.referrals.getMyCode.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: stats, isLoading: statsLoading } = trpc.referrals.getMyStats.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const referralLink = referralCode?.code
    ? `${window.location.origin}/?ref=${referralCode.code}`
    : "";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Redirect to login if not authenticated (in useEffect to avoid render-phase side effects)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  if (!authLoading && !isAuthenticated) {
    return null;
  }

  if (authLoading || codeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            ← Back to Home
          </Button>
          <h1 className="text-3xl font-display font-bold mb-2">Referral Program</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Invite friends and earn rewards for every successful delivery
          </p>
        </div>

        {/* Referral Code Card */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Your Referral Code
            </CardTitle>
            <CardDescription>
              Share this code with friends to earn ₦500 bonus after their first paid delivery
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Referral Code */}
            <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">
                Your Code
              </p>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-mono font-bold text-primary">
                  {referralCode?.code || "Loading..."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(referralCode?.code || "")}
                  disabled={!referralCode?.code}
                  className="rounded-none"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Code
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Referral Link */}
            <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">
                Referral Link
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(referralLink)}
                  disabled={!referralLink}
                  className="rounded-none"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-2xl font-bold text-primary">
                  {stats?.total || 0}
                </p>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Referrals
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-2xl font-bold text-primary">
                  ₦{((stats?.totalEarned || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Total Earned
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Share your referral code or link</p>
                  <p className="text-sm text-slate-500">
                    Send it to friends, family, or post on social media
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">They sign up and book their first delivery</p>
                  <p className="text-sm text-slate-500">
                    New users must complete at least one paid delivery
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">You both get rewarded!</p>
                  <p className="text-sm text-slate-500">
                    ₦500 bonus credited to your wallet automatically
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Referrals List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Referrals
            </CardTitle>
            <CardDescription>People who signed up using your code</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : stats && stats.referrals && stats.referrals.length > 0 ? (
              <div className="space-y-3">
                {stats.referrals.map((referral: any) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {referral.referredUser?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-medium">
                          {referral.referredUser?.name || "Anonymous User"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Joined {new Date(referral.createdAt).toLocaleDateString('en-NG', {
                            dateStyle: 'medium',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {referral.bonusCredited ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm font-medium">₦500 Earned</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          Pending first delivery
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No referrals yet</p>
                <p className="text-sm text-slate-400 mt-2">
                  Start sharing your code to earn rewards
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
