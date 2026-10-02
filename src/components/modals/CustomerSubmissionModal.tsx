import React, { useState } from 'react';
import { FilePlus, X, Send, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface CustomerSubmissionModalProps {
  onClose: () => void;
  onSubmitted: () => void;
}

export const CustomerSubmissionModal: React.FC<CustomerSubmissionModalProps> = ({
  onClose,
  onSubmitted,
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [form, setForm] = useState({
    customer_name: '',
    company_name: '',
    customer_email: '',
    customer_phone: '',
    location: '',
    industry: 'Software & Technology',
    customer_type: 'Prospect',
    lead_source: 'Internal Submission',
    assigned_sales_exec: user?.full_name || '',
    deal_value: '',
    sales_stage: 'Lead',
    payment_status: 'Pending',
    notes: '',
    manager_email: user?.email || 'manager@example.com',
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.company_name.trim() || !form.manager_email.trim()) {
      error('Customer Name, Company Name, and Manager Email are required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.submitInternalCustomerForm({
        ...form,
        deal_value: parseFloat(form.deal_value) || 0,
      });

      success(res.message || 'Saved as Pending Submission!');
      onSubmitted();
      onClose();
    } catch (err: any) {
      error('Could not save submission', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">New Customer Submission Form</h3>
              <p className="text-xs text-slate-400">Saves as Pending Submission for manager review. (No active customer created automatically).</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Customer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Company Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. ABC Technologies Ltd"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Customer Email</label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Customer Phone</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Location / Address</label>
              <input
                type="text"
                placeholder="City, State"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Industry</label>
              <select
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              >
                <option value="Software & Technology">Software &amp; Technology</option>
                <option value="Financial Services">Financial Services</option>
                <option value="Healthcare & Biotech">Healthcare &amp; Biotech</option>
                <option value="Manufacturing & Industrial">Manufacturing &amp; Industrial</option>
                <option value="Logistics & Supply Chain">Logistics &amp; Supply Chain</option>
                <option value="Retail & E-commerce">Retail &amp; E-commerce</option>
                <option value="Professional Services">Professional Services</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Customer Type</label>
              <select
                value={form.customer_type}
                onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              >
                <option value="Prospect">Prospect</option>
                <option value="Active Client">Active Client</option>
                <option value="Enterprise Partner">Enterprise Partner</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Lead Source</label>
              <input
                type="text"
                value={form.lead_source}
                onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Assigned Sales Executive</label>
              <input
                type="text"
                value={form.assigned_sales_exec}
                onChange={(e) => setForm({ ...form, assigned_sales_exec: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Deal Value (₹)</label>
              <input
                type="number"
                placeholder="50000"
                value={form.deal_value}
                onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Sales Stage</label>
              <select
                value={form.sales_stage}
                onChange={(e) => setForm({ ...form, sales_stage: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              >
                <option value="Lead">Lead</option>
                <option value="Contacted">Contacted</option>
                <option value="Proposal Sent">Proposal Sent</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closed Won">Closed Won</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Payment Status</label>
              <select
                value={form.payment_status}
                onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
              >
                <option value="Pending">Pending</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Fully Paid">Fully Paid</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Notes / Remarks</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-bold text-white">Manager Email *</label>
              <p className="text-[10px] text-slate-400">Determines which manager receives this request in their portal.</p>
            </div>
            <input
              type="email"
              required
              value={form.manager_email}
              onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
              className="w-64 bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving Request...' : 'Save as Pending Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
