import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Building2 } from "lucide-react";

export default function NewPartner() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    commissionType: "percentage" as "percentage" | "flat",
    commissionValue: "70",
  });

  const createMutation = trpc.partners.create.useMutation({
    onSuccess: () => {
      toast.success("Partner created successfully");
      setLocation("/admin/partners");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create partner");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate commission value
    const commissionNum = parseFloat(formData.commissionValue);
    if (isNaN(commissionNum) || commissionNum < 0) {
      toast.error("Commission value must be a positive number");
      return;
    }

    if (formData.commissionType === "percentage" && commissionNum > 100) {
      toast.error("Commission percentage cannot exceed 100%");
      return;
    }

    createMutation.mutate({
      name: formData.name,
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      contactEmail: formData.contactEmail || undefined,
      commissionType: formData.commissionType,
      commissionValue: commissionNum,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/admin/partners")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Partner</h1>
          <p className="text-muted-foreground">
            Register a new partner fleet provider
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Partner Information
          </CardTitle>
          <CardDescription>
            Enter the details of the partner company. Partners will need
            approval before they can start providing fleet services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Company Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Swift Logistics Ltd"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    required
                    value={formData.contactName}
                    onChange={(e) =>
                      setFormData({ ...formData, contactName: e.target.value })
                    }
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone *</Label>
                  <Input
                    id="contactPhone"
                    required
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactPhone: e.target.value,
                      })
                    }
                    placeholder="+234 801 234 5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactEmail: e.target.value,
                      })
                    }
                    placeholder="contact@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Commission Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Commission Structure</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commissionType">Commission Type *</Label>
                  <Select
                    value={formData.commissionType}
                    onValueChange={(value: "percentage" | "flat") =>
                      setFormData({ ...formData, commissionType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">
                        Percentage (% of order value)
                      </SelectItem>
                      <SelectItem value="flat">
                        Flat (fixed amount per order)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.commissionType === "percentage"
                      ? "Partner receives a percentage of each order value"
                      : "Apiamway takes a fixed amount, partner gets the rest"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionValue">
                    {formData.commissionType === "percentage"
                      ? "Partner Percentage *"
                      : "Apiamway Flat Fee *"}
                  </Label>
                  <div className="relative">
                    {formData.commissionType === "flat" && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        ₦
                      </span>
                    )}
                    <Input
                      id="commissionValue"
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      max={formData.commissionType === "percentage" ? "100" : undefined}
                      value={formData.commissionValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commissionValue: e.target.value,
                        })
                      }
                      placeholder={
                        formData.commissionType === "percentage"
                          ? "70"
                          : "3000"
                      }
                      className={
                        formData.commissionType === "flat" ? "pl-7" : ""
                      }
                    />
                    {formData.commissionType === "percentage" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.commissionType === "percentage"
                      ? `Partner earns ${formData.commissionValue}% of each order, Apiamway earns ${100 - parseFloat(formData.commissionValue || "0")}%`
                      : `Apiamway earns ₦${formData.commissionValue} per order, partner earns the rest`}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/admin/partners")}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Partner"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
