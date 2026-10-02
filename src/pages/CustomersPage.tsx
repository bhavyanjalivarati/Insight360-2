import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
  ArrowUpDown,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  X,
  Sparkles,
  FileSpreadsheet,
  FilePlus,
  Upload,
  Share2,
  Copy,
  ExternalLink,
  Clock,
  AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Customer, User } from '../types/index.ts';
import { ImportCustomersModal } from '../components/modals/ImportCustomersModal.tsx';
import { CustomerSubmissionModal } from '../components/modals/CustomerSubmissionModal.tsx';

interface CustomersPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const isSalesExec = user?.role === 'Sales Executive';
  const isManager = user?.role === 'Sales Manager' || (user?.role as string) === 'Admin';

  const [activeTab, setActiveTab] = useState<'active-customers' | 'customer-requests'>('active-customers');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSubmissions, setCustomerSubmissions] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('created');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLinkInfo, setShareLinkInfo] = useState<any>(null);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<number | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<number[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    industry: '',
    status: 'Active',
    assigned_user_id: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [custRes, userRes, subRes] = await Promise.all([
        api.getCustomers({ search, status: statusFilter, sort: sortField }),
        api.getUsers(),
        api.getCustomerSubmissions().catch(() => ({ submissions: [] })),
      ]);
      setCustomers(custRes.customers);
      setUsers(userRes.users);
      setCustomerSubmissions(subRes.submissions || []);
    } catch (err: any) {
      error('Failed to load customers', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, sortField]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      industry: 'Enterprise Software',
      status: 'Active',
      assigned_user_id: users[0]?.id ? String(users[0].id) : '',
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone || '',
      address: c.address || '',
      industry: c.industry || '',
      status: c.status || 'Active',
      assigned_user_id: c.assigned_user_id ? String(c.assigned_user_id) : '',
      notes: c.notes || '',
    });
    setShowAddModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.company.trim() || !formData.email.trim()) {
      error('Name, Company, and Email are required.');
      return;
    }

    try {
      const payload = {
        ...formData,
        assigned_user_id: formData.assigned_user_id ? parseInt(formData.assigned_user_id, 10) : null,
      };

      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload);
        success('Customer profile updated');
      } else {
        await api.createCustomer(payload);
        success('New customer created successfully');
      }

      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      error('Failed to save customer', err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteCustomer(id);
      success('Customer deleted');
      setDeletingCustomerId(null);
      loadData();
    } catch (err: any) {
      error('Failed to delete customer', err.message);
    }
  };

  // Export Active Customers to CSV
  const handleExportCSV = () => {
    if (customers.length === 0) {
      error('No customer records to export');
      return;
    }

    const headers = ['Code', 'Name', 'Company', 'Email', 'Phone', 'Industry', 'Status', 'Assigned Executive', 'Total Orders', 'Total Revenue'];
    const rows = customers.map((c) => [
      c.customer_code,
      `"${c.name}"`,
      `"${c.company}"`,
      c.email,
      c.phone || '',
      c.industry || '',
      c.status,
      c.assigned_name || '',
      c.total_orders || 0,
      c.total_revenue || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Customers exported to CSV successfully');
  };

  // Export Customer Submissions / Requests to Excel (.xlsx)
  const handleExportSubmissionsExcel = () => {
    const listToExport = filteredSubmissions;
    if (!listToExport.length) {
      error('No customer requests available to export.');
      return;
    }

    const exportData = listToExport.map((s) => ({
      'Submission Code': s.submission_code,
      'Customer Name': s.customer_name,
      'Company Name': s.company_name,
      'Customer Email': s.customer_email || '',
      'Customer Phone': s.customer_phone || '',
      'Location / Address': s.location || '',
      'Industry': s.industry || '',
      'Customer Type': s.customer_type || '',
      'Lead Source': s.lead_source || '',
      'Assigned Executive': s.assigned_sales_exec || '',
      'Deal Value (₹)': s.deal_value || 0,
      'Sales Stage': s.sales_stage || '',
      'Payment Status': s.payment_status || '',
      'Manager Email': s.manager_email || '',
      'Status': s.status,
      'Submission Date': s.created_at ? new Date(s.created_at).toLocaleDateString() : '',
      'Notes': s.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Requests');
    XLSX.writeFile(workbook, `Customer_Requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
    success('Customer Requests exported to Excel (.xlsx) successfully');
  };

  // Export Customer Submissions / Requests to CSV (.csv)
  const handleExportSubmissionsCSV = () => {
    const listToExport = filteredSubmissions;
    if (!listToExport.length) {
      error('No customer requests available to export.');
      return;
    }

    const exportData = listToExport.map((s) => ({
      'Submission Code': s.submission_code,
      'Customer Name': s.customer_name,
      'Company Name': s.company_name,
      'Customer Email': s.customer_email || '',
      'Customer Phone': s.customer_phone || '',
      'Location / Address': s.location || '',
      'Industry': s.industry || '',
      'Customer Type': s.customer_type || '',
      'Lead Source': s.lead_source || '',
      'Assigned Executive': s.assigned_sales_exec || '',
      'Deal Value (₹)': s.deal_value || 0,
      'Sales Stage': s.sales_stage || '',
      'Payment Status': s.payment_status || '',
      'Manager Email': s.manager_email || '',
      'Status': s.status,
      'Submission Date': s.created_at ? new Date(s.created_at).toLocaleDateString() : '',
      'Notes': s.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Customer_Requests_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    success('Customer Requests exported to CSV successfully');
  };

  // Open Share Form Link modal
  const handleOpenShareLink = async () => {
    try {
      const res = await api.getManagerShareLink();
      setShareLinkInfo(res);
      setShowShareModal(true);
    } catch (err: any) {
      const userEmail = user?.email || 'manager@example.com';
      const shareUrl = `${window.location.origin}/customer-form/${encodeURIComponent(userEmail)}`;
      setShareLinkInfo({
        manager_email: userEmail,
        manager_name: user?.full_name || 'Sales Manager',
        share_token: userEmail,
        share_url: shareUrl
      });
      setShowShareModal(true);
    }
  };

  // Import Batch Submissions to Active Customers
  const handleImportSubmissionsBatch = async (ids: number[]) => {
    if (!ids.length) {
      error('Select at least one submission to import.');
      return;
    }

    try {
      const res = await api.importSubmissionsBatch(ids);
      success(res.message);
      setSelectedSubmissionIds([]);
      loadData();
    } catch (err: any) {
      error('Failed to import submissions', err.message);
    }
  };

  // Reject Customer Submission
  const handleRejectSubmission = async (id: number) => {
    try {
      await api.updateSubmissionStatus(id, 'Rejected');
      success('Submission marked as Rejected');
      loadData();
    } catch (err: any) {
      error('Failed to reject submission', err.message);
    }
  };

  const pendingCount = customerSubmissions.filter((s) => s.status === 'Pending').length;

  const filteredSubmissions = customerSubmissions.filter((s) => {
    if (submissionStatusFilter !== 'all' && s.status !== submissionStatusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (s.customer_name || '').toLowerCase().includes(q) ||
        (s.company_name || '').toLowerCase().includes(q) ||
        (s.customer_email || '').toLowerCase().includes(q) ||
        (s.submission_code || '').toLowerCase().includes(q) ||
        (s.industry || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Main Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {isSalesExec ? 'My Customers & Deals' : 'Customer Management'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
              {customers.length} {isSalesExec ? 'Assigned' : 'Active'} Customers
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isSalesExec
              ? 'Manage your assigned customers, deals, follow-ups, and submit new customer requests to your manager.'
              : 'Review customer requests, approve submissions, import confirmed customers, and monitor your team pipeline.'}
          </p>
        </div>

        {/* Top Action Buttons — role-based */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Sales Executive: Submit Customer Submission Form */}
          {isSalesExec && (
            <button
              onClick={() => setShowSubmissionModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
              title="Submit a new Customer Submission to your manager for review"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>Customer Submission Form</span>
            </button>
          )}

          {/* Manager only: Import Customers from Excel/CSV */}
          {isManager && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700 text-xs font-semibold transition-all shadow-sm"
              title="Upload Excel or CSV file to import customers with duplicate check"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-300" />
              <span>Import Customers</span>
            </button>
          )}

          {/* Manager only: Share Form Link */}
          {isManager && (
            <button
              onClick={handleOpenShareLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
              title="Generate and share Customer Submission Form link for customers or field teams"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Share Form Link</span>
            </button>
          )}

          {/* Manager only: Add Active Customer directly */}
          {isManager && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs — Manager sees both; Sales Exec only sees customers */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('active-customers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'active-customers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isSalesExec ? `My Assigned Customers (${customers.length})` : `All Active Customers (${customers.length})`}</span>
        </button>

        {/* Customer Requests tab — MANAGER ONLY */}
        {isManager && (
          <button
            onClick={() => setActiveTab('customer-requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'customer-requests'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Customer Requests</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {pendingCount} Pending
              </span>
            )}
          </button>
        )}
      </div>

      {/* View 1: Active Customers Directory */}
      {activeTab === 'active-customers' && (
        <div className="space-y-4">
          {/* Search, Filter & Sort Controls */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by customer name, company, email, or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800/90 text-xs text-white pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all" className="bg-slate-900">All Statuses</option>
                  <option value="Active" className="bg-slate-900">Active</option>
                  <option value="VIP" className="bg-slate-900">VIP</option>
                  <option value="Lead" className="bg-slate-900">Lead</option>
                  <option value="Churned" className="bg-slate-900">Churned</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="created" className="bg-slate-900">Newest Created</option>
                  <option value="name" className="bg-slate-900">Contact Name</option>
                  <option value="company" className="bg-slate-900">Company Name</option>
                  <option value="revenue" className="bg-slate-900">Highest Revenue</option>
                </select>
              </div>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Customer Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading customer directory...</div>
            ) : customers.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-300">No active customers found</p>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or import customers from file.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Customer / Company</th>
                      <th className="py-3 px-4">Contact Details</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Assigned Rep</th>
                      <th className="py-3 px-4">Orders &amp; Revenue</th>
                      <th className="py-3 px-4">Last Activity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {customers.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => onNavigate('customer-360', { customerId: c.id })}
                        className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
                            {c.company}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-medium text-slate-300">{c.name}</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {c.customer_code}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-300">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{c.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{c.phone}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              c.status === 'VIP'
                                ? 'bg-amber-950/40 text-amber-300 border-amber-800/80'
                                : c.status === 'Active'
                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80'
                                : c.status === 'Lead'
                                ? 'bg-sky-950/40 text-sky-300 border-sky-800/80'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-300 font-medium">
                          {c.assigned_name || <span className="text-slate-500 italic">Unassigned</span>}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-emerald-400">
                            ${c.total_revenue?.toLocaleString() || 0}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {c.total_orders || 0} completed orders
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {c.last_interaction ? (
                            <span>{new Date(c.last_interaction).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-slate-600">No interaction</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('customer-360', { customerId: c.id });
                              }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                              title="View 360° Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleOpenEdit(c, e)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Edit Customer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingCustomerId(c.id);
                              }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                              title="Delete Customer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 2: Customer Requests (Pending Submissions) */}
      {activeTab === 'customer-requests' && (
        <div className="space-y-4">
          {/* Controls Bar for Submissions */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search requests by name, company, email, or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800/90 text-xs text-white pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={submissionStatusFilter}
                  onChange={(e) => setSubmissionStatusFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all" className="bg-slate-900">All Request Statuses</option>
                  <option value="Pending" className="bg-slate-900">Pending</option>
                  <option value="Imported" className="bg-slate-900">Imported</option>
                  <option value="Rejected" className="bg-slate-900">Rejected</option>
                </select>
              </div>

              {/* Import Selected Submissions — Manager only */}
              {isManager && selectedSubmissionIds.length > 0 && (
                <button
                  onClick={() => handleImportSubmissionsBatch(selectedSubmissionIds)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Selected ({selectedSubmissionIds.length})</span>
                </button>
              )}

              {/* Export to Excel — Manager only */}
              {isManager && (
                <button
                  onClick={handleExportSubmissionsExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 text-xs font-semibold transition-all"
                  title="Download Customer Requests as Excel .xlsx file"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export to Excel (.xlsx)</span>
                </button>
              )}

              {/* Export to CSV — Manager only */}
              {isManager && (
                <button
                  onClick={handleExportSubmissionsCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
                  title="Download Customer Requests as CSV file"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* Submissions Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading customer requests...</div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-300">No customer requests found</p>
                <p className="text-xs text-slate-500 mt-1">
                  When new forms are submitted via the Shareable Form Link or internal form, they will appear here as Pending Submissions.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedSubmissionIds.length === filteredSubmissions.filter(s => s.status === 'Pending').length && selectedSubmissionIds.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubmissionIds(filteredSubmissions.filter(s => s.status === 'Pending').map(s => s.id));
                            } else {
                              setSelectedSubmissionIds([]);
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-900"
                        />
                      </th>
                      <th className="py-3 px-4">Customer / Company</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Industry / Location</th>
                      <th className="py-3 px-4">Deal Value / Stage</th>
                      <th className="py-3 px-4">Manager Email</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Submitted Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredSubmissions.map((sub) => {
                      const isSelected = selectedSubmissionIds.includes(sub.id);
                      return (
                        <tr key={sub.id} className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-indigo-950/20' : ''}`}>
                          <td className="py-3 px-4 text-center">
                            {sub.status === 'Pending' && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSubmissionIds([...selectedSubmissionIds, sub.id]);
                                  } else {
                                    setSelectedSubmissionIds(selectedSubmissionIds.filter(id => id !== sub.id));
                                  }
                                }}
                                className="rounded border-slate-700 bg-slate-900"
                              />
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-200">
                            <div>{sub.company_name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              {sub.customer_name} <span className="font-mono text-[10px] text-indigo-400">({sub.submission_code})</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <div>{sub.customer_email || '—'}</div>
                            <div className="text-[11px] text-slate-400">{sub.customer_phone || '—'}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <div>{sub.industry || 'General'}</div>
                            <div className="text-[11px] text-slate-400">{sub.location || '—'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-emerald-400">
                              {sub.deal_value ? `₹${Number(sub.deal_value).toLocaleString('en-IN')}` : '—'}
                            </div>
                            <div className="text-[10px] text-slate-400">{sub.sales_stage || 'Lead'}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                            {sub.manager_email}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                sub.status === 'Imported'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                  : sub.status === 'Rejected'
                                  ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {new Date(sub.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {sub.status === 'Pending' && isManager ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleImportSubmissionsBatch([sub.id])}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition-all"
                                  title="Approve & Import into Active Customers"
                                >
                                  ✓ Import
                                </button>
                                <button
                                  onClick={() => handleRejectSubmission(sub.id)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white font-semibold text-[11px] transition-all"
                                  title="Reject Submission"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">{sub.status === 'Pending' ? 'Awaiting Review' : 'Processed'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Form Link Modal */}
      {showShareModal && shareLinkInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">Shareable Customer Form Link</h3>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Anyone opening this unique share link can fill out the Customer Submission Form. All submitted requests will automatically land in your <strong className="text-white">Customer Requests</strong> queue for review ({shareLinkInfo.manager_email}).
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Shareable URL:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLinkInfo.share_url}
                  className="flex-1 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-mono border border-slate-700 select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLinkInfo.share_url);
                    success('Shareable link copied to clipboard!');
                  }}
                  className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-1"
                  title="Copy Link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <a
                href={shareLinkInfo.share_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Preview Public Form</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Customer Submission Form Modal */}
      {showSubmissionModal && (
        <CustomerSubmissionModal
          onClose={() => setShowSubmissionModal(false)}
          onSubmitted={() => {
            loadData();
            setActiveTab('customer-requests');
          }}
        />
      )}

      {/* Excel / CSV Import Customers Modal */}
      {showImportModal && (
        <ImportCustomersModal
          existingCustomers={customers}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            loadData();
            setActiveTab('active-customers');
          }}
        />
      )}

      {/* Add / Edit Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Primary Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                    placeholder="jane@acme.com"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Industry</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Healthcare, FinTech"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="VIP">VIP</option>
                    <option value="Lead">Lead</option>
                    <option value="Churned">Churned</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assigned Sales Executive</label>
                <select
                  value={formData.assigned_user_id}
                  onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                  placeholder="Street, City, State, Country"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Internal Strategic Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                  placeholder="Special client requirements, SLA agreements, or growth plans..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30"
                >
                  {editingCustomer ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Delete Customer Account?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will permanently delete this customer record and its associated opportunities, follow-ups, and logs from the database.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingCustomerId(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingCustomerId)}
                className="px-3.5 py-1.5 rounded-lg text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
