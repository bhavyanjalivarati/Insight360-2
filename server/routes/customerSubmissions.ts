import express, { Response } from 'express';
import { all, get, run } from '../db/database.ts';
import { AuthenticatedRequest, authenticate, requireRoles } from '../middleware/auth.ts';
import { logAudit, notifyUser } from '../services/auditService.ts';
import { normalizePhone } from '../utils/phone.ts';

const router = express.Router();

// Helper to generate unique submission code
function generateSubmissionCode(): string {
  const code = `SUB-${Math.floor(100000 + Math.random() * 900000)}`;
  const existing = get<any>('SELECT id FROM customer_submissions WHERE submission_code = ?', [code]);
  return existing ? generateSubmissionCode() : code;
}

// Helper to generate unique customer code
function generateCustomerCode(): string {
  const lastCust = get<any>('SELECT customer_code FROM customers ORDER BY id DESC LIMIT 1');
  let nextNum = 1001;
  if (lastCust && lastCust.customer_code) {
    const match = lastCust.customer_code.match(/\d+/);
    if (match) {
      nextNum = parseInt(match[0], 10) + 1;
    }
  }
  let code = `CUST-${nextNum}`;
  while (get<any>('SELECT id FROM customers WHERE customer_code = ?', [code])) {
    nextNum++;
    code = `CUST-${nextNum}`;
  }
  return code;
}

