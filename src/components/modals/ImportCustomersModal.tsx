import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { Customer } from '../../types/index.ts';

interface ImportCustomersModalProps {
  existingCustomers: Customer[];
  onClose: () => void;
  onImportComplete: () => void;
}

export const ImportCustomersModal: React.FC<ImportCustomersModalProps> = ({
  existingCustomers,
  onClose,
  onImportComplete,
}) => {
  const { success, error } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [forceImport, setForceImport] = useState(false);
  const [importing, setImporting] = useState(false);

  const processParsedData = (data: any[]) => {
    const existingEmails = new Set(existingCustomers.map((c) => (c.email || '').toLowerCase()).filter(Boolean));
    const existingKeys = new Set(existingCustomers.map((c) => `${(c.company || '').toLowerCase()}||${(c.name || '').toLowerCase()}`));

    let dups = 0;
    const processed = data.map((row: any, idx: number) => {
      const name = String(row['Customer Name'] || row['Name'] || row.customer_name || row.name || '').trim();
      const company = String(row['Company Name'] || row['Company'] || row.company_name || row.company || '').trim();
      const email = String(row['Customer Email'] || row['Email'] || row.customer_email || row.email || '').trim();
      const phone = String(row['Customer Phone'] || row['Phone'] || row.customer_phone || row.phone || '').trim();
      const industry = String(row['Industry'] || row.industry || 'General').trim();
      const dealValue = Number(row['Deal Value'] || row.deal_value || 0);
      const notes = String(row['Notes'] || row.notes || '').trim();

      const key = `${company.toLowerCase()}||${name.toLowerCase()}`;
      const isDuplicate = Boolean(
        (email && existingEmails.has(email.toLowerCase())) ||
        (company && name && existingKeys.has(key))
      );

      if (isDuplicate) dups++;

      return {
        id: idx + 1,
        customer_name: name,
        company_name: company,
        customer_email: email,
        customer_phone: phone,
        industry,
        deal_value: dealValue,
        notes,
        isDuplicate,
      };
    });

    setParsedRows(processed);
    setDuplicatesCount(dups);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          error('Uploaded file appears to be empty.');
          return;
        }

        processParsedData(data);
      } catch (err: any) {
        error('Failed to parse Excel/CSV file', err.message);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleConfirmImport = async () => {
    if (!parsedRows.length) return;

    try {
      setImporting(true);
      const res = await api.importCustomersBatch(parsedRows, forceImport);
      success(res.message || `Successfully imported ${res.importedCount} customers!`);
      onImportComplete();
      onClose();
    } catch (err: any) {
      error('Import failed', err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import Customers (Excel / CSV)</h3>
              <p className="text-xs text-slate-400">Upload `.xlsx`, `.xls`, or `.csv` files to preview before importing into active customers database.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: File Input */}
        {!parsedRows.length ? (
          <div className="p-8 border-2 border-dashed border-slate-700 rounded-2xl text-center bg-slate-950/50 hover:bg-slate-950 transition-colors">
            <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-200">Click to upload Excel or CSV file</p>
            <p className="text-xs text-slate-500 mt-1">Supports .xlsx, .xls, and .csv format</p>

            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
              id="customer-file-input"
            />
            <label
              htmlFor="customer-file-input"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md cursor-pointer transition-all"
            >
              <span>Browse File</span>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info Header */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-white">File: {file?.name} ({parsedRows.length} records parsed)</span>
              <button
                onClick={() => {
                  setParsedRows([]);
                  setFile(null);
                }}
                className="text-indigo-400 hover:underline text-[11px]"
              >
                Change File
              </button>
            </div>

            {/* Duplicate Warning Banner */}
            {duplicatesCount > 0 && (
              <div className="p-3.5 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>{duplicatesCount} Potential Duplicate Customer(s) Detected!</span>
                </div>
                <p className="text-amber-200/80 text-[11px] leading-relaxed">
                  Some records in your file match existing active customer emails or company names. You can choose to skip duplicate rows or force import them.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="forceImportCheckbox"
                    checked={forceImport}
                    onChange={(e) => setForceImport(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <label htmlFor="forceImportCheckbox" className="text-amber-200 text-xs font-semibold cursor-pointer">
                    Force import duplicate records anyway
                  </label>
                </div>
              </div>
            )}

            {/* Preview Table */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Import Data Preview:
              </span>
              <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3">Industry</th>
                      <th className="py-2.5 px-3">Deal Value</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {parsedRows.map((row) => (
                      <tr key={row.id} className={`hover:bg-slate-800/40 ${row.isDuplicate ? 'bg-amber-950/20' : ''}`}>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{row.id}</td>
                        <td className="py-2 px-3 font-semibold text-white">{row.customer_name || 'N/A'}</td>
                        <td className="py-2 px-3 text-slate-300">{row.company_name || 'N/A'}</td>
                        <td className="py-2 px-3 text-slate-400">{row.customer_email || '—'}</td>
                        <td className="py-2 px-3 text-slate-400">{row.customer_phone || '—'}</td>
                        <td className="py-2 px-3 text-slate-300">{row.industry}</td>
                        <td className="py-2 px-3 font-bold text-emerald-400">
                          {row.deal_value ? `₹${row.deal_value.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.isDuplicate ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Duplicate
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all"
          >
            Cancel
          </button>

          {parsedRows.length > 0 && (
            <button
              onClick={handleConfirmImport}
              disabled={importing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{importing ? 'Importing Customers...' : `Confirm & Import ${parsedRows.length} Customer(s)`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
