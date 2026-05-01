import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AssignRiderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerCompanyId: number;
  onSuccess: () => void;
}

export function AssignRiderDialog({
  open,
  onOpenChange,
  partnerCompanyId,
  onSuccess,
}: AssignRiderDialogProps) {
  const [selectedRiderId, setSelectedRiderId] = useState<number | null>(null);

  const { data: riders, isLoading } = trpc.riders.list.useQuery({});
  const assignMutation = trpc.partners.assignRider.useMutation({
    onSuccess: () => {
      toast.success("Rider assigned successfully");
      onSuccess();
      onOpenChange(false);
      setSelectedRiderId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign rider");
    },
  });

  // Filter out riders already assigned to this or other partners
  const availableRiders = riders?.items?.filter(
    (rider: any) => !rider.partnerCompanyId || rider.partnerCompanyId === null
  ) || [];

  const handleAssign = () => {
    if (!selectedRiderId) {
      toast.error("Please select a rider");
      return;
    }

    assignMutation.mutate({
      riderId: selectedRiderId,
      partnerCompanyId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Rider to Partner</DialogTitle>
          <DialogDescription>
            Select an available rider to assign to this partner company.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : availableRiders && availableRiders.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hub</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableRiders.map((rider: any) => (
                  <TableRow
                    key={rider.id}
                    className={`cursor-pointer ${
                      selectedRiderId === rider.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedRiderId(rider.id)}
                  >
                    <TableCell>
                      <input
                        type="radio"
                        checked={selectedRiderId === rider.id}
                        onChange={() => setSelectedRiderId(rider.id)}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{rider.name}</TableCell>
                    <TableCell>{rider.phone}</TableCell>
                    <TableCell>
                      <Badge variant={rider.status === "active" ? "default" : "secondary"}>
                        {rider.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{rider.assignedHub || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedRiderId || assignMutation.isPending}
              >
                {assignMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Assign Rider
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No available riders. All riders are already assigned to partners.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
