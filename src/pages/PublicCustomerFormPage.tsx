import React, { useState, useEffect } from 'react';
import { CheckCircle2, ShieldCheck, ArrowLeft, Send } from 'lucide-react';
import { api } from '../services/api.ts';

interface PublicCustomerFormPageProps {
  tokenOrCode?: string;
  onBackToApp?: () => void;
}

export const PublicCustomerFormPage: React.FC<PublicCustomerFormPageProps> = ({
  tokenOrCode = '',
  onBackToApp,
}) => {
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [managerInfo, setManagerInfo] = useState<{ manager_email: string; manager_name: string; company_name: string }>({
    manager_email: 'manager@example.com',
    manager_name: 'Sales Manager',
    company_name: 'Insight360 Workspace',
  });

  const [form, setForm] = useState({
    customer_name: '',
    company_name: '',
    customer_email: '',
    customer_phone: '',
    location: '',
    industry: 'Software & Technology',
    customer_type: 'Prospect',
    lead_source: 'Shareable Form Link',
    assigned_sales_exec: '',
    deal_value: '',
    sales_stage: 'Lead',
    payment_status: 'Pending',
    notes: '',
    manager_email: 'manager@example.com',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ submission_code: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        setLoadingInfo(true);
        if (tokenOrCode) {
          const info = await api.getPublicFormInfo(tokenOrCode);
          if (info && info.manager_email) {
            setManagerInfo({
              manager_email: info.manager_email,
              manager_name: info.manager_name || info.manager_email,
              company_name: info.company_name || 'Insight360 Workspace',
            });
            setForm((prev) => ({ ...prev, manager_email: info.manager_email }));
          }
        }
      } catch (e) {
        // Fall back gracefully
      } finally {
        setLoadingInfo(false);
      }
    };
    fetchInfo();
  }, [tokenOrCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!form.customer_name.trim()) {
      setErrorMessage('Customer Name is required.');
      return;
    }
    if (!form.company_name.trim()) {
      setErrorMessage('Company Name is required.');
      return;
    }
    if (!form.manager_email.trim()) {
      setErrorMessage('Manager Email is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.submitPublicCustomerForm({
        ...form,
        deal_value: parseFloat(form.deal_value) || 0,
        share_token: tokenOrCode,
      });
      setSubmittedResult({
        submission_code: res.submission_code,
        message: res.message || 'Customer request submitted successfully.',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit form.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedResult) {
    return (
      <div className="min-h-screen bg-[#f3f7f1] flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="bg-white border border-[#d7e2d8] rounded-2xl p-6 sm:p-10 max-w-lg w-full text-center shadow-xl space-y-5">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Submission Code: {submittedResult.submission_code}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#17382b] mt-3">
              Customer Submission Received!
            </h2>
            <p className="text-xs text-[#52675a] mt-2 leading-relaxed">
              Your customer submission has been saved separately as a <strong className="text-[#17382b]">Pending Request</strong> for manager review.
            </p>
          </div>

          <div className="bg-[#f8faf8] p-4 rounded-xl border border-[#e1e8e1] text-xs text-[#52675a] space-y-1 text-left">
            <p className="flex justify-between">
              <span>Customer:</span> <strong className="text-[#17382b]">{form.customer_name}</strong>
            </p>
            <p className="flex justify-between">
              <span>Company:</span> <strong className="text-[#17382b]">{form.company_name}</strong>
            </p>
            <p className="flex justify-between">
              <span>Assigned Manager:</span> <strong className="text-[#17382b]">{form.manager_email}</strong>
            </p>
            <p className="flex justify-between">
              <span>Status:</span> <span className="font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Pending</span>
            </p>
          </div>

          <p className="text-[11px] text-[#718077] italic">
            No active customer account was created automatically. The manager will review and confirm import.
          </p>

          <div className="pt-3 flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => {
                setSubmittedResult(null);
                setForm({
                  customer_name: '',
                  company_name: '',
                  customer_email: '',
                  customer_phone: '',
                  location: '',
                  industry: 'Software & Technology',
                  customer_type: 'Prospect',
                  lead_source: 'Shareable Form Link',
                  assigned_sales_exec: '',
                  deal_value: '',
                  sales_stage: 'Lead',
                  payment_status: 'Pending',
                  notes: '',
                  manager_email: managerInfo.manager_email,
                });
              }}
              className="px-4 py-2 rounded-xl bg-[#174d3b] text-white text-xs font-semibold hover:bg-[#103c2d] transition-all"
            >
              Submit Another Form
            </button>
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="px-4 py-2 rounded-xl border border-[#d4dfd5] text-[#52675a] text-xs font-semibold hover:bg-[#f3f7f1] transition-all"
              >
                Back to App
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f7f1] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/insight360-logo.jpg" alt="Insight360 Logo" className="h-10 w-10 object-contain rounded-xl bg-white p-0.5 shadow-sm border border-[#dce6de]" />
            <div>
              <h1 className="text-lg font-bold text-[#17382b]">Insight360</h1>
              <p className="text-[11px] text-[#52675a]">Customer Intelligence Platform</p>
            </div>
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd8ce] text-xs font-semibold text-[#52675a] hover:bg-white transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to CRM</span>
            </button>
          )}
        </div>

        {/* Form Container Card */}
        <div className="bg-white border border-[#dce6de] rounded-2xl shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="bg-[#174d3b] px-6 py-6 text-white space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#d2ebd7]">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Customer Submission Form</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Submit New Customer Details</h2>
            <p className="text-xs text-[#b8d4bd] pt-1">
              Information submitted here will be saved for manager review ({managerInfo.manager_email}). No active customer record will be created automatically.
            </p>
          </div>

          {errorMessage && (
            <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 text-xs text-[#17382b]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABC Technologies Ltd"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Customer Email</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Customer Phone</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Location / Address</label>
                <input
                  type="text"
                  placeholder="City, Region, State"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Industry</label>
                <select
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                >
                  <option value="Software & Technology">Software &amp; Technology</option>
                  <option value="Financial Services">Financial Services</option>
                  <option value="Healthcare & Biotech">Healthcare &amp; Biotech</option>
                  <option value="Manufacturing & Industrial">Manufacturing &amp; Industrial</option>
                  <option value="Logistics & Supply Chain">Logistics &amp; Supply Chain</option>
                  <option value="Retail & E-commerce">Retail &amp; E-commerce</option>
                  <option value="Professional Services">Professional Services</option>
                  <option value="CleanTech & Energy">CleanTech &amp; Energy</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Customer Type</label>
                <select
                  value={form.customer_type}
                  onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                >
                  <option value="Prospect">Prospect</option>
                  <option value="Active Client">Active Client</option>
                  <option value="Enterprise Partner">Enterprise Partner</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Lead Source</label>
                <input
                  type="text"
                  placeholder="Website Form, Referral, Trade Show..."
                  value={form.lead_source}
                  onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Assigned Sales Executive</label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Brody"
                  value={form.assigned_sales_exec}
                  onChange={(e) => setForm({ ...form, assigned_sales_exec: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Deal Value (₹)</label>
                <input
                  type="number"
                  placeholder="50000"
                  value={form.deal_value}
                  onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Sales Stage</label>
                <select
                  value={form.sales_stage}
                  onChange={(e) => setForm({ ...form, sales_stage: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                >
                  <option value="Lead">Lead</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Proposal Sent">Proposal Sent</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Closed Won">Closed Won</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#42544a]">Payment Status</label>
                <select
                  value={form.payment_status}
                  onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                  className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
                >
                  <option value="Pending">Pending</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Fully Paid">Fully Paid</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-[#42544a]">Notes / Remarks</label>
              <textarea
                rows={3}
                placeholder="Additional requirements, contract terms, or background info..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-[#f8faf8] border border-[#cbd8ce] rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174d3b]/20"
              />
            </div>

            <div className="p-3 bg-[#edf3ed] border border-[#dce6de] rounded-xl flex items-center justify-between gap-3">
              <div>
                <label className="block font-bold text-[#17382b]">Manager Email *</label>
                <p className="text-[10px] text-[#52675a]">Identifies which manager receives and reviews this submission in their portal.</p>
              </div>
              <input
                type="email"
                required
                value={form.manager_email}
                onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
                className="w-64 bg-white border border-[#cbd8ce] rounded-lg px-3 py-2 text-xs font-semibold text-[#17382b]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-[#edf1ed]">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#174d3b] text-white font-bold text-xs shadow-md shadow-[#174d3b]/20 hover:bg-[#103c2d] transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting Request...' : 'Submit Customer Request'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
