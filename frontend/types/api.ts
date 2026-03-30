export type Role = "ADMIN" | "BROKER" | "CONTRACTOR" | "CLIENT_CONTACT";

export type PlacementStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "CLIENT_APPROVED" | "APPROVED" | "REJECTED";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "VOIDED" | "CORRECTED";
export type InvoiceType = "CLIENT_INVOICE" | "CONTRACTOR_INVOICE";
export type ApprovalFlow = "BROKER_ONLY" | "CLIENT_THEN_BROKER";
export type InvoiceTemplateType = "CONTRACTOR" | "CLIENT" | "AGENCY";
export type InvoiceTemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface UserRef {
  id: string;
  full_name: string;
}

export interface ClientRef {
  id: string;
  company_name: string;
}

export interface PlacementRef {
  id: string;
  label: string;
  status: PlacementStatus;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  contractor_profile?: ContractorProfile | null;
  client_contact?: ClientContact | null;
  theme?: string;
  current_placement?: PlacementRef | null;
}

export interface BrokerAssignment {
  user_id: string;
  full_name: string;
  assigned_at: string;
}

export interface Client {
  id: string;
  company_name: string;
  registration_number: string;
  vat_number: string;
  billing_address: string;
  country: string;
  default_currency: string;
  payment_terms_days: number | null;
  is_active: boolean;
  notes?: string;
  brokers: BrokerAssignment[];
  contact_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface ClientContact {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  job_title: string;
  phone: string;
  is_primary: boolean;
  is_active: boolean;
}

export interface ContractorProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  company_name: string;
  registration_number: string;
  vat_registered: boolean;
  vat_number: string;
  vat_rate_percent: string | null;
  invoice_series_prefix: string;
  next_invoice_number: number;
  bank_name: string;
  bank_account_iban: string;
  bank_swift_bic: string;
  payment_terms_days: number | null;
  billing_address: string;
  country: string;
  default_currency: string;
  is_active?: boolean;
  current_placement?: PlacementRef | null;
}

export interface Placement {
  id: string;
  client: ClientRef;
  contractor: UserRef;
  title: string;
  client_rate: string;
  contractor_rate: string;
  currency: string;
  start_date: string;
  end_date: string | null;
  status: PlacementStatus;
  approval_flow: ApprovalFlow;
  require_timesheet_attachment: boolean;
  client_can_view_invoices: boolean;
  client_can_view_documents: boolean;
  notes: string;
  created_at: string;
}

export interface PlacementDocument {
  id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  label: string;
  uploaded_by: UserRef;
  uploaded_at: string;
  placement?: { id: string; client: ClientRef; contractor: UserRef };
}

export interface TimesheetEntry {
  id: string;
  date: string;
  hours: string;
  task_name: string;
  notes: string;
}

export interface TimesheetAttachment {
  id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at: string;
}

export interface Timesheet {
  id: string;
  placement_id: string;
  placement?: {
    client: ClientRef;
    contractor: UserRef;
    title?: string;
    client_rate: string;
    contractor_rate: string;
    currency: string;
    approval_flow: ApprovalFlow;
    require_timesheet_attachment: boolean;
  };
  year: number;
  month: number;
  status: TimesheetStatus;
  total_hours: string;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: UserRef | null;
  rejected_at: string | null;
  rejected_by: UserRef | null;
  rejection_reason: string;
  has_attachments?: boolean;
  entry_count?: number;
  entries?: TimesheetEntry[];
  attachments?: TimesheetAttachment[];
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  client: ClientRef;
  contractor: UserRef;
  placement_id: string;
  timesheet_id?: string;
  year: number;
  month: number;
  currency: string;
  hourly_rate: string;
  total_hours: string;
  subtotal: string;
  vat_rate_percent: string | null;
  vat_amount: string | null;
  total_amount: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  payment_date: string | null;
  payment_reference: string;
  billing_snapshot?: Record<string, unknown>;
  correction_link?: { corrective_invoice_id: string; reason: string } | null;
  generated_by: UserRef;
  created_at: string;
}

export interface InvoiceTemplate {
  id: string;
  title: string;
  code: string;
  template_type: InvoiceTemplateType;
  status: InvoiceTemplateStatus;
  is_default: boolean;
  contractor?: UserRef | null;
  client?: ClientRef | null;
  placement_id?: string | null;
  parent_id?: string | null;
  company_name: string;
  registration_number: string;
  billing_address: string;
  country: string;
  default_currency: string;
  vat_registered: boolean | null;
  vat_number: string;
  vat_rate_percent: string | null;
  bank_name: string;
  bank_account_iban: string;
  bank_swift_bic: string;
  invoice_series_prefix: string;
  next_invoice_number: number | null;
  payment_terms_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface ControlRow {
  placement: {
    id: string;
    start_date: string;
    end_date: string | null;
    client_rate: string;
    contractor_rate: string;
    currency: string;
    approval_flow: ApprovalFlow;
    require_timesheet_attachment: boolean;
  };
  client: ClientRef;
  contractor: UserRef;
  timesheet: { id: string; status: TimesheetStatus; total_hours: string; submitted_at: string | null; approved_at: string | null } | null;
  client_invoice: { id: string; invoice_number: string; status: InvoiceStatus; total_amount: string } | null;
  contractor_invoice: { id: string; invoice_number: string; status: InvoiceStatus; total_amount: string } | null;
  margin: string;
  flags: string[];
}

export interface ControlSummary {
  timesheets_awaiting_approval: number;
  approved_without_invoices: number;
  invoices_awaiting_payment: number;
  placements_with_issues: number;
  total_active_placements: number;
  total_hours: string;
  total_client_revenue: string;
  total_contractor_cost: string;
  total_margin: string;
  currency_breakdown: { currency: string; revenue: string; cost: string; margin: string }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
}

export interface ApiError {
  error: { code: string; message: string; details: { field: string; message: string }[] };
}
