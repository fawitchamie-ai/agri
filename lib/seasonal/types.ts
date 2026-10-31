/** Units are part of the public contract; null means unknown, never zero. */
export const ENGINE_VERSION = 'water-balance-1.3.0';
export const COUNTRIES = {
  TGO: { name: 'Togo', timezone: 'Africa/Lome' },
  BEN: { name: 'Bénin', timezone: 'Africa/Porto-Novo' },
  BFA: { name: 'Burkina Faso', timezone: 'Africa/Ouagadougou' },
  GHA: { name: 'Ghana', timezone: 'Africa/Accra' },
  CIV: { name: 'Côte d’Ivoire', timezone: 'Africa/Abidjan' },
  SEN: { name: 'Sénégal', timezone: 'Africa/Dakar' },
} as const;
export type Country = keyof typeof COUNTRIES;
export type SoilLayer = { thicknessM: number; thetaFC: number; thetaWP: number; initialTheta: number | null };
export type Stage = { name: string; days: number; kcStart: number; kcEnd: number; rootStartM: number; rootEndM: number; depletionFraction: number };
export type WeatherDay = {
  date: string; rainMm: number | null; et0Mm: number | null; temperatureMeanC?: number | null;
  status: 'observed' | 'estimated' | 'forecast' | 'scenario'; source: string; availableAt: string;
  provenance?: Record<string,import('./provenance.ts').InputValue>;
};
export type WaterEvent = {
  unitId?: string;
  landSelection?: 'whole' | 'potentialLand';
  provenance?: import('./provenance.ts').InputValue;
  id: string; date: string; kind: 'rain' | 'irrigation' | 'soil';
  amount: number; unit: 'mm' | 'L' | 'm3' | 'fraction';
  point: 'net' | 'field' | 'source';
  status: 'measured' | 'declared' | 'planned' | 'cancelled';
  source: string; recordedAt: string;
};
export type SeasonalConfig = {
  agronomic?: import('./agronomic.ts').AgronomicConfig;
  yieldEstimation?: import('./yield.ts').YieldInput;
  inputs?: import('./provenance.ts').InputLedger;
  inputPolicy?: {allowAssumptions:boolean;allowStale:boolean};
  landSelection?: 'whole' | 'potentialLand';
  landAssessment?: import('./land.ts').LandAssessment;
  parcelGeometry?: import('./parcel.ts').ParcelPolygon;
  country: Country; name: string; territory: string; crop: string; variety: string;
  cropProfile?: { id: string; version: string; mode: 'reference' | 'custom' };
  adjustDepletionToEtc?: boolean;
  soilAnalyses?: import('./chemistry.ts').SoilAnalysis[];
  nutritionReference?: {id:string;contextNote:string;alreadyKgHa:(number|null)[]};
  sowingDate: string; asOfDate: string; areaM2: number | null;
  latitude: number | null; longitude: number | null;
  soil: { source: string; layers: SoilLayer[]; infiltrationMmDay: number | null };
  stages: Stage[]; parameterSource: string;
  system: {
    name: string; source: string; applicationEfficiency: number | null;
    transportEfficiency: number | null; sourceFlowM3h: number | null;
    hoursPerDay: number | null; sourceBudgetM3: number | null;
    maxNetMmPerDay: number | null; minIntervalDays: number;
    allowedWeekdays: number[]; targetDepletionFraction: number;
    dailySourceLimits: { date: string; m3: number }[];
  };
  weather: WeatherDay[];
  fallback: { label: string; et0MmDay: number; rainMmDay: number } | null;
  waterCondition?: 'unknown' | 'drained' | 'waterlogged' | 'submerged';
  systemDomain: 'upland' | 'flooded_rice' | 'shallow_water_table';
};
export type Volumes = { netMm: number; fieldMm: number | null; netLitres: number | null; netM3: number | null; fieldLitres: number | null; fieldM3: number | null; sourceM3: number | null; durationHours: number | null };
export type WaterDay = {
  date: string; stage: string; stageIndex: number; rootM: number; kc: number;
  demandMm: number; actualEtMm: number; rainMm: number; rainRetainedMm: number;
  runoffMm: number; drainageMm: number; irrigationNetMm: number; requiredNetMm: number; unservedNetMm: number;
  stockStartMm: number; rootGainMm: number; stockEndMm: number; assimilationMm: number;
  tawMm: number; rawMm: number; depletionMm: number; unmetEtMm: number;
  balanceResidualMm: number; weatherSource: string; weatherStatus: WeatherDay['status'];
  intervention: (Volumes & { type: 'recorded' | 'proposed'; constrained: boolean; reasons: string[] }) | null;
};
export type WaterPeriod = {
  label: string; from: string; to: string; demandMm: number; actualEtMm: number;
  rainMm: number; rainRetainedMm: number; runoffMm: number; drainageMm: number;
  stockStartMm: number; stockEndMm: number; rootGainMm: number; assimilationMm: number;
  netMm: number; requiredNetMm: number; unservedNetMm: number; fieldM3: number | null; sourceM3: number | null; unmetEtMm: number;
};
export type WaterPlan = {
  yieldEstimation?: import('./yield.ts').YieldEstimate;
  calculationArea?: {selection:'whole'|'potentialLand';areaM2:number|null;geometry:import('./land.ts').MultiShape|null};
  eventProvenance?: import('./provenance.ts').InputValue[];
  land?: import('./land.ts').LandAssessment;
  inputProvenance?: import('./provenance.ts').InputLedger;
  nutrition?: ReturnType<typeof import('./nutrition.ts').referenceQuantities>;
  engineVersion: string; levelOfEvidence: 'simulation_non_validee'; status: 'conditional' | 'blocked';
  complete: boolean; horizonEnd: string; assumptions: string[]; missing: string[];
  days: WaterDay[]; weeks: WaterPeriod[]; decades: WaterPeriod[]; stages: WaterPeriod[];
  nextWindows: { from: string; to: string; conditional: true; volume: Volumes; reasons: string[] }[];
  intervalDays: { min: number; max: number } | null;
  totals: { demandMm: number; actualEtMm: number; unmetEtMm: number; netMm: number;
    recordedSourceM3: number | null; remainingSourceM3: number | null; sourceM3: number | null;
    fieldM3: number | null; remainingBudgetM3: number | null };
};
export type Campaign = { id: string; revision: number; config: SeasonalConfig; events: WaterEvent[]; plan: WaterPlan; updatedAt: string; demo: boolean };
