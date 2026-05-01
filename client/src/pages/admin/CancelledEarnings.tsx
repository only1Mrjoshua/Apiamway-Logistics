import { useState, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { AlertTriangle, Ban, Trash2, Eye, Download, CheckSquare, BarChart2 } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const VOID_REASON_PRESETS = [
  "Order cancelled before pickup",
  "Duplicate order",
  "Customer dispute",
  "Payment issue",
  "Test order",
  "Other",
] as const;

export default function CancelledEarnings() {
  const [currentPage, setCurrentPage] = useState(1);
  const [showVoided, setShowVoided] = useState(false);

  // ── Single-void state ──────────────────────────────────────────────────────
  const [voidTarget, setVoidTarget] = useState<{
    earningId: number;
    trackingNumber: string | null;
    fleetOwnerName: string | null;
  } | null>(null);
  const [voidReasonPreset, setVoidReasonPreset] = useState("");
  const [voidReasonOther, setVoidReasonOther] = useState("");

  // ── Bulk-void state ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkReasonPreset, setBulkReasonPreset] = useState("");
  const [bulkReasonOther, setBulkReasonOther] = useState("");

  const [isExporting, setIsExporting] = useState(false);

  const utils = trpc.useUtils();

  const { data: voidReasonData, isLoading: isVoidReasonLoading } = trpc.partners.voidReasonCounts.useQuery();

  const { data, isLoading } = trpc.partners.listCancelledEarnings.useQuery({
    page: currentPage,
    pageSize: PAGE_SIZE,
    includeVoided: showVoided,
  });

  const exportQuery = trpc.partners.exportCancelledEarnings.useQuery(
    { includeVoided: showVoided },
    { enabled: false }
  );

  type EarningRow = NonNullable<typeof data>["items"][number];
  const items: EarningRow[] = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Only pending rows on the current page are selectable
  const selectableIds = useMemo(
    () => items.filter((e) => e.earningStatus === "pending").map((e) => e.earningId),
    [items]
  );

  const pendingCount = items.filter((e) => e.earningStatus === "pending").length;
  const voidedCount = items.filter((e) => e.earningStatus === "voided").length;

  const totalPayout = items
    .filter((e) => e.earningStatus === "pending")
    .reduce((sum: number, e: EarningRow) => sum + Number(e.partnerAmount), 0);
  const totalGross = items
    .filter((e) => e.earningStatus === "pending")
    .reduce((sum: number, e: EarningRow) => sum + Number(e.orderPrice), 0);

  // ── Derived reason helpers ─────────────────────────────────────────────────
  const resolvedVoidReason =
    voidReasonPreset === "Other" ? voidReasonOther.trim() : voidReasonPreset;
  const isVoidReasonValid =
    voidReasonPreset !== "" &&
    (voidReasonPreset !== "Other" || voidReasonOther.trim().length > 0);

  const resolvedBulkReason =
    bulkReasonPreset === "Other" ? bulkReasonOther.trim() : bulkReasonPreset;
  const isBulkReasonValid =
    bulkReasonPreset !== "" &&
    (bulkReasonPreset !== "Other" || bulkReasonOther.trim().length > 0);

  // ── Checkbox helpers ───────────────────────────────────────────────────────
  const allPageSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id));

  const somePageSelected =
    selectableIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        selectableIds.forEach((id) => next.add(id));
      } else {
        selectableIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Reset selection when page or toggle changes
  const handleToggleVoided = (checked: boolean) => {
    setShowVoided(checked);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedIds(new Set());
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const voidMutation = trpc.partners.voidEarning.useMutation({
    onSuccess: () => {
      toast.success(
        `Earning for ${voidTarget?.trackingNumber ?? "order"} has been voided and removed from the pending queue.`
      );
      setVoidTarget(null);
      setVoidReasonPreset("");
      setVoidReasonOther("");
      utils.partners.listCancelledEarnings.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const bulkVoidMutation = trpc.partners.bulkVoidEarnings.useMutation({
    onSuccess: (result) => {
      const { voidedCount, skipped } = result;
      if (voidedCount > 0) {
        toast.success(
          `${voidedCount} earning${voidedCount !== 1 ? "s" : ""} voided successfully.` +
            (skipped.length > 0 ? ` ${skipped.length} skipped (see console).` : "")
        );
      } else {
        toast.warning("No earnings were voided. They may have already been processed.");
      }
      setBulkDialogOpen(false);
      setBulkReasonPreset("");
      setBulkReasonOther("");
      setSelectedIds(new Set());
      utils.partners.listCancelledEarnings.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleVoidClick = (earning: EarningRow) => {
    setVoidTarget({
      earningId: earning.earningId,
      trackingNumber: earning.trackingNumber,
      fleetOwnerName: earning.fleetOwnerName,
    });
    setVoidReasonPreset("");
    setVoidReasonOther("");
  };

  const handleVoidConfirm = () => {
    if (!voidTarget || !isVoidReasonValid) return;
    voidMutation.mutate({ earningId: voidTarget.earningId, reason: resolvedVoidReason });
  };

  const handleBulkVoidOpen = () => {
    setBulkReasonPreset("");
    setBulkReasonOther("");
    setBulkDialogOpen(true);
  };

  const handleBulkVoidConfirm = () => {
    if (!isBulkReasonValid || selectedIds.size === 0) return;
    bulkVoidMutation.mutate({
      earningIds: Array.from(selectedIds),
      reason: resolvedBulkReason,
    });
  };

  const handleDownloadCsv = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      const rows = result.data ?? [];
      const headers = [
        "Tracking Number", "Fleet Owner", "Gross (NGN)", "Commission (NGN)",
        "Payout (NGN)", "Earning Status", "Cancelled At", "Voided At",
        "Voided By (User ID)", "Void Reason",
      ];
      const escape = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const csvRows = rows.map((e) => {
        const gross = Number(e.orderPrice);
        const payout = Number(e.partnerAmount);
        const commission = gross - payout;
        return [
          escape(e.trackingNumber),
          escape(e.fleetOwnerName ?? `ID ${e.partnerCompanyId}`),
          escape(gross), escape(commission), escape(payout),
          escape(e.earningStatus),
          escape(e.cancelledAt ? new Date(e.cancelledAt).toISOString() : null),
          escape(e.voidedAt ? new Date(e.voidedAt).toISOString() : null),
          escape(e.voidedBy), escape(e.voidReason),
        ].join(",");
      });
      const csvContent = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `cancelled-earnings-${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} row${rows.length !== 1 ? "s" : ""} to CSV`);
    } catch {
      toast.error("Failed to export CSV. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
          <Ban className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Cancelled Order Earnings</h1>
          <p className="text-muted-foreground mt-1">
            Earnings whose linked order was cancelled. Pending earnings are blocked from the weekly
            payout and require manual review. Use "Void" to permanently mark an earning as resolved —
            the record is preserved for audit purposes.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stranded Earnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {showVoided
                ? `${pendingCount} pending · ${voidedCount} voided`
                : "pending records"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gross (Blocked)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalGross.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">pending only, this page</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payout (Blocked)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalPayout.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">pending only, this page</p>
          </CardContent>
        </Card>
      </div>

      {/* Void Reason Analytics Tile */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-sm font-medium">Void Reason Breakdown</CardTitle>
            <CardDescription className="text-xs mt-0.5">All-time counts by reason (voided earnings only)</CardDescription>
          </div>
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isVoidReasonLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : !voidReasonData || voidReasonData.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No void reason data yet</p>
          ) : (
            <ul className="space-y-2">
              {voidReasonData.map((item) => (
                <li key={item.reason} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-foreground truncate" title={item.reason}>
                    {item.reason}
                  </span>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>
                {showVoided ? "All Cancelled-Order Earnings" : "Earnings Pending Review"}
              </CardTitle>
              <CardDescription className="mt-1">
                {showVoided
                  ? "Showing pending and voided earnings. Voided rows are preserved for audit purposes."
                  : "Void an earning to permanently mark it as resolved. The record is preserved for audit purposes."}
              </CardDescription>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
              {/* Bulk Void Selected button — only shown when rows are selected */}
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkVoidOpen}
                  disabled={bulkVoidMutation.isPending}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Void Selected ({selectedIds.size})
                </Button>
              )}

              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="show-voided-toggle" className="text-sm font-medium cursor-pointer">
                  Show Voided
                </Label>
                <Switch
                  id="show-voided-toggle"
                  checked={showVoided}
                  onCheckedChange={handleToggleVoided}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCsv}
                disabled={isExporting}
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? "Exporting…" : "Download CSV"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading cancelled-order earnings…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
              <Ban className="w-10 h-10 text-muted-foreground/40" />
              <p className="font-medium">
                {showVoided
                  ? "No cancelled-order earnings found"
                  : "No cancelled-order earnings pending review"}
              </p>
              <p className="text-sm">
                {showVoided
                  ? "No pending or voided earnings linked to cancelled orders."
                  : "All pending earnings are linked to valid delivered orders."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Select-all header checkbox — only pending rows are selectable */}
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allPageSelected}
                        data-indeterminate={somePageSelected}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Select all pending rows on this page"
                        disabled={selectableIds.length === 0}
                        className={somePageSelected ? "opacity-60" : undefined}
                      />
                    </TableHead>
                    <TableHead>Tracking #</TableHead>
                    <TableHead>Fleet Owner</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Payout</TableHead>
                    <TableHead>Cancelled At</TableHead>
                    <TableHead>Earning Status</TableHead>
                    {showVoided && (
                      <>
                        <TableHead>Voided At</TableHead>
                        <TableHead>Void Reason</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((earning: EarningRow) => {
                    const gross = Number(earning.orderPrice);
                    const payout = Number(earning.partnerAmount);
                    const commission = gross - payout;
                    const isVoided = earning.earningStatus === "voided";
                    const isSelected = selectedIds.has(earning.earningId);

                    return (
                      <TableRow
                        key={earning.earningId}
                        className={
                          isVoided
                            ? "opacity-60"
                            : isSelected
                            ? "bg-destructive/5"
                            : undefined
                        }
                      >
                        {/* Per-row checkbox — disabled for voided rows */}
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectRow(earning.earningId, !!checked)
                            }
                            disabled={isVoided}
                            aria-label={`Select earning ${earning.trackingNumber ?? earning.earningId}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {earning.trackingNumber ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {earning.fleetOwnerName ?? `ID ${earning.partnerCompanyId}`}
                        </TableCell>
                        <TableCell className="text-right">
                          ₦{gross.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ₦{commission.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₦{payout.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {earning.cancelledAt
                            ? new Date(earning.cancelledAt).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isVoided ? "outline" : "secondary"}>
                            {earning.earningStatus}
                          </Badge>
                        </TableCell>

                        {showVoided && (
                          <>
                            <TableCell className="text-sm text-muted-foreground">
                              {earning.voidedAt
                                ? new Date(earning.voidedAt).toLocaleString()
                                : "—"}
                            </TableCell>
                            <TableCell
                              className="text-sm text-muted-foreground max-w-[200px] truncate"
                              title={earning.voidReason ?? undefined}
                            >
                              {earning.voidReason ?? "—"}
                            </TableCell>
                          </>
                        )}

                        <TableCell className="text-right">
                          {!isVoided ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleVoidClick(earning)}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Void
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Voided</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && items.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          itemName="earnings"
        />
      )}

      {/* ── Single Void Confirmation Dialog ──────────────────────────────── */}
      <Dialog
        open={!!voidTarget}
        onOpenChange={(open) => {
          if (!open) {
            setVoidTarget(null);
            setVoidReasonPreset("");
            setVoidReasonOther("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Void Earning
            </DialogTitle>
            <DialogDescription>
              This will permanently mark the earning for{" "}
              <span className="font-mono font-semibold">
                {voidTarget?.trackingNumber ?? "this order"}
              </span>{" "}
              ({voidTarget?.fleetOwnerName ?? "Fleet Owner"}) as <strong>voided</strong>.
              The record is preserved for audit purposes and will be removed from the pending queue.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="void-reason-preset" className="text-sm font-medium">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Select
                value={voidReasonPreset}
                onValueChange={(val) => {
                  setVoidReasonPreset(val);
                  if (val !== "Other") setVoidReasonOther("");
                }}
              >
                <SelectTrigger id="void-reason-preset">
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {VOID_REASON_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {preset}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {voidReasonPreset === "Other" && (
              <div className="space-y-2">
                <Label htmlFor="void-reason-other" className="text-sm font-medium">
                  Please specify <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="void-reason-other"
                  placeholder="Describe the reason for voiding this earning…"
                  value={voidReasonOther}
                  onChange={(e) => setVoidReasonOther(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {voidReasonOther.length}/500
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setVoidTarget(null);
                setVoidReasonPreset("");
                setVoidReasonOther("");
              }}
              disabled={voidMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoidConfirm}
              disabled={voidMutation.isPending || !isVoidReasonValid}
            >
              {voidMutation.isPending ? "Voiding…" : "Confirm Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Void Confirmation Dialog ─────────────────────────────────── */}
      <Dialog
        open={bulkDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDialogOpen(false);
            setBulkReasonPreset("");
            setBulkReasonOther("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <CheckSquare className="w-5 h-5" />
              Bulk Void {selectedIds.size} Earning{selectedIds.size !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              This will permanently mark <strong>{selectedIds.size}</strong> selected earning
              {selectedIds.size !== 1 ? "s" : ""} as <strong>voided</strong>. The same reason will
              be applied to all selected earnings. Records are preserved for audit purposes and will
              be removed from the pending queue. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-void-reason-preset" className="text-sm font-medium">
                Reason (applied to all) <span className="text-destructive">*</span>
              </Label>
              <Select
                value={bulkReasonPreset}
                onValueChange={(val) => {
                  setBulkReasonPreset(val);
                  if (val !== "Other") setBulkReasonOther("");
                }}
              >
                <SelectTrigger id="bulk-void-reason-preset">
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {VOID_REASON_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {preset}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bulkReasonPreset === "Other" && (
              <div className="space-y-2">
                <Label htmlFor="bulk-void-reason-other" className="text-sm font-medium">
                  Please specify <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="bulk-void-reason-other"
                  placeholder="Describe the reason for voiding these earnings…"
                  value={bulkReasonOther}
                  onChange={(e) => setBulkReasonOther(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bulkReasonOther.length}/500
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBulkDialogOpen(false);
                setBulkReasonPreset("");
                setBulkReasonOther("");
              }}
              disabled={bulkVoidMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkVoidConfirm}
              disabled={bulkVoidMutation.isPending || !isBulkReasonValid}
            >
              {bulkVoidMutation.isPending
                ? "Voiding…"
                : `Void ${selectedIds.size} Earning${selectedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