// 1. PUBLIC: Get Shareable Form Link Info
router.get('/customer-submissions/public-info/:tokenOrCode', (req, res: Response) => {
  try {
    const param = String(req.params.tokenOrCode).trim();
    // Check if token matches a user (manager) by email/token or code
    const managerUser = get<any>(
      'SELECT id, email, full_name FROM users WHERE email = ? OR id = ? OR LOWER(full_name) = ?',
      [param, Number(param) || 0, param.toLowerCase()]
    );

    if (managerUser) {
      res.json({
        valid: true,
        manager_email: managerUser.email,
        manager_name: managerUser.full_name,
        company_name: 'Insight360 Workspace'
      });
      return;
    }

    // Default fallback if parameter is email or token
    if (param.includes('@')) {
      res.json({
        valid: true,
        manager_email: param,
        manager_name: param.split('@')[0],
        company_name: 'Insight360 Workspace'
      });
      return;
    }

    // Default response for any token
    res.json({
      valid: true,
      manager_email: 'manager@example.com',
      manager_name: 'Sales Manager',
      company_name: 'Insight360 Workspace'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not load form metadata.' });
  }
});

// 2. PUBLIC: Submit Form (Does NOT create an active customer!)
router.post('/customer-submissions/public', (req, res: Response) => {
  try {
    const {
      customer_name,
      company_name,
      customer_email = '',
      customer_phone = '',
      location = '',
      industry = '',
      customer_type = 'Prospect',
      lead_source = 'Website Form',
      assigned_sales_exec = '',
      deal_value = 0,
      sales_stage = 'Lead',
      payment_status = 'Pending',
      notes = '',
      manager_email = '',
      share_token = ''
    } = req.body;

    if (!customer_name || !String(customer_name).trim()) {
      res.status(400).json({ error: 'Customer Name is required.' });
      return;
    }
    if (!company_name || !String(company_name).trim()) {
      res.status(400).json({ error: 'Company Name is required.' });
      return;
    }
    if (!manager_email || !String(manager_email).trim()) {
      res.status(400).json({ error: 'Manager Email is required.' });
      return;
    }

    const submissionCode = generateSubmissionCode();
    const now = new Date().toISOString();

    const result = run(
      `INSERT INTO customer_submissions (
        submission_code, customer_name, company_name, customer_email, customer_phone,
        location, industry, customer_type, lead_source, assigned_sales_exec,
        deal_value, sales_stage, payment_status, notes, manager_email,
        share_token, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
      [
        submissionCode,
        String(customer_name).trim(),
        String(company_name).trim(),
        String(customer_email).trim(),
        String(customer_phone).trim(),
        String(location).trim(),
        String(industry).trim(),
        String(customer_type).trim(),
        String(lead_source).trim(),
        String(assigned_sales_exec).trim(),
        Number(deal_value) || 0,
        String(sales_stage).trim(),
        String(payment_status).trim(),
        String(notes).trim(),
        String(manager_email).trim().toLowerCase(),
        String(share_token).trim(),
        now,
        now
      ]
    );

    // Notify manager if manager user exists
    const managerUser = get<any>('SELECT id FROM users WHERE LOWER(email) = ?', [String(manager_email).trim().toLowerCase()]);
    if (managerUser) {
      notifyUser(
        managerUser.id,
        'New Customer Submission Received',
        `New pending submission from ${customer_name} (${company_name}). Awaiting your review in Customer Requests.`,
        'customer-request',
        '/customers'
      );
    }

    res.json({
      success: true,
      submission_id: result.lastInsertRowid,
      submission_code: submissionCode,
      message: 'Thank you! Your submission has been received and queued for manager review.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Could not submit customer request.' });
  }
});

// 3. AUTHENTICATED: Get Shareable Link for Manager
router.get('/customer-submissions/share-link', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userEmail = req.user?.email || 'manager@example.com';
    const managerName = req.user?.full_name || 'Sales Manager';
    const shareToken = Buffer.from(userEmail).toString('base64').replace(/=/g, '');
    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:3000';
    const shareUrl = `${protocol}://${host}/customer-form/${encodeURIComponent(userEmail)}`;

    res.json({
      manager_email: userEmail,
      manager_name: managerName,
      share_token: shareToken,
      share_url: shareUrl
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not generate share link.' });
  }
});

// 4. AUTHENTICATED: Get Customer Requests for Manager / Admin / Sales Executive
router.get('/customer-submissions', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userEmail = req.user?.email ? req.user.email.toLowerCase() : '';
    const userName = req.user?.full_name ? req.user.full_name.toLowerCase() : '';

    let submissions: any[] = [];

    if ((userRole as string) === 'Admin' || userRole === 'Sales Manager') {
      // Sales Managers & Admins can see all submissions
      submissions = all<any>('SELECT * FROM customer_submissions ORDER BY CASE WHEN status = "Pending" THEN 0 ELSE 1 END, created_at DESC');
    } else if (userRole === 'Sales Executive') {
      // Sales Executives see submissions assigned specifically to them
      submissions = all<any>(
        'SELECT * FROM customer_submissions WHERE LOWER(assigned_sales_exec) = ? OR LOWER(assigned_sales_exec) = ? ORDER BY CASE WHEN status = "Pending" THEN 0 ELSE 1 END, created_at DESC',
        [userName, userEmail]
      );
    } else {
      // Default manager email filter
      submissions = all<any>(
        'SELECT * FROM customer_submissions WHERE LOWER(manager_email) = ? OR LOWER(manager_email) = "" ORDER BY CASE WHEN status = "Pending" THEN 0 ELSE 1 END, created_at DESC',
        [userEmail]
      );
    }

    res.json({ submissions, count: submissions.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not load customer requests.' });
  }
});

// 5. AUTHENTICATED: Internal Customer Submission
router.post('/customer-submissions', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customer_name,
      company_name,
      customer_email = '',
      customer_phone = '',
      location = '',
      industry = '',
      customer_type = 'Prospect',
      lead_source = 'Internal Form',
      assigned_sales_exec = req.user?.full_name || '',
      deal_value = 0,
      sales_stage = 'Lead',
      payment_status = 'Pending',
      notes = '',
      manager_email = req.user?.email || ''
    } = req.body;

    if (!customer_name || !String(customer_name).trim()) {
      res.status(400).json({ error: 'Customer Name is required.' });
      return;
    }
    if (!company_name || !String(company_name).trim()) {
      res.status(400).json({ error: 'Company Name is required.' });
      return;
    }

    const submissionCode = generateSubmissionCode();
    const now = new Date().toISOString();

    const result = run(
      `INSERT INTO customer_submissions (
        submission_code, customer_name, company_name, customer_email, customer_phone,
        location, industry, customer_type, lead_source, assigned_sales_exec,
        deal_value, sales_stage, payment_status, notes, manager_email,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`,
      [
        submissionCode,
        String(customer_name).trim(),
        String(company_name).trim(),
        String(customer_email).trim(),
        String(customer_phone).trim(),
        String(location).trim(),
        String(industry).trim(),
        String(customer_type).trim(),
        String(lead_source).trim(),
        String(assigned_sales_exec).trim(),
        Number(deal_value) || 0,
        String(sales_stage).trim(),
        String(payment_status).trim(),
        String(notes).trim(),
        String(manager_email).trim().toLowerCase(),
        now,
        now
      ]
    );

    res.json({
      success: true,
      submission_id: result.lastInsertRowid,
      submission_code: submissionCode,
      message: 'Customer request saved as Pending Submission.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Could not save customer submission.' });
  }
});

// 6. AUTHENTICATED: Update Submission Status (e.g. Reject)
router.put('/customer-submissions/:id/status', authenticate, requireRoles(['Sales Manager', 'Admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!['Pending', 'Imported', 'Rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }
    const now = new Date().toISOString();
    run('UPDATE customer_submissions SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
    res.json({ success: true, message: `Submission status updated to ${status}` });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not update submission status.' });
  }
});

// 7. AUTHENTICATED: Import Confirmed Submissions into Actual Customers Table
router.post('/customer-submissions/import-batch', authenticate, requireRoles(['Sales Manager', 'Admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submission_ids = [] } = req.body;
    if (!Array.isArray(submission_ids) || submission_ids.length === 0) {
      res.status(400).json({ error: 'Please select at least one submission to import.' });
      return;
    }

    const now = new Date().toISOString();
    let importedCount = 0;
    let skippedCount = 0;

    for (const subId of submission_ids) {
      const sub = get<any>('SELECT * FROM customer_submissions WHERE id = ?', [Number(subId)]);
      if (!sub) continue;

      // Duplicate Check
      const existing = get<any>(
        'SELECT id FROM customers WHERE (email = ? AND email != "") OR (LOWER(company) = ? AND LOWER(name) = ?)',
        [sub.customer_email ? sub.customer_email.toLowerCase() : '___none___', sub.company_name.toLowerCase(), sub.customer_name.toLowerCase()]
      );

      if (existing && !req.body.forceImport) {
        skippedCount++;
        continue;
      }

      const custCode = generateCustomerCode();
      const assignedUser = get<any>('SELECT id FROM users WHERE LOWER(full_name) = ? OR LOWER(email) = ? LIMIT 1', [sub.assigned_sales_exec?.toLowerCase(), sub.manager_email?.toLowerCase()]);
      const assignedUserId = assignedUser ? assignedUser.id : (req.user?.id || null);

      run(
        `INSERT INTO customers (
          customer_code, name, company, email, phone, address, industry, status, assigned_user_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
        [
          custCode,
          sub.customer_name,
          sub.company_name,
          sub.customer_email || null,
          sub.customer_phone || null,
          sub.location || null,
          sub.industry || 'General',
          assignedUserId,
          sub.notes || `Imported from submission ${sub.submission_code}`,
          now,
          now
        ]
      );

      // Mark submission as Imported
      run('UPDATE customer_submissions SET status = "Imported", updated_at = ? WHERE id = ?', [now, sub.id]);
      importedCount++;
    }

    logAudit(req.user?.id || null, req.user?.full_name || null, 'IMPORT_CUSTOMER_SUBMISSIONS', 'CustomerSubmissions', 0, `Imported ${importedCount} customer submissions into main directory.`);

    res.json({
      success: true,
      importedCount,
      skippedCount,
      message: `Successfully imported ${importedCount} customer(s) into actual database.${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ''}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Could not import submissions.' });
  }
});

// 8. AUTHENTICATED: Direct Import Customers from Excel / CSV Parse Preview
router.post('/customers/import-batch', authenticate, requireRoles(['Sales Manager', 'Admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { records = [], forceImport = false } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: 'No customer records provided for import.' });
      return;
    }

    const now = new Date().toISOString();
    let importedCount = 0;
    let skippedCount = 0;
    const duplicatesFound: any[] = [];

    for (const rec of records) {
      const name = String(rec.customer_name || rec.name || rec['Customer Name'] || rec['Name'] || '').trim();
      const company = String(rec.company_name || rec.company || rec['Company Name'] || rec['Company'] || '').trim();
      const email = String(rec.customer_email || rec.email || rec['Customer Email'] || rec['Email'] || '').trim();
      const phone = String(rec.customer_phone || rec.phone || rec['Customer Phone'] || rec['Phone'] || '').trim();
      const industry = String(rec.industry || rec['Industry'] || 'General').trim();
      const location = String(rec.location || rec.address || rec['Location'] || rec['Address'] || '').trim();
      const notes = String(rec.notes || rec['Notes'] || '').trim();

      if (!name || !company) {
        skippedCount++;
        continue;
      }

      // Check Duplicate
      const existing = get<any>(
        'SELECT id, name, company, email FROM customers WHERE (email = ? AND email != "") OR (LOWER(company) = ? AND LOWER(name) = ?)',
        [email ? email.toLowerCase() : '___none___', company.toLowerCase(), name.toLowerCase()]
      );

      if (existing && !forceImport) {
        duplicatesFound.push({ name, company, email, existing_id: existing.id });
        skippedCount++;
        continue;
      }

      const custCode = generateCustomerCode();
      const assignedUserId = req.user?.id || null;

      run(
        `INSERT INTO customers (
          customer_code, name, company, email, phone, address, industry, status, assigned_user_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
        [
          custCode,
          name,
          company,
          email || null,
          phone || null,
          location || null,
          industry,
          assignedUserId,
          notes || 'Imported from Excel/CSV file',
          now,
          now
        ]
      );

      importedCount++;
    }

    logAudit(req.user?.id || null, req.user?.full_name || null, 'IMPORT_CUSTOMERS_FILE', 'Customer', 0, `Imported ${importedCount} customers from file upload.`);

    res.json({
      success: true,
      importedCount,
      skippedCount,
      duplicatesFound,
      message: `Successfully imported ${importedCount} customer(s).${skippedCount > 0 ? ` (${skippedCount} duplicates/invalid skipped)` : ''}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Could not import customers file.' });
  }
});

export default router;
