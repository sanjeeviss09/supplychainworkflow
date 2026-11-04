import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchSupplierById, updateSupplier } from '@/services/supplierService';
import { Supplier, SupplierType } from '@/types/database.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, ArrowLeft, Loader2, AlertCircle, Lock } from 'lucide-react';

export function SupplierEditPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Form State
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [supplierType, setSupplierType] = useState<SupplierType>('MANUFACTURER');
  const [taxIdentifier, setTaxIdentifier] = useState('');
  const [website, setWebsite] = useState('');
  const [generalEmail, setGeneralEmail] = useState('');
  const [generalPhone, setGeneralPhone] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState('');

  useEffect(() => {
    if (!supplierId) return;

    fetchSupplierById(supplierId)
      .then((res) => {
        if (res.error || !res.data) {
          setErrorMsg(res.error || 'Supplier not found.');
        } else {
          const s = res.data;
          setSupplier(s);
          setLegalName(s.legal_name || '');
          setDisplayName(s.display_name || '');
          setSupplierType(s.supplier_type || 'MANUFACTURER');
          setTaxIdentifier(s.tax_identifier || s.gstin || '');
          setWebsite(s.website || '');
          setGeneralEmail(s.general_email || s.email || '');
          setGeneralPhone(s.general_phone || s.phone || '');
          setRegisteredAddress(s.registered_address || '');
        }
      })
      .finally(() => setLoading(false));
  }, [supplierId]);

  const validate = () => {
    const errors: { [key: string]: string } = {};

    if (!legalName.trim()) {
      errors.legalName = 'Legal entity name is required.';
    } else if (legalName.trim().length > 200) {
      errors.legalName = 'Legal name must not exceed 200 characters.';
    }

    if (displayName.trim() && displayName.trim().length > 150) {
      errors.displayName = 'Display name must not exceed 150 characters.';
    }

    if (taxIdentifier.trim()) {
      if (taxIdentifier.trim().length > 30) {
        errors.taxIdentifier = 'Tax/GST identifier must not exceed 30 characters.';
      } else if (!/^[A-Za-z0-9]+$/.test(taxIdentifier.trim())) {
        errors.taxIdentifier = 'Tax/GST identifier must contain only alphanumeric characters.';
      }
    }

    if (website.trim()) {
      try {
        new URL(website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`);
      } catch {
        errors.website = 'Please enter a valid website URL.';
      }
    }

    if (generalEmail.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(generalEmail.trim())) {
        errors.generalEmail = 'Please enter a valid email address.';
      }
    }

    if (generalPhone.trim() && generalPhone.trim().length > 30) {
      errors.generalPhone = 'Phone number must not exceed 30 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !validate()) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await updateSupplier(supplierId, {
        legal_name: legalName.trim(),
        display_name: displayName.trim() || undefined,
        supplier_type: supplierType,
        tax_identifier: taxIdentifier.trim().toUpperCase() || undefined,
        website: website.trim() ? (website.trim().startsWith('http') ? website.trim() : `https://${website.trim()}`) : undefined,
        general_email: generalEmail.trim() || undefined,
        general_phone: generalPhone.trim() || undefined,
        registered_address: registeredAddress.trim() || undefined,
      });

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      navigate(`/app/suppliers/${supplierId}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[#5E6B61]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0B3B2E] mb-2" />
        <p className="text-sm">Loading supplier details...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-[#B85C1E] mx-auto" />
        <h2 className="text-lg font-bold text-[#182820]">Supplier Not Found</h2>
        <p className="text-sm text-[#5E6B61]">{errorMsg || 'The requested supplier record does not exist.'}</p>
        <Button onClick={() => navigate('/app/suppliers')} variant="outline" className="border-[#DEDCCF]">
          Return to Supplier Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-[#5E6B61]">
        <Link to="/app/suppliers" className="hover:text-[#0B3B2E] flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Supplier Directory
        </Link>
        <span>/</span>
        <Link to={`/app/suppliers/${supplier.id}`} className="hover:text-[#0B3B2E] font-mono">
          {supplier.supplier_code}
        </Link>
        <span>/</span>
        <span className="text-[#182820] font-medium">Edit Master Details</span>
      </div>

      <Card className="bg-[#FFFEFA] border-[#DEDCCF] shadow-xs">
        <CardHeader className="border-b border-[#DEDCCF] pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#E8EEDD] flex items-center justify-center text-[#0B3B2E]">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-[#182820]">
                  Edit Supplier: {supplier.legal_name}
                </CardTitle>
                <CardDescription className="text-sm text-[#5E6B61]">
                  Update verified supplier details. Changes will be recorded in the audit trail.
                </CardDescription>
              </div>
            </div>
            {/* Supplier Code Display (Immutable) */}
            <div className="text-right">
              <div className="text-xs text-[#5E6B61] flex items-center gap-1 justify-end">
                <Lock className="w-3 h-3 text-[#5E6B61]" />
                Immutable Code
              </div>
              <span className="font-mono font-bold text-sm text-[#0B3B2E] bg-[#E8EEDD] px-2 py-0.5 rounded">
                {supplier.supplier_code}
              </span>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            {errorMsg && (
              <div className="p-4 rounded-md bg-[#F8E8D5] border border-[#B85C1E] text-[#B85C1E] flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Basic Information */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B3B2E] border-b border-[#DEDCCF]/70 pb-2 mb-4">
                1. Identification & Classification
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Legal Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="legalName" className="text-xs font-semibold text-[#182820]">
                    Legal Entity Name <span className="text-[#B85C1E]">*</span>
                  </Label>
                  <Input
                    id="legalName"
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="bg-[#F7F3EA] border-[#DEDCCF] text-[#182820]"
                    maxLength={200}
                    required
                  />
                  {formErrors.legalName && (
                    <p className="text-xs text-[#B85C1E] font-medium">{formErrors.legalName}</p>
                  )}
                </div>

                {/* Display Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-xs font-semibold text-[#182820]">
                    Trade / Display Name
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-[#F7F3EA] border-[#DEDCCF] text-[#182820]"
                    maxLength={150}
                  />
                  {formErrors.displayName && (
                    <p className="text-xs text-[#B85C1E] font-medium">{formErrors.displayName}</p>
                  )}
                </div>

                {/* Supplier Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="supplierType" className="text-xs font-semibold text-[#182820]">
                    Supplier Classification <span className="text-[#B85C1E]">*</span>
                  </Label>
                  <select
                    id="supplierType"
                    value={supplierType}
                    onChange={(e) => setSupplierType(e.target.value as SupplierType)}
                    className="w-full h-10 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-sm text-[#182820] focus:ring-1 focus:ring-[#0B3B2E]"
                  >
                    <option value="MANUFACTURER">Manufacturer</option>
                    <option value="DISTRIBUTOR">Distributor</option>
                    <option value="TRADER">Trader</option>
                    <option value="SERVICE_PROVIDER">Service Provider</option>
                    <option value="OEM">Original Equipment Manufacturer (OEM)</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Regulatory & Contact */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B3B2E] border-b border-[#DEDCCF]/70 pb-2 mb-4">
                2. Regulatory, Tax & General Contact
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tax Identifier */}
                <div className="space-y-1.5">
                  <Label htmlFor="taxIdentifier" className="text-xs font-semibold text-[#182820]">
                    Tax / GST Identifier
                  </Label>
                  <Input
                    id="taxIdentifier"
                    type="text"
                    value={taxIdentifier}
                    onChange={(e) => setTaxIdentifier(e.target.value.toUpperCase())}
                    className="bg-[#F7F3EA] border-[#DEDCCF] text-[#182820] font-mono uppercase"
                    maxLength={30}
                  />
                  {formErrors.taxIdentifier && (
                    <p className="text-xs text-[#B85C1E] font-medium">{formErrors.taxIdentifier}</p>
                  )}
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <Label htmlFor="website" className="text-xs font-semibold text-[#182820]">
                    Corporate Website
                  </Label>
                  <Input
                    id="website"
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="bg-[#F7F3EA] border-[#DEDCCF] text-[#182820]"
                  />
                  {formErrors.website && (
                    <p className="text-xs text-[#B85C1E] font-medium">{formErrors.website}</p>
                  )}
                </div>

                {/* General Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="generalEmail" className="text-xs font-semibold text-[#182820]">
                    General Inquiries Email
                  </Label>
                  <Input
                    id="generalEmail"
                    type="email"
                    value={generalEmail}
                    onChange={(e) => setGeneralEmail(e.target.value)}
                    className="bg-[#F7F3EA] border-[#DEDCCF] text-[#182820]"
                  />
                  {formErrors.generalEmail && (
                    <p className="text-xs text-[#B85C1E] font-medium">{formErrors.generalEmail}</p>
                  )}
                </div>

                {/* General Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="generalPhone" className="text-xs font-semibold text-[#182820]">
                    General Inquiries Phone
                  </Label>
                  <Input
                    id="generalPhone"
                    type="tel"
                    value={generalPhone}
                    onChange={(e) => setGeneralPhone(e.target.value)}
                    className="bg-[#F7F3EA] border-[#DEDCCF] text-[#182820]"
                    maxLength={30}
                  />
                  {formErrors.generalPhone && (
                    <p className="text-xs text-[#B85C1E] font-medium">{formErrors.generalPhone}</p>
                  )}
                </div>

                {/* Registered Address */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="registeredAddress" className="text-xs font-semibold text-[#182820]">
                    Primary Registered Address
                  </Label>
                  <textarea
                    id="registeredAddress"
                    rows={3}
                    value={registeredAddress}
                    onChange={(e) => setRegisteredAddress(e.target.value)}
                    className="w-full p-2.5 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-sm text-[#182820] focus:ring-1 focus:ring-[#0B3B2E]"
                  />
                </div>
              </div>
            </div>
          </CardContent>

          <div className="p-4 bg-[#F7F3EA] border-t border-[#DEDCCF] flex items-center justify-end gap-3 rounded-b-lg">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/app/suppliers/${supplier.id}`)}
              disabled={submitting}
              className="border-[#DEDCCF] text-[#182820]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

