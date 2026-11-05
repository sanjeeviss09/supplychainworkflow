import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  Shield,
  Sliders,
  Layers,
  Clock,
  Coins,
  Globe,
  Server,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Activity,
  Sparkles,
  Zap,
  Building,
  Check,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  ScmCustomConfig,
  MaterialTaxonomyCategory,
  loadScmCustomConfig,
  saveScmCustomConfig,
  resetScmCustomConfig,
  exportConfigJson,
  importConfigJson,
  pingSapGateway,
  fetchAppSettings,
} from '@/services/settingsService';
import { AppSetting } from '@/types/database.types';

export function SettingsPage() {
  const { role, permissions } = useAuth();
  const canManageSystem = permissions.includes('settings.system.manage');
  const canManageScm = permissions.includes('settings.scm.manage');

  const [activeTab, setActiveTab] = useState<
    'general' | 'materials' | 'suppliers' | 'risks' | 'ui' | 'sap' | 'system'
  >('general');

  const [config, setConfig] = useState<ScmCustomConfig>(loadScmCustomConfig());
  const [dbSettings, setDbSettings] = useState<AppSetting[]>([]);
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isTestingSap, setIsTestingSap] = useState(false);
  const [sapTestResult, setSapTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);

  // New Category Form State
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatStorage, setNewCatStorage] = useState('Ambient (15-30°C)');
  const [newCatQc, setNewCatQc] = useState(true);

  useEffect(() => {
    fetchAppSettings().then((res) => {
      if (res.data) setDbSettings(res.data);
    });
  }, []);

  const handleUpdate = <K extends keyof ScmCustomConfig>(key: K, value: ScmCustomConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
    setIsSavedNotice(false);
  };

  const handleSave = () => {
    saveScmCustomConfig(config);
    setHasUnsavedChanges(false);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 4000);
  };

  const handleReset = () => {
    if (window.confirm('Reset all SCM settings and customizations back to factory architectural defaults?')) {
      const def = resetScmCustomConfig();
      setConfig(def);
      setHasUnsavedChanges(false);
      setIsSavedNotice(true);
      setTimeout(() => setIsSavedNotice(false), 3000);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatCode.trim() || !newCatName.trim()) return;

    const formattedCode = newCatCode.trim().toUpperCase();
    if (config.categories.some((c) => c.code === formattedCode)) {
      alert(`Category with code ${formattedCode} already exists!`);
      return;
    }

    const newCategory: MaterialTaxonomyCategory = {
      code: formattedCode,
      name: newCatName.trim(),
      desc: newCatDesc.trim() || 'Custom material taxonomy classification.',
      storage: newCatStorage,
      qcRequired: newCatQc,
      isCustom: true,
    };

    const updated = {
      ...config,
      categories: [...config.categories, newCategory],
    };
    setConfig(updated);
    saveScmCustomConfig(updated);
    setNewCatCode('');
    setNewCatName('');
    setNewCatDesc('');
    setHasUnsavedChanges(false);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleDeleteCategory = (codeToDelete: string) => {
    if (window.confirm(`Delete custom material category "${codeToDelete}"?`)) {
      const updated = {
        ...config,
        categories: config.categories.filter((c) => c.code !== codeToDelete),
      };
      setConfig(updated);
      saveScmCustomConfig(updated);
      setIsSavedNotice(true);
      setTimeout(() => setIsSavedNotice(false), 3000);
    }
  };

  const handleTestSap = async () => {
    setIsTestingSap(true);
    setSapTestResult(null);
    try {
      const res = await pingSapGateway(config.sapIntegration);
      setSapTestResult(res);
    } finally {
      setIsTestingSap(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importConfigJson(text);
        setConfig(imported);
        setHasUnsavedChanges(false);
        setIsSavedNotice(true);
        setTimeout(() => setIsSavedNotice(false), 4000);
        alert('Configuration imported and activated successfully!');
      } catch (err: any) {
        alert('Failed to parse configuration file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Supplier score weights sum
  const supplierWeightsSum =
    Number(config.supplierWeights.otdWeight) +
    Number(config.supplierWeights.qualityWeight) +
    Number(config.supplierWeights.quantityWeight) +
    Number(config.supplierWeights.slaWeight);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Executive Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-divider/70 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-sage shadow-xs">
              <Settings className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest">
              Platform & SCM Configuration
            </h1>
            <Badge variant="outline" className="text-[10px] bg-forest/5 text-forest border-forest/20">
              Live Customizer
            </Badge>
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Configure business rules, material classifications, supplier scorecard weights, risk thresholds, and ERP integration parameters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* File Upload Hidden */}
          <input
            type="file"
            id="import-config-file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('import-config-file')?.click()}
            className="text-xs border-divider"
            title="Import configuration JSON file"
          >
            <Upload className="h-3.5 w-3.5 mr-1 text-forest" />
            Import
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportConfigJson(config)}
            className="text-xs border-divider"
            title="Export configuration JSON file"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-forest" />
            Export JSON
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="text-xs border-divider text-ink-secondary hover:text-status-error"
            title="Reset to factory architectural defaults"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset Defaults
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            className={`text-xs shadow-warm-sm transition-all ${
              hasUnsavedChanges
                ? 'bg-copper hover:bg-copper-dark text-white animate-pulse'
                : 'bg-forest hover:bg-forest-deep text-sage'
            }`}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {hasUnsavedChanges ? 'Save Changes *' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {/* Save Notification Banner */}
      {isSavedNotice && (
        <div className="flex items-center space-x-2 rounded-lg bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-900 shadow-sm animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">Configuration saved and synchronized successfully!</span>
          <span className="text-[11px] text-emerald-700 ml-auto font-mono">
            Updated at {config.lastUpdatedIST}
          </span>
        </div>
      )}

      {/* Interactive Tabs Header */}
      <div className="flex overflow-x-auto space-x-1 border-b border-divider/70 pb-px scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-forest bg-ivory-surface text-forest shadow-xs'
              : 'border-transparent text-ink-secondary hover:text-forest hover:bg-ivory/60'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>SCM Business Rules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('materials')}
          className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'materials'
              ? 'border-forest bg-ivory-surface text-forest shadow-xs'
              : 'border-transparent text-ink-secondary hover:text-forest hover:bg-ivory/60'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Material Taxonomies ({config.categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'suppliers'
              ? 'border-forest bg-ivory-surface text-forest shadow-xs'
              : 'border-transparent text-ink-secondary hover:text-forest hover:bg-ivory/60'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Supplier Scorecard Weights</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('risks')}
          className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'risks'
              ? 'border-forest bg-ivory-surface text-forest shadow-xs'
              : 'border-transparent text-ink-secondary hover:text-forest hover:bg-ivory/60'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Risk Matrix & SLAs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ui')}
          className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'ui'
              ? 'border-forest bg-ivory-surface text-forest shadow-xs'
              : 'border-transparent text-ink-secondary hover:text-forest hover:bg-ivory/60'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>UI Preferences</span>
        </button>

        {canManageSystem && (
          <button
            type="button"
            onClick={() => setActiveTab('sap')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'sap'
                ? 'border-forest bg-ivory-surface text-forest shadow-xs'
                : 'border-transparent text-ink-secondary hover:text-forest hover:bg-ivory/60'
            }`}
          >
            <Server className="h-4 w-4" />
            <span>SAP ERP Gateway</span>
          </button>
        )}

        {canManageSystem && (
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'system'
                ? 'border-forest bg-ivory-surface text-forest shadow-xs'
                : 'border-transparent text-ink-secondary hover:text-forest hover:bg-ivory/60'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>PostgreSQL Records</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SCM BUSINESS RULES & DELIVERY LEAD TIMES                           */}
      {/* ========================================================================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Plant & Org Identity */}
            <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
              <CardHeader className="pb-3 border-b border-divider/60">
                <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
                  <Building className="h-4 w-4 text-sage-dark" />
                  <span>Manufacturing Plant & Operating Facility</span>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Organization name and primary facility code applied to outbound SAP PO requisitions.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-ink-primary">Organization Legal Name</Label>
                  <Input
                    value={config.organizationName}
                    onChange={(e) => handleUpdate('organizationName', e.target.value)}
                    className="mt-1 text-xs bg-ivory"
                    placeholder="e.g. Biopharma Global Operations Ltd"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-ink-primary">Primary Plant / Site Code</Label>
                  <Input
                    value={config.plantCode}
                    onChange={(e) => handleUpdate('plantCode', e.target.value)}
                    className="mt-1 text-xs bg-ivory"
                    placeholder="e.g. PLANT-01 Bangalore Sterile Facility"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Currency & Timezone */}
            <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
              <CardHeader className="pb-3 border-b border-divider/60">
                <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
                  <Coins className="h-4 w-4 text-sage-dark" />
                  <span>Operating Currency & Regional Localization</span>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Default currency format and operational timezone for delivery deadlines.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-ink-primary">Primary SCM Currency</Label>
                  <select
                    value={config.currency}
                    onChange={(e) => handleUpdate('currency', e.target.value as any)}
                    className="mt-1 block w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                  >
                    <option value="INR">INR (₹) — Indian Rupee (Default standard)</option>
                    <option value="USD">USD ($) — United States Dollar</option>
                    <option value="EUR">EUR (€) — Euro</option>
                  </select>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Sample format: {config.currency === 'INR' ? '₹ 12,45,000.00' : '$ 124,500.00'}
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ink-primary">System Operational Timezone</Label>
                  <select
                    value={config.timezone}
                    onChange={(e) => handleUpdate('timezone', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                  >
                    <option value="Asia/Kolkata (UTC+05:30)">Asia/Kolkata (UTC+05:30) — Indian Standard Time (IST)</option>
                    <option value="UTC (UTC+00:00)">UTC (UTC+00:00) — Universal Coordinated Time</option>
                    <option value="Asia/Singapore (UTC+08:00)">Asia/Singapore (UTC+08:00) — SGT</option>
                    <option value="Europe/London (UTC+00:00)">Europe/London (UTC+00:00) — GMT/BST</option>
                    <option value="America/New_York (UTC-05:00)">America/New_York (UTC-05:00) — EST/EDT</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Delivery & Escalation Rules */}
          <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
            <CardHeader className="pb-3 border-b border-divider/60">
              <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
                <Clock className="h-4 w-4 text-sage-dark" />
                <span>Automated Delivery Reminders & Lead Times</span>
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Control how early the automated notification worker dispatches reminders to procurement officers.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Reminder Lead Days Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-ink-primary">Proactive Reminder Lead Time</Label>
                  <span className="font-mono text-xs font-bold text-forest bg-sage/20 px-2 py-0.5 rounded">
                    {config.reminderLeadDays} Days
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="14"
                  step="1"
                  value={config.reminderLeadDays}
                  onChange={(e) => handleUpdate('reminderLeadDays', parseInt(e.target.value, 10))}
                  className="w-full accent-forest cursor-pointer"
                />
                <p className="text-[11px] text-ink-muted">
                  Sends automated notifications {config.reminderLeadDays} days prior to contractual ETA at 06:00 IST.
                </p>
              </div>

              {/* Working Days per Week */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-ink-primary">Plant Working Schedule</Label>
                <select
                  value={config.workingDaysPerWeek}
                  onChange={(e) => handleUpdate('workingDaysPerWeek', parseInt(e.target.value, 10) as any)}
                  className="w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                >
                  <option value={5}>5 Days (Monday – Friday)</option>
                  <option value={6}>6 Days (Monday – Saturday, Pharma Standard)</option>
                  <option value={7}>7 Days (Continuous 24/7 Operations)</option>
                </select>
                <p className="text-[11px] text-ink-muted">
                  Used for lead-time date calculations and shipment transit scheduling.
                </p>
              </div>

              {/* Delay Grace Period */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-ink-primary">Delay Grace Tolerance</Label>
                  <span className="font-mono text-xs font-bold text-forest bg-sage/20 px-2 py-0.5 rounded">
                    {config.delayToleranceDays} Day(s)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={config.delayToleranceDays}
                  onChange={(e) => handleUpdate('delayToleranceDays', parseInt(e.target.value, 10))}
                  className="w-full accent-forest cursor-pointer"
                />
                <p className="text-[11px] text-ink-muted">
                  {config.delayToleranceDays === 0
                    ? 'Strict GxP compliance: Any deviation immediately flags as DELAYED.'
                    : `Permits up to ${config.delayToleranceDays} day(s) transit buffer before triggering high-severity delay alerts.`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MATERIAL TAXONOMIES & CUSTOM CATEGORY MANAGER                     */}
      {/* ========================================================================= */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          {/* Approved Categories Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-forest flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-forest" />
                  <span>Approved Material Classifications ({config.categories.length})</span>
                </h2>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Taxonomies governing material master registration, storage conditions, and BOM validation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {config.categories.map((cat) => (
                <Card
                  key={cat.code}
                  className="border border-divider bg-ivory-surface shadow-xs hover:border-forest/40 transition-all flex flex-col justify-between"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-forest bg-sage/20 px-2 py-0.5 rounded">
                        {cat.code}
                      </span>
                      {cat.isCustom ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.code)}
                          className="text-ink-muted hover:text-status-error p-1 rounded transition-colors"
                          title="Delete Custom Category"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <Badge variant="outline" className="text-[9px] bg-ivory text-ink-secondary">
                          Core Arch
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xs font-bold text-ink-primary mt-1">
                      {cat.name}
                    </CardTitle>
                    <CardDescription className="text-[11px] text-ink-secondary line-clamp-2">
                      {cat.desc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-1 pb-3 text-[11px] space-y-1.5 border-t border-divider/40 mt-2">
                    <div className="flex items-center justify-between text-ink-secondary">
                      <span>Storage:</span>
                      <span className="font-medium text-ink-primary font-mono">{cat.storage}</span>
                    </div>
                    <div className="flex items-center justify-between text-ink-secondary">
                      <span>QC Inspection:</span>
                      <span
                        className={`font-semibold text-[10px] px-1.5 py-0.2 rounded ${
                          cat.qcRequired ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cat.qcRequired ? 'Mandatory' : 'Optional'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Add Custom Material Category Form */}
          <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
            <CardHeader className="pb-3 border-b border-divider/60">
              <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
                <Plus className="h-4 w-4 text-sage-dark" />
                <span>Add Custom Material Classification</span>
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Introduce a new validated taxonomy category (e.g. Bulk Solvents, Biological Reagents, Primary Packaging).
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAddCategory}>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-ink-primary">Category Code *</Label>
                  <Input
                    value={newCatCode}
                    onChange={(e) => setNewCatCode(e.target.value)}
                    placeholder="e.g. BIO, SOLV, CONT"
                    className="mt-1 text-xs bg-ivory uppercase font-mono"
                    maxLength={10}
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ink-primary">Classification Title *</Label>
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Biologics & Cell Culture"
                    className="mt-1 text-xs bg-ivory"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-ink-primary">Storage Condition</Label>
                  <select
                    value={newCatStorage}
                    onChange={(e) => setNewCatStorage(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-divider bg-ivory px-2.5 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                  >
                    <option value="Ambient (15-30°C)">Ambient (15-30°C)</option>
                    <option value="Cold Storage (2-8°C)">Cold Storage (2-8°C)</option>
                    <option value="Frozen (-20°C)">Frozen (-20°C)</option>
                    <option value="Ultra-Low (-80°C)">Ultra-Low (-80°C)</option>
                    <option value="Flammables Vault">Flammables Vault</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end pb-1">
                  <label className="flex items-center space-x-2 text-xs text-ink-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newCatQc}
                      onChange={(e) => setNewCatQc(e.target.checked)}
                      className="rounded border-divider text-forest focus:ring-forest"
                    />
                    <span className="font-medium">Mandatory QC Release Required</span>
                  </label>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <Label className="text-xs font-semibold text-ink-primary">Description & Regulatory Scope</Label>
                  <Input
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Detailed scope of materials included under this classification..."
                    className="mt-1 text-xs bg-ivory"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full bg-forest hover:bg-forest-deep text-sage text-xs shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 text-sage" />
                    Register Classification
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SUPPLIER SCORECARD WEIGHTS                                        */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="pb-3 border-b border-divider/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-sage-dark" />
                  <span>Supplier Delivery Performance Weights</span>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Specify the weighting factors used to compute the composite supplier scorecard rating out of 100%.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={`text-xs font-mono font-bold ${
                  supplierWeightsSum === 100
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-status-error border-rose-300'
                }`}
              >
                Total Weight: {supplierWeightsSum}% {supplierWeightsSum === 100 ? '✓' : '(Must equal 100%)'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-6 max-w-2xl">
            {/* OTD Weight */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-ink-primary">On-Time Delivery (OTD) Weight</span>
                <span className="font-mono font-bold text-forest">{config.supplierWeights.otdWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.supplierWeights.otdWeight}
                onChange={(e) =>
                  handleUpdate('supplierWeights', {
                    ...config.supplierWeights,
                    otdWeight: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-forest cursor-pointer"
              />
              <p className="text-[11px] text-ink-muted">Evaluates deliveries fulfilled on or before contractual ETA.</p>
            </div>

            {/* Quality Weight */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-ink-primary">Quality Acceptance & Certificate of Analysis (COA)</span>
                <span className="font-mono font-bold text-forest">{config.supplierWeights.qualityWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.supplierWeights.qualityWeight}
                onChange={(e) =>
                  handleUpdate('supplierWeights', {
                    ...config.supplierWeights,
                    qualityWeight: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-forest cursor-pointer"
              />
              <p className="text-[11px] text-ink-muted">Pass rate in QA raw material sampling and release tests.</p>
            </div>

            {/* Quantity Fulfillment Weight */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-ink-primary">Quantity Accuracy & Shortage Prevention</span>
                <span className="font-mono font-bold text-forest">{config.supplierWeights.quantityWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.supplierWeights.quantityWeight}
                onChange={(e) =>
                  handleUpdate('supplierWeights', {
                    ...config.supplierWeights,
                    quantityWeight: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-forest cursor-pointer"
              />
              <p className="text-[11px] text-ink-muted">Delivered quantity match vs ordered purchase order line items.</p>
            </div>

            {/* SLA Response Weight */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-ink-primary">Follow-up Responsiveness & Issue SLA</span>
                <span className="font-mono font-bold text-forest">{config.supplierWeights.slaWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.supplierWeights.slaWeight}
                onChange={(e) =>
                  handleUpdate('supplierWeights', {
                    ...config.supplierWeights,
                    slaWeight: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-forest cursor-pointer"
              />
              <p className="text-[11px] text-ink-muted">Speed of addressing delivery issues and providing revised ETAs.</p>
            </div>

            {/* Passing Score Threshold */}
            <div className="pt-4 border-t border-divider/60">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-ink-primary">Minimum Qualified Vendor Passing Score</span>
                <span className="font-mono font-bold text-forest">{config.supplierWeights.minPassingScore} / 100</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={config.supplierWeights.minPassingScore}
                onChange={(e) =>
                  handleUpdate('supplierWeights', {
                    ...config.supplierWeights,
                    minPassingScore: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-forest cursor-pointer"
              />
              <p className="text-[11px] text-ink-muted">
                Suppliers falling below this composite score are automatically tagged for procurement review.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RISK MATRIX & SLA RESOLUTION TIMERS                               */}
      {/* ========================================================================= */}
      {activeTab === 'risks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Risk Scoring Components */}
          <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
            <CardHeader className="pb-3 border-b border-divider/60">
              <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-sage-dark" />
                <span>Supply Risk Weighting Matrix</span>
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Relative weights used to calculate criticality risk scores (0–100).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Single-Source Dependency</span>
                  <span className="font-mono font-bold text-forest">{config.riskConfig.singleSourceWeight}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={config.riskConfig.singleSourceWeight}
                  onChange={(e) =>
                    handleUpdate('riskConfig', {
                      ...config.riskConfig,
                      singleSourceWeight: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-forest cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Lead Time Volatility & Past Delays</span>
                  <span className="font-mono font-bold text-forest">{config.riskConfig.leadTimeVolatilityWeight}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={config.riskConfig.leadTimeVolatilityWeight}
                  onChange={(e) =>
                    handleUpdate('riskConfig', {
                      ...config.riskConfig,
                      leadTimeVolatilityWeight: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-forest cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Geopolitical & Origin Location Risk</span>
                  <span className="font-mono font-bold text-forest">{config.riskConfig.geopoliticalWeight}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  step="5"
                  value={config.riskConfig.geopoliticalWeight}
                  onChange={(e) =>
                    handleUpdate('riskConfig', {
                      ...config.riskConfig,
                      geopoliticalWeight: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-forest cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Financial Solvency of Supplier</span>
                  <span className="font-mono font-bold text-forest">{config.riskConfig.financialWeight}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={config.riskConfig.financialWeight}
                  onChange={(e) =>
                    handleUpdate('riskConfig', {
                      ...config.riskConfig,
                      financialWeight: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-forest cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          {/* SLA Escalation Resolution Timers */}
          <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
            <CardHeader className="pb-3 border-b border-divider/60">
              <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
                <Clock className="h-4 w-4 text-sage-dark" />
                <span>Issue & Risk Escalation SLA Timers</span>
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Mandatory resolution windows before auto-escalating to Executive SCM leadership.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-xs font-semibold text-status-error flex items-center space-x-1">
                  <span>Critical Severity SLA (Hours)</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={config.riskConfig.criticalSlaHours}
                  onChange={(e) =>
                    handleUpdate('riskConfig', {
                      ...config.riskConfig,
                      criticalSlaHours: parseInt(e.target.value, 10),
                    })
                  }
                  className="mt-1 text-xs bg-ivory"
                />
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Line-stoppage risk. Default: 4 hours.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-copper flex items-center space-x-1">
                  <span>High Severity SLA (Hours)</span>
                </Label>
                <Input
                  type="number"
                  min="4"
                  max="72"
                  value={config.riskConfig.highSlaHours}
                  onChange={(e) =>
                    handleUpdate('riskConfig', {
                      ...config.riskConfig,
                      highSlaHours: parseInt(e.target.value, 10),
                    })
                  }
                  className="mt-1 text-xs bg-ivory"
                />
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Substantial delivery delay. Default: 24 hours.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-amber-800 flex items-center space-x-1">
                  <span>Medium Severity SLA (Hours)</span>
                </Label>
                <Input
                  type="number"
                  min="12"
                  max="168"
                  value={config.riskConfig.mediumSlaHours}
                  onChange={(e) =>
                    handleUpdate('riskConfig', {
                      ...config.riskConfig,
                      mediumSlaHours: parseInt(e.target.value, 10),
                    })
                  }
                  className="mt-1 text-xs bg-ivory"
                />
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Minor discrepancy or missing paperwork. Default: 72 hours.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: UI PREFERENCES & CUSTOMIZATION                                     */}
      {/* ========================================================================= */}
      {activeTab === 'ui' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="pb-3 border-b border-divider/60">
            <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-sage-dark" />
              <span>User Experience & Density Customization</span>
            </CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Personalize interface table density, default landing module, and accessibility controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <Label className="text-xs font-semibold text-ink-primary">Data Table Density</Label>
              <select
                value={config.uiPreferences.tableDensity}
                onChange={(e) =>
                  handleUpdate('uiPreferences', {
                    ...config.uiPreferences,
                    tableDensity: e.target.value as any,
                  })
                }
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="compact">Compact (High-density for operational SCM)</option>
                <option value="comfortable">Comfortable (Spacious row padding)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-ink-primary">Default Landing Workspace</Label>
              <select
                value={config.uiPreferences.defaultLandingPage}
                onChange={(e) =>
                  handleUpdate('uiPreferences', {
                    ...config.uiPreferences,
                    defaultLandingPage: e.target.value,
                  })
                }
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="/app/dashboard">Executive Dashboard</option>
                <option value="/app/projects">Projects & Milestones</option>
                <option value="/app/materials">Materials Master (BOM)</option>
                <option value="/app/deliveries">Delivery Tracking (SAP)</option>
                <option value="/app/deliveries/issues">Delivery Issues Register</option>
                <option value="/app/reports">Analytical Reports</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-ink-primary">Default Rows Per Page</Label>
              <select
                value={config.uiPreferences.rowsPerPage}
                onChange={(e) =>
                  handleUpdate('uiPreferences', {
                    ...config.uiPreferences,
                    rowsPerPage: parseInt(e.target.value, 10),
                  })
                }
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value={10}>10 records</option>
                <option value={20}>20 records</option>
                <option value={50}>50 records</option>
                <option value={100}>100 records</option>
              </select>
            </div>

            <div className="flex flex-col justify-end space-y-3">
              <label className="flex items-center space-x-2 text-xs text-ink-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.uiPreferences.soundAlerts}
                  onChange={(e) =>
                    handleUpdate('uiPreferences', {
                      ...config.uiPreferences,
                      soundAlerts: e.target.checked,
                    })
                  }
                  className="rounded border-divider text-forest focus:ring-forest"
                />
                <span className="font-medium">Sound alert for Critical delay exceptions</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-ink-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.uiPreferences.cleanroomMode}
                  onChange={(e) =>
                    handleUpdate('uiPreferences', {
                      ...config.uiPreferences,
                      cleanroomMode: e.target.checked,
                    })
                  }
                  className="rounded border-divider text-forest focus:ring-forest"
                />
                <span className="font-medium">High-Contrast Cleanroom display mode</span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SAP S/4HANA ERP INTEGRATION GATEWAY                               */}
      {/* ========================================================================= */}
      {activeTab === 'sap' && canManageSystem && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="pb-3 border-b border-divider/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
                  <Server className="h-4 w-4 text-sage-dark" />
                  <span>SAP S/4HANA OData & RFC Gateway Parameters</span>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Configure connectivity parameters for real-time SAP PR/PO tracking synchronization.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {config.sapIntegration.mode === 'mock' ? 'Mock / Sandbox Mode' : 'Live OData Active'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-ink-primary">Gateway Operation Mode</Label>
                <select
                  value={config.sapIntegration.mode}
                  onChange={(e) =>
                    handleUpdate('sapIntegration', {
                      ...config.sapIntegration,
                      mode: e.target.value as any,
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                >
                  <option value="mock">Mock Sandbox (Internal Cloud Simulation)</option>
                  <option value="live">Live SAP S/4HANA RFC / OData Endpoint</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-ink-primary">RFC Destination Identifier</Label>
                <Input
                  value={config.sapIntegration.destinationRfc}
                  onChange={(e) =>
                    handleUpdate('sapIntegration', {
                      ...config.sapIntegration,
                      destinationRfc: e.target.value,
                    })
                  }
                  className="mt-1 text-xs bg-ivory font-mono uppercase"
                  placeholder="e.g. PRD_RFC_01"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold text-ink-primary">OData Service URL</Label>
                <Input
                  value={config.sapIntegration.odataGatewayUrl}
                  onChange={(e) =>
                    handleUpdate('sapIntegration', {
                      ...config.sapIntegration,
                      odataGatewayUrl: e.target.value,
                    })
                  }
                  className="mt-1 text-xs bg-ivory font-mono"
                  placeholder="https://sap.internal.corp:44300/sap/opu/odata/sap/SCM_SRV"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-ink-primary">Scheduled Sync Interval</Label>
                <select
                  value={config.sapIntegration.syncFrequency}
                  onChange={(e) =>
                    handleUpdate('sapIntegration', {
                      ...config.sapIntegration,
                      syncFrequency: e.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                >
                  <option value="Every 15 minutes">Every 15 minutes</option>
                  <option value="Every 1 hour">Every 1 hour (Standard)</option>
                  <option value="Daily at 06:00 IST">Daily at 06:00 IST</option>
                  <option value="Real-time Webhook">Real-time Webhook Event</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-ink-primary">Circuit Breaker Timeout (ms)</Label>
                <Input
                  type="number"
                  min="500"
                  max="10000"
                  step="500"
                  value={config.sapIntegration.timeoutMs}
                  onChange={(e) =>
                    handleUpdate('sapIntegration', {
                      ...config.sapIntegration,
                      timeoutMs: parseInt(e.target.value, 10),
                    })
                  }
                  className="mt-1 text-xs bg-ivory font-mono"
                />
              </div>
            </div>

            {/* Test Connection Result Bar */}
            {sapTestResult && (
              <div
                className={`flex items-center space-x-2 rounded-lg p-3 text-xs border ${
                  sapTestResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{sapTestResult.message}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTestingSap}
              onClick={handleTestSap}
              className="text-xs border-forest/30 text-forest hover:bg-forest hover:text-sage"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isTestingSap ? 'animate-spin' : ''}`} />
              {isTestingSap ? 'Pinging Gateway...' : 'Test SAP Connection'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: POSTGRESQL DATABASE APP SETTINGS (SUPER ADMIN)                     */}
      {/* ========================================================================= */}
      {activeTab === 'system' && canManageSystem && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="pb-3 border-b border-divider/60">
            <CardTitle className="text-sm font-bold text-forest flex items-center space-x-2">
              <Shield className="h-4 w-4 text-sage-dark" />
              <span>PostgreSQL public.app_settings Master Records</span>
            </CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Authoritative GxP-audited application parameters persisted in the database schema.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-divider bg-ivory/60 text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Setting Key</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-4">Current Value</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-3">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/50">
                  {dbSettings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-ink-muted">
                        No app_settings rows returned from current database session.
                      </td>
                    </tr>
                  ) : (
                    dbSettings.map((item) => (
                      <tr key={item.key} className="hover:bg-ivory/50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-forest">
                          {item.key}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-ink-secondary">
                          {item.category}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs">
                          {typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}
                        </td>
                        <td className="py-2.5 px-4 text-ink-secondary text-[11px]">
                          {item.description || 'System parameter'}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {item.is_public ? 'Public' : 'Protected'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
