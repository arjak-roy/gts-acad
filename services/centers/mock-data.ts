import { CenterDetail, CenterSelectorOption, LocationOption } from "@/services/centers/types";

type MockState = LocationOption & {
  countryId: number;
};

type MockCity = LocationOption & {
  stateId: number;
};

export const MOCK_COUNTRIES: LocationOption[] = [
  { id: 1, name: "India" },
];

export const MOCK_STATES: MockState[] = [
  { id: 1, countryId: 1, name: "Kerala" },
];

export const MOCK_CITIES: MockCity[] = [
  { id: 1, stateId: 1, name: "Kochi" },
  { id: 2, stateId: 1, name: "Thrissur" },
  { id: 3, stateId: 1, name: "Calicut" },
];

export const MOCK_CENTERS: CenterDetail[] = [
  {
    id: "mock-center-1",
    name: "Main Campus",
    addressLine1: "Infopark Phase 1",
    addressLine2: "Kakkanad",
    landmark: "Near Phase 1 Bus Stop",
    postalCode: "682042",
    countryId: 1,
    stateId: 1,
    cityId: 1,
    countryName: "India",
    stateName: "Kerala",
    cityName: "Kochi",
    addressSummary: "Infopark Phase 1, Kakkanad, Kochi, Kerala, India 682042",
    totalCapacity: 300,
    currentUtilization: 180,
    complianceStatus: "compliant",
    isActive: true,
    batchCount: 4,
  },
  {
    id: "mock-center-2",
    name: "North Campus",
    addressLine1: "Civil Line Road",
    addressLine2: "Palarivattom",
    landmark: "Opposite Metro Pillar 512",
    postalCode: "682025",
    countryId: 1,
    stateId: 1,
    cityId: 1,
    countryName: "India",
    stateName: "Kerala",
    cityName: "Kochi",
    addressSummary: "Civil Line Road, Palarivattom, Kochi, Kerala, India 682025",
    totalCapacity: 180,
    currentUtilization: 96,
    complianceStatus: "pending",
    isActive: true,
    batchCount: 2,
  },
  {
    id: "mock-center-3",
    name: "Skills Annex",
    addressLine1: "Seaport Airport Road",
    addressLine2: "Thrikkakara",
    landmark: "Near Collectorate Junction",
    postalCode: "682021",
    countryId: 1,
    stateId: 1,
    cityId: 1,
    countryName: "India",
    stateName: "Kerala",
    cityName: "Kochi",
    addressSummary: "Seaport Airport Road, Thrikkakara, Kochi, Kerala, India 682021",
    totalCapacity: 120,
    currentUtilization: 54,
    complianceStatus: "compliant",
    isActive: true,
    batchCount: 1,
  },
];

export const MOCK_CENTER_OPTIONS: CenterSelectorOption[] = MOCK_CENTERS.map((center) => ({
  id: center.id,
  name: center.name,
  addressSummary: center.addressSummary,
  isActive: center.isActive,
}));