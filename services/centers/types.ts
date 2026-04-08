export type CenterStatus = "ACTIVE" | "INACTIVE";

export type ComplianceStatus = "pending" | "compliant" | "review_required";

export type LocationOption = {
  id: number;
  name: string;
};

export type CenterSelectorOption = {
  id: string;
  name: string;
  addressSummary: string;
  isActive: boolean;
};

export type CenterListItem = {
  id: string;
  name: string;
  addressSummary: string;
  cityName: string | null;
  stateName: string | null;
  countryName: string | null;
  totalCapacity: number;
  currentUtilization: number;
  complianceStatus: ComplianceStatus;
  isActive: boolean;
  batchCount: number;
};

export type CenterDetail = CenterListItem & {
  addressLine1: string | null;
  addressLine2: string | null;
  landmark: string | null;
  postalCode: string | null;
  cityId: number | null;
  stateId: number | null;
  countryId: number | null;
};

export type CenterCreateResult = CenterDetail;