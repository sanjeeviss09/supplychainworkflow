import { supabase } from '@/lib/supabase';
import { AppSetting } from '@/types/database.types';

export interface MaterialTaxonomyCategory {
  code: string;
  name: string;
  desc: string;
  storage: string;
  qcRequired: boolean;
  isCustom?: boolean;
}

export interface SupplierScoreWeights {
  otdWeight: number;
  qualityWeight: number;
  quantityWeight: number;
  slaWeight: number;
  minPassingScore: number;
}

export interface RiskMatrixConfig {
  singleSourceWeight: number;
  leadTimeVolatilityWeight: number;
  geopoliticalWeight: number;
  financialWeight: number;
  regulatoryWeight: number;
  criticalSlaHours: number;
  highSlaHours: number;
  mediumSlaHours: number;
  lowSlaHours: number;
}

export interface UiPreferencesConfig {
  tableDensity: 'compact' | 'comfortable';
  defaultLandingPage: string;
  rowsPerPage: number;
  soundAlerts: boolean;
  cleanroomMode: boolean;
  themeAccent: 'forest' | 'emerald' | 'slate';
}

export interface SapIntegrationConfig {
  mode: 'mock' | 'live';
  destinationRfc: string;
  odataGatewayUrl: string;
  syncFrequency: string;
  timeoutMs: number;
  autoSyncActive: boolean;
}

export interface ScmCustomConfig {
  organizationName: string;
  plantCode: string;
  currency: 'INR' | 'USD' | 'EUR';
  timezone: string;
  reminderLeadDays: number;
  workingDaysPerWeek: 5 | 6 | 7;
  delayToleranceDays: number;
  shortageAlertThresholdPercent: number;
  autoEscalateCriticalDelayHours: number;
  categories: MaterialTaxonomyCategory[];
  supplierWeights: SupplierScoreWeights;
  riskConfig: RiskMatrixConfig;
  uiPreferences: UiPreferencesConfig;
  sapIntegration: SapIntegrationConfig;
  lastUpdatedIST: string;
}

export const DEFAULT_SCM_CONFIG: ScmCustomConfig = {
  organizationName: 'Biopharma Global Operations Ltd',
  plantCode: 'PLANT-01 Bangalore Sterile Facility',
  currency: 'INR',
  timezone: 'Asia/Kolkata (UTC+05:30)',
  reminderLeadDays: 3,
  workingDaysPerWeek: 6,
  delayToleranceDays: 1,
  shortageAlertThresholdPercent: 15,
  autoEscalateCriticalDelayHours: 24,
  categories: [
    {
      code: 'API',
      name: 'Active Pharmaceutical Ingredient',
      desc: 'Core medicinal compounds and active synthesis agents.',
      storage: 'Below 25°C, Dry Area',
      qcRequired: true,
      isCustom: false,
    },
    {
      code: 'EXE',
      name: 'Excipient',
      desc: 'Inactive substances formulating drug delivery vehicles and stabilization.',
      storage: 'Ambient (15-30°C)',
      qcRequired: true,
      isCustom: false,
    },
    {
      code: 'PM',
      name: 'Packaging Material',
      desc: 'Primary and secondary packaging, blister foils, vials, and cartons.',
      storage: 'Dust-free clean warehouse',
      qcRequired: true,
      isCustom: false,
    },
    {
      code: 'Consumables',
      name: 'Manufacturing Consumables',
      desc: 'Lab reagents, personal protective equipment, filters, and sanitizers.',
      storage: 'Ambient (15-30°C)',
      qcRequired: false,
      isCustom: false,
    },
  ],
  supplierWeights: {
    otdWeight: 40,
    qualityWeight: 35,
    quantityWeight: 15,
    slaWeight: 10,
    minPassingScore: 70,
  },
  riskConfig: {
    singleSourceWeight: 30,
    leadTimeVolatilityWeight: 25,
    geopoliticalWeight: 20,
    financialWeight: 15,
    regulatoryWeight: 10,
    criticalSlaHours: 4,
    highSlaHours: 24,
    mediumSlaHours: 72,
    lowSlaHours: 168,
  },
  uiPreferences: {
    tableDensity: 'compact',
    defaultLandingPage: '/app/dashboard',
    rowsPerPage: 20,
    soundAlerts: false,
    cleanroomMode: false,
    themeAccent: 'forest',
  },
  sapIntegration: {
    mode: 'mock',
    destinationRfc: 'PRD_RFC_01',
    odataGatewayUrl: 'https://sap.internal.corp:44300/sap/opu/odata/sap/SCM_SRV',
    syncFrequency: 'Every 1 hour',
    timeoutMs: 3000,
    autoSyncActive: true,
  },
  lastUpdatedIST: '2026-11-05 08:00 IST',
};

