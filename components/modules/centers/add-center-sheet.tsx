"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type LocationOption = {
  id: number;
  name: string;
};

type CenterStatus = "ACTIVE" | "INACTIVE";
type ComplianceStatus = "pending" | "compliant" | "review_required";

type CenterForm = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  postalCode: string;
  countryId: string;
  stateId: string;
  cityId: string;
  totalCapacity: string;
  currentUtilization: string;
  complianceStatus: ComplianceStatus;
  status: CenterStatus;
};

const initialForm: CenterForm = {
  name: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  postalCode: "",
  countryId: "",
  stateId: "",
  cityId: "",
  totalCapacity: "0",
  currentUtilization: "0",
  complianceStatus: "pending",
  status: "ACTIVE",
};

async function readApiData<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || fallbackMessage);
  }

  return payload?.data as T;
}

export function AddCenterSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CenterForm>(initialForm);
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [states, setStates] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setIsLoadingCountries(true);

    fetch("/api/location-options/countries", { cache: "no-store" })
      .then((response) => readApiData<LocationOption[]>(response, "Failed to load countries."))
      .then((data) => {
        if (active) {
          setCountries(data ?? []);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load countries.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCountries(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!form.countryId) {
      setStates([]);
      setCities([]);
      setForm((prev) => (prev.stateId || prev.cityId ? { ...prev, stateId: "", cityId: "" } : prev));
      return;
    }

    let active = true;
    setIsLoadingStates(true);

    fetch(`/api/location-options/states?countryId=${encodeURIComponent(form.countryId)}`, { cache: "no-store" })
      .then((response) => readApiData<LocationOption[]>(response, "Failed to load states."))
      .then((data) => {
        if (!active) {
          return;
        }

        setStates(data ?? []);
        setForm((prev) => ((data ?? []).some((state) => String(state.id) === prev.stateId) ? prev : { ...prev, stateId: "", cityId: "" }));
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load states.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingStates(false);
        }
      });

    return () => {
      active = false;
    };
  }, [form.countryId, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!form.stateId) {
      setCities([]);
      setForm((prev) => (prev.cityId ? { ...prev, cityId: "" } : prev));
      return;
    }

    let active = true;
    setIsLoadingCities(true);

    fetch(`/api/location-options/cities?stateId=${encodeURIComponent(form.stateId)}`, { cache: "no-store" })
      .then((response) => readApiData<LocationOption[]>(response, "Failed to load cities."))
      .then((data) => {
        if (!active) {
          return;
        }

        setCities(data ?? []);
        setForm((prev) => ((data ?? []).some((city) => String(city.id) === prev.cityId) ? prev : { ...prev, cityId: "" }));
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load cities.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCities(false);
        }
      });

    return () => {
      active = false;
    };
  }, [form.stateId, open]);

  const selectedCountryName = useMemo(
    () => countries.find((country) => String(country.id) === form.countryId)?.name ?? "",
    [countries, form.countryId],
  );
  const selectedStateName = useMemo(
    () => states.find((state) => String(state.id) === form.stateId)?.name ?? "",
    [states, form.stateId],
  );
  const selectedCityName = useMemo(
    () => cities.find((city) => String(city.id) === form.cityId)?.name ?? "",
    [cities, form.cityId],
  );
  const addressSummary = useMemo(
    () => [form.addressLine1, form.addressLine2, form.landmark, selectedCityName, selectedStateName, selectedCountryName, form.postalCode]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", "),
    [form.addressLine1, form.addressLine2, form.landmark, form.postalCode, selectedCityName, selectedCountryName, selectedStateName],
  );

  const resetFlow = () => {
    setStep("form");
    setError(null);
    setForm(initialForm);
    setStates([]);
    setCities([]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const totalCapacity = Number(form.totalCapacity);
    const currentUtilization = Number(form.currentUtilization);

    if (!form.name.trim() || !form.addressLine1.trim() || !form.countryId || !form.stateId || !form.cityId) {
      setError("Complete the center name, address line 1, and location fields before continuing.");
      return;
    }

    if (!Number.isFinite(totalCapacity) || totalCapacity < 0 || !Number.isFinite(currentUtilization) || currentUtilization < 0) {
      setError("Capacity and current utilization must be valid numbers.");
      return;
    }

    if (currentUtilization > totalCapacity) {
      setError("Current utilization cannot exceed total capacity.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/centers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          landmark: form.landmark,
          postalCode: form.postalCode,
          countryId: Number(form.countryId),
          stateId: Number(form.stateId),
          cityId: Number(form.cityId),
          totalCapacity: Number(form.totalCapacity),
          currentUtilization: Number(form.currentUtilization),
          complianceStatus: form.complianceStatus,
          status: form.status,
        }),
      });

      await readApiData(response, "Failed to create center.");
      setStep("created");
      router.refresh();
      toast.success("Center created successfully.");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create center.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button>Add Center</Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Center</SheetTitle>
          <SheetDescription>Create a physical center with structured address details for batch campus selection.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="space-y-4 p-6" onSubmit={handleDone}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Center Name</label>
                <Input value={form.name} placeholder="GTS Main Campus" onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Address Line 1</label>
                <Input value={form.addressLine1} placeholder="Infopark Phase 1" onChange={(event) => setForm((prev) => ({ ...prev, addressLine1: event.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Address Line 2</label>
                <Input value={form.addressLine2} placeholder="Kakkanad" onChange={(event) => setForm((prev) => ({ ...prev, addressLine2: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Landmark</label>
                <Input value={form.landmark} placeholder="Near bus stop" onChange={(event) => setForm((prev) => ({ ...prev, landmark: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Postal Code</label>
                <Input value={form.postalCode} placeholder="682042" onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Country</label>
                <select className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400" value={form.countryId} onChange={(event) => setForm((prev) => ({ ...prev, countryId: event.target.value }))} disabled={isLoadingCountries || countries.length === 0}>
                  <option value="">{isLoadingCountries ? "Loading countries..." : countries.length === 0 ? "No countries available" : "Select a country"}</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>{country.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">State</label>
                <select className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400" value={form.stateId} onChange={(event) => setForm((prev) => ({ ...prev, stateId: event.target.value }))} disabled={!form.countryId || isLoadingStates || states.length === 0}>
                  <option value="">{!form.countryId ? "Select a country first" : isLoadingStates ? "Loading states..." : states.length === 0 ? "No states available" : "Select a state"}</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>{state.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">City</label>
                <select className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400" value={form.cityId} onChange={(event) => setForm((prev) => ({ ...prev, cityId: event.target.value }))} disabled={!form.stateId || isLoadingCities || cities.length === 0}>
                  <option value="">{!form.stateId ? "Select a state first" : isLoadingCities ? "Loading cities..." : cities.length === 0 ? "No cities available" : "Select a city"}</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Capacity</label>
                <Input type="number" min={0} value={form.totalCapacity} onChange={(event) => setForm((prev) => ({ ...prev, totalCapacity: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current Utilization</label>
                <Input type="number" min={0} value={form.currentUtilization} onChange={(event) => setForm((prev) => ({ ...prev, currentUtilization: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Compliance Status</label>
                <select className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700" value={form.complianceStatus} onChange={(event) => setForm((prev) => ({ ...prev, complianceStatus: event.target.value as ComplianceStatus }))}>
                  <option value="pending">Pending</option>
                  <option value="compliant">Compliant</option>
                  <option value="review_required">Review Required</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</label>
                <select className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as CenterStatus }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {addressSummary ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Address Preview:</span> {addressSummary}
              </div>
            ) : null}

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Done</Button>
            </SheetFooter>
          </form>
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-4 p-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Review the center details and click Create Center to finish setup.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900">Center:</span> {form.name.trim()}</p>
              <p><span className="font-semibold text-slate-900">Address:</span> {addressSummary || "Not set"}</p>
              <p><span className="font-semibold text-slate-900">Capacity:</span> {form.currentUtilization}/{form.totalCapacity}</p>
              <p><span className="font-semibold text-slate-900">Compliance:</span> {form.complianceStatus}</p>
              <p><span className="font-semibold text-slate-900">Status:</span> {form.status}</p>
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Center"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Center Created</p>
                <p className="text-sm text-blue-700">The center is now available in batch campus selection for offline batches.</p>
              </CardContent>
            </Card>

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}