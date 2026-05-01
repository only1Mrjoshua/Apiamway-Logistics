import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function WalletDetail() {
  const [match, params] = useRoute("/admin/wallets/:userId");
  const userId = params?.userId ? parseInt(params.userId) : null;

  const { data: walletsData } = trpc.wallet.getAllWallets.useQuery({ page: 1, pageSize: 1000 }); // Get all for detail lookup
  const wallet = walletsData?.items?.find((w: any) => w.userId === userId);

  // For transactions, we need to get them by wallet ID
  // Since we don't have direct access to wallet ID from getAllWallets, we'll skip transactions for now
  // In a real implementation, you'd add a separate endpoint or modify getAllWallets to include wallet ID

  if (!match || !userId || !wallet) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Wallet not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/wallets">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{wallet.userName || "User"}'s Wallet</h1>
          <p className="text-slate-500 mt-1">{wallet.userEmail || "No email"}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₦{parseFloat(wallet.balance).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Total Credited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ₦{parseFloat(wallet.totalCredited).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              Total Debited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              ₦{parseFloat(wallet.totalDebited).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-500 py-8">
            Transaction history view coming soon. Use the main Wallets page to view all transactions.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