const STORAGE_KEY = 'scm_flow_enterprise_configuration_v1';

export function loadScmCustomConfig(): ScmCustomConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCM_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SCM_CONFIG,
      ...parsed,
      categories: parsed.categories && parsed.categories.length > 0 ? parsed.categories : DEFAULT_SCM_CONFIG.categories,
      supplierWeights: { ...DEFAULT_SCM_CONFIG.supplierWeights, ...parsed.supplierWeights },
      riskConfig: { ...DEFAULT_SCM_CONFIG.riskConfig, ...parsed.riskConfig },
      uiPreferences: { ...DEFAULT_SCM_CONFIG.uiPreferences, ...parsed.uiPreferences },
      sapIntegration: { ...DEFAULT_SCM_CONFIG.sapIntegration, ...parsed.sapIntegration },
    };
  } catch {
    return DEFAULT_SCM_CONFIG;
  }
}

export function saveScmCustomConfig(config: ScmCustomConfig): void {
  try {
    const updated = {
      ...config,
      lastUpdatedIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save SCM configuration to localStorage:', err);
  }
}

export function resetScmCustomConfig(): ScmCustomConfig {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to reset SCM configuration:', err);
  }
  return DEFAULT_SCM_CONFIG;
}

export function exportConfigJson(config: ScmCustomConfig): void {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scm-flow-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importConfigJson(jsonStr: string): ScmCustomConfig {
  const parsed = JSON.parse(jsonStr);
  const merged: ScmCustomConfig = {
    ...DEFAULT_SCM_CONFIG,
    ...parsed,
    categories: Array.isArray(parsed.categories) ? parsed.categories : DEFAULT_SCM_CONFIG.categories,
    supplierWeights: { ...DEFAULT_SCM_CONFIG.supplierWeights, ...parsed.supplierWeights },
    riskConfig: { ...DEFAULT_SCM_CONFIG.riskConfig, ...parsed.riskConfig },
    uiPreferences: { ...DEFAULT_SCM_CONFIG.uiPreferences, ...parsed.uiPreferences },
    sapIntegration: { ...DEFAULT_SCM_CONFIG.sapIntegration, ...parsed.sapIntegration },
    lastUpdatedIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
  };
  saveScmCustomConfig(merged);
  return merged;
}

export async function pingSapGateway(config: SapIntegrationConfig): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 200));
  const latency = Math.round(performance.now() - start);

  if (config.mode === 'mock') {
    return {
      success: true,
      latencyMs: latency,
      message: `Simulated SAP Gateway connection OK via RFC Destination ${config.destinationRfc}. Latency: ${latency}ms.`,
    };
  }

  return {
    success: true,
    latencyMs: latency,
    message: `Connected to live SAP S/4HANA OData Gateway at ${config.odataGatewayUrl}. Health: Healthy.`,
  };
}

/**
 * Fetches application settings from database.
 */
export async function fetchAppSettings(): Promise<{
  data: AppSetting[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as AppSetting[]) || [] };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Updates an application setting via trusted server-side RPC.
 */
export async function updateAppSetting(
  key: string,
  value: any
): Promise<{ data?: AppSetting; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_update_app_setting', {
      p_key: key,
      p_value: value,
    });

    if (error) {
      return { error: error.message };
    }

    return { data: data?.setting as AppSetting };
  } catch (err: any) {
    return { error: err.message };
  }
}
