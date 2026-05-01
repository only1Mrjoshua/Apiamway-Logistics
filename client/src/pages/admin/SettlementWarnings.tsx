import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/Pagination";
import { AlertTriangle } from "lucide-react";

const PAGE_SIZE = 20;

function earningStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    credited: "default",
    paid_out: "default",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    credited: "Credited",
    paid_out: "Paid Out",
  };
  return (
    <Badge variant={variants[status] ?? "outline"}>
      {labels[status] ?? status}
    </Badge>
  );
}

export default function SettlementWarnings() {
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading } = trpc.partners.listWarnings.useQuery(
    { page: currentPage, pageSize: PAGE_SIZE },
    { refetchOnWindowFocus: false }
  );

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settlement Warnings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Orders that were cancelled after settlement already ran. These earnings are NOT voided — review and take action as needed.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Cancelled Orders with Settlement Records
              </CardTitle>
              <CardDescription className="mt-1">
                {totalCount > 0
                  ? `${totalCount} warning${totalCount === 1 ? "" : "s"} found`
                  : "No settlement warnings found"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No settlement warnings found</p>
              <p className="text-muted-foreground/70 text-sm mt-1">
                All settled orders are in a valid delivered state.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking Number</TableHead>
                      <TableHead>Fleet Owner</TableHead>
                      <TableHead className="text-right">Gross (₦)</TableHead>
                      <TableHead className="text-right">Commission (%)</TableHead>
                      <TableHead className="text-right">Payout (₦)</TableHead>
                      <TableHead>Order Status</TableHead>
                      <TableHead>Cancelled At</TableHead>
                      <TableHead>Settlement Created</TableHead>
                      <TableHead>Earning Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.earningId} className="bg-amber-50/30 dark:bg-amber-950/10">
                        <TableCell className="font-mono text-sm font-medium">
                          {row.trackingNumber ?? "—"}
                        </TableCell>
                        <TableCell>{row.fleetOwnerName ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(row.orderPrice).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(row.commissionPercentage).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-700 dark:text-green-400 font-semibold">
                          {Number(row.partnerAmount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {row.orderStatus ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.cancelledAt
                            ? new Date(row.cancelledAt).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(row.earningCreatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {earningStatusBadge(row.earningStatus)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={PAGE_SIZE}
                    onPageChange={setCurrentPage}
                    itemName="warnings"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
