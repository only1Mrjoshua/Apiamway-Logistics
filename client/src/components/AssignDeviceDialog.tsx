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

interface AssignDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerCompanyId: number;
  onSuccess: () => void;
}

export function AssignDeviceDialog({
  open,
  onOpenChange,
  partnerCompanyId,
  onSuccess,
}: AssignDeviceDialogProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  const { data: devices, isLoading } = trpc.devices.list.useQuery({});
  const assignMutation = trpc.partners.assignDevice.useMutation({
    onSuccess: () => {
      toast.success("Device assigned successfully");
      onSuccess();
      onOpenChange(false);
      setSelectedDeviceId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to assign device");
    },
  });

  // Filter out devices already assigned to this or other partners
  const availableDevices = devices?.items?.filter(
    (device: any) => !device.partnerCompanyId || device.partnerCompanyId === null
  ) || [];

  const handleAssign = () => {
    if (!selectedDeviceId) {
      toast.error("Please select a device");
      return;
    }

    assignMutation.mutate({
      deviceId: selectedDeviceId,
      partnerCompanyId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Device to Partner</DialogTitle>
          <DialogDescription>
            Select an available device to assign to this partner company.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : availableDevices && availableDevices.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Device Name</TableHead>
                  <TableHead>Traccar ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableDevices.map((device: any) => (
                  <TableRow
                    key={device.id}
                    className={`cursor-pointer ${
                      selectedDeviceId === device.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedDeviceId(device.id)}
                  >
                    <TableCell>
                      <input
                        type="radio"
                        checked={selectedDeviceId === device.id}
                        onChange={() => setSelectedDeviceId(device.id)}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {device.traccarDeviceId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={device.status === "active" ? "default" : "secondary"}>
                        {device.status}
                      </Badge>
                    </TableCell>
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
                disabled={!selectedDeviceId || assignMutation.isPending}
              >
                {assignMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Assign Device
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No available devices. All devices are already assigned to partners.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
