"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { SlideOver } from "@/components/forms/slide-over";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import type {
  Client,
  ClientContact,
  Placement,
  User,
  PaginatedResponse,
} from "@/types/api";

type Tab = "contacts" | "brokers" | "placements";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const [editSlideOpen, setEditSlideOpen] = useState(false);
  const [contactSlideOpen, setContactSlideOpen] = useState(false);
  const [brokerSlideOpen, setBrokerSlideOpen] = useState(false);

  // Edit client form state
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editBillingAddress, setEditBillingAddress] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editVatNumber, setEditVatNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Add contact form state
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPassword, setContactPassword] = useState("");
  const [contactJobTitle, setContactJobTitle] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  // Assign broker state
  const [selectedBrokerId, setSelectedBrokerId] = useState("");

  const allowed = user?.role === "ADMIN" || user?.role === "BROKER";

  // ----- Queries -----

  const { data: client, isLoading: clientLoading } = useApiQuery<Client>(
    ["client", id],
    `/clients/${id}`,
    allowed && !!id
  );

  const { data: contactsData, isLoading: contactsLoading } = useApiQuery<
    PaginatedResponse<ClientContact>
  >(
    ["client-contacts", id],
    `/clients/${id}/contacts`,
    allowed && !!id && activeTab === "contacts"
  );

  const { data: placementsData, isLoading: placementsLoading } = useApiQuery<
    PaginatedResponse<Placement>
  >(
    ["placements", { client_id: id }],
    `/placements?client_id=${id}`,
    allowed && !!id && activeTab === "placements"
  );

  const { data: brokersData } = useApiQuery<PaginatedResponse<User>>(
    ["available-brokers"],
    "/users?role=BROKER&is_active=true&per_page=200",
    allowed && brokerSlideOpen
  );

  // ----- Mutations -----

  const updateClientMutation = useApiMutation<Client, Record<string, unknown>>(
    "PATCH",
    `/clients/${id}`,
    [["client", id], ["clients"]]
  );

  const createContactMutation = useApiMutation<
    ClientContact,
    Record<string, unknown>
  >("POST", `/clients/${id}/contacts`, [["client-contacts", id], ["client", id]]);

  const assignBrokerMutation = useApiMutation<
    unknown,
    Record<string, unknown>
  >("POST", `/clients/${id}/brokers`, [["client", id], ["clients"]]);

  const removeBrokerMutation = useApiMutation<
    unknown,
    { user_id: string }
  >(
    "DELETE",
    (body) => `/clients/${id}/brokers/${body.user_id}`,
    [["client", id], ["clients"]]
  );

  // ----- Access check -----

  if (!allowed) {
    return (
      <div data-testid="client-detail-access-denied" className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
          <p className="mt-2 text-gray-500">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (clientLoading) {
    return (
      <div data-testid="client-detail-loading" className="text-center py-12 text-gray-400">
        Loading...
      </div>
    );
  }

  if (!client) {
    return (
      <div data-testid="client-detail-not-found" className="text-center py-12 text-gray-400">
        Client not found.
      </div>
    );
  }

  // ----- Edit client handlers -----

  const openEditSlide = () => {
    setEditCompanyName(client.company_name);
    setEditBillingAddress(client.billing_address);
    setEditCountry(client.country);
    setEditCurrency(client.default_currency);
    setEditPaymentTerms(
      client.payment_terms_days != null ? String(client.payment_terms_days) : ""
    );
    setEditVatNumber(client.vat_number);
    setEditNotes(client.notes ?? "");
    setEditSlideOpen(true);
  };

  const handleEditSave = () => {
    const body: Record<string, unknown> = {
      company_name: editCompanyName,
      billing_address: editBillingAddress,
      country: editCountry,
      default_currency: editCurrency,
      vat_number: editVatNumber,
      notes: editNotes,
    };
    if (editPaymentTerms) {
      body.payment_terms_days = Number(editPaymentTerms);
    }
    updateClientMutation.mutate(body, {
      onSuccess: () => setEditSlideOpen(false),
    });
  };

  // ----- Contact handlers -----

  const resetContactForm = () => {
    setContactEmail("");
    setContactName("");
    setContactPassword("");
    setContactJobTitle("");
    setContactPhone("");
    setContactIsPrimary(false);
  };

  const openContactSlide = () => {
    resetContactForm();
    setContactSlideOpen(true);
  };

  const handleContactSave = () => {
    createContactMutation.mutate(
      {
        email: contactEmail,
        full_name: contactName,
        password: contactPassword,
        job_title: contactJobTitle,
        phone: contactPhone,
        is_primary: contactIsPrimary,
      },
      {
        onSuccess: () => {
          setContactSlideOpen(false);
          resetContactForm();
        },
      }
    );
  };

  // ----- Broker handlers -----

  const openBrokerSlide = () => {
    setSelectedBrokerId("");
    setBrokerSlideOpen(true);
  };

  const handleAssignBroker = () => {
    if (!selectedBrokerId) return;
    assignBrokerMutation.mutate(
      { user_id: selectedBrokerId },
      {
        onSuccess: () => {
          setBrokerSlideOpen(false);
          setSelectedBrokerId("");
        },
      }
    );
  };

  const handleRemoveBroker = (userId: string) => {
    removeBrokerMutation.mutate({ user_id: userId });
  };

  // ----- Column definitions -----

  const contactColumns: Column<ClientContact>[] = [
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "job_title", label: "Job Title" },
    { key: "phone", label: "Phone" },
    {
      key: "is_primary",
      label: "Primary",
      render: (row) => (
        <span
          data-testid={`contact-primary-${row.id}`}
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            row.is_primary ? "bg-green-500" : "bg-gray-300"
          }`}
        />
      ),
    },
  ];

  const placementColumns: Column<Placement>[] = [
    {
      key: "contractor",
      label: "Contractor",
      render: (row) => <span>{row.contractor.full_name}</span>,
    },
    { key: "currency", label: "Currency" },
    { key: "client_rate", label: "Client Rate" },
    { key: "contractor_rate", label: "Contractor Rate" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: "start_date",
      label: "Start",
      render: (row) => <span>{formatDate(row.start_date)}</span>,
    },
    {
      key: "end_date",
      label: "End",
      render: (row) => <span>{formatDate(row.end_date)}</span>,
    },
  ];

  // Filter available brokers: exclude already-assigned ones
  const assignedBrokerIds = new Set(client.brokers.map((b) => b.user_id));
  const availableBrokers = (brokersData?.data ?? []).filter(
    (b) => !assignedBrokerIds.has(b.id)
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "contacts", label: "Contacts" },
    { key: "brokers", label: "Brokers" },
    { key: "placements", label: "Placements" },
  ];

  return (
    <div data-testid="client-detail-page" className="space-y-6">
      {/* Header card */}
      <div data-testid="client-header" className="bg-surface border rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 data-testid="client-company-name" className="text-2xl font-bold text-gray-900">
              {client.company_name}
            </h1>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              <p data-testid="client-country">
                <span className="font-medium">Country:</span> {client.country || "\u2014"}
              </p>
              <p data-testid="client-currency">
                <span className="font-medium">Currency:</span> {client.default_currency}
              </p>
              <p data-testid="client-vat">
                <span className="font-medium">VAT:</span> {client.vat_number || "\u2014"}
              </p>
              <p data-testid="client-billing-address">
                <span className="font-medium">Billing Address:</span>{" "}
                {client.billing_address || "\u2014"}
              </p>
              {client.payment_terms_days != null && (
                <p data-testid="client-payment-terms">
                  <span className="font-medium">Payment Terms:</span>{" "}
                  {client.payment_terms_days} days
                </p>
              )}
              <p data-testid="client-status">
                <span className="font-medium">Status:</span>{" "}
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full align-middle ${
                    client.is_active ? "bg-green-500" : "bg-red-500"
                  }`}
                />{" "}
                {client.is_active ? "Active" : "Inactive"}
              </p>
            </div>
          </div>
          <button
            data-testid="edit-client-btn"
            onClick={openEditSlide}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div data-testid="client-tabs" className="border-b">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div data-testid="tab-content">
        {/* Contacts tab */}
        {activeTab === "contacts" && (
          <div data-testid="contacts-tab-content" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
              <button
                data-testid="add-contact-btn"
                onClick={openContactSlide}
                className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
              >
                Add Contact
              </button>
            </div>
            {contactsLoading ? (
              <div data-testid="contacts-loading" className="text-center py-8 text-gray-400">
                Loading...
              </div>
            ) : (
              <DataTable<ClientContact>
                testId="contacts-table"
                columns={contactColumns}
                data={contactsData?.data ?? []}
                meta={contactsData?.meta}
              />
            )}
          </div>
        )}

        {/* Brokers tab */}
        {activeTab === "brokers" && (
          <div data-testid="brokers-tab-content" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Assigned Brokers</h2>
              <button
                data-testid="assign-broker-btn"
                onClick={openBrokerSlide}
                className="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700"
              >
                Assign Broker
              </button>
            </div>
            {client.brokers.length === 0 ? (
              <p data-testid="no-brokers" className="text-sm text-gray-400 py-8 text-center">
                No brokers assigned.
              </p>
            ) : (
              <div className="border rounded-lg divide-y bg-surface">
                {client.brokers.map((broker) => (
                  <div
                    key={broker.user_id}
                    data-testid={`broker-row-${broker.user_id}`}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p data-testid={`broker-name-${broker.user_id}`} className="text-sm font-medium text-gray-900">
                        {broker.full_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Assigned {formatDate(broker.assigned_at)}
                      </p>
                    </div>
                    <button
                      data-testid={`remove-broker-${broker.user_id}`}
                      onClick={() => handleRemoveBroker(broker.user_id)}
                      disabled={removeBrokerMutation.isPending}
                      className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Placements tab */}
        {activeTab === "placements" && (
          <div data-testid="placements-tab-content" className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Placements</h2>
            {placementsLoading ? (
              <div data-testid="placements-loading" className="text-center py-8 text-gray-400">
                Loading...
              </div>
            ) : (
              <DataTable<Placement>
                testId="placements-table"
                columns={placementColumns}
                data={placementsData?.data ?? []}
                meta={placementsData?.meta}
              />
            )}
          </div>
        )}
      </div>

      {/* Edit Client SlideOver */}
      <SlideOver
        open={editSlideOpen}
        onClose={() => setEditSlideOpen(false)}
        title="Edit Client"
        onSave={handleEditSave}
        saving={updateClientMutation.isPending}
        testId="edit-client-slideover"
      >
        <div className="space-y-4">
          <div>
            <label data-testid="edit-company-name-label" className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              data-testid="edit-company-name"
              type="text"
              value={editCompanyName}
              onChange={(e) => setEditCompanyName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="edit-billing-address-label" className="block text-sm font-medium text-gray-700 mb-1">
              Billing Address
            </label>
            <textarea
              data-testid="edit-billing-address"
              value={editBillingAddress}
              onChange={(e) => setEditBillingAddress(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="edit-country-label" className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              data-testid="edit-country"
              type="text"
              value={editCountry}
              onChange={(e) => setEditCountry(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="edit-currency-label" className="block text-sm font-medium text-gray-700 mb-1">
              Default Currency
            </label>
            <input
              data-testid="edit-currency"
              type="text"
              value={editCurrency}
              onChange={(e) => setEditCurrency(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="edit-payment-terms-label" className="block text-sm font-medium text-gray-700 mb-1">
              Payment Terms (days)
            </label>
            <input
              data-testid="edit-payment-terms"
              type="number"
              value={editPaymentTerms}
              onChange={(e) => setEditPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="edit-vat-number-label" className="block text-sm font-medium text-gray-700 mb-1">
              VAT Number
            </label>
            <input
              data-testid="edit-vat-number"
              type="text"
              value={editVatNumber}
              onChange={(e) => setEditVatNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="edit-notes-label" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              data-testid="edit-notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
        </div>
      </SlideOver>

      {/* Add Contact SlideOver */}
      <SlideOver
        open={contactSlideOpen}
        onClose={() => setContactSlideOpen(false)}
        title="Add Contact"
        onSave={handleContactSave}
        saving={createContactMutation.isPending}
        testId="add-contact-slideover"
      >
        <div className="space-y-4">
          <div>
            <label data-testid="contact-email-label" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              data-testid="contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="contact-full-name-label" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              data-testid="contact-full-name"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="contact-password-label" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              data-testid="contact-password"
              type="password"
              value={contactPassword}
              onChange={(e) => setContactPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="contact-job-title-label" className="block text-sm font-medium text-gray-700 mb-1">
              Job Title
            </label>
            <input
              data-testid="contact-job-title"
              type="text"
              value={contactJobTitle}
              onChange={(e) => setContactJobTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label data-testid="contact-phone-label" className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              data-testid="contact-phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              data-testid="contact-is-primary"
              type="checkbox"
              id="is-primary"
              checked={contactIsPrimary}
              onChange={(e) => setContactIsPrimary(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label data-testid="contact-is-primary-label" htmlFor="is-primary" className="text-sm text-gray-700">
              Primary Contact
            </label>
          </div>
        </div>
      </SlideOver>

      {/* Assign Broker SlideOver */}
      <SlideOver
        open={brokerSlideOpen}
        onClose={() => setBrokerSlideOpen(false)}
        title="Assign Broker"
        onSave={handleAssignBroker}
        saving={assignBrokerMutation.isPending}
        testId="assign-broker-slideover"
      >
        <div className="space-y-4">
          <div>
            <label data-testid="broker-select-label" className="block text-sm font-medium text-gray-700 mb-1">
              Select Broker
            </label>
            <select
              data-testid="broker-select"
              value={selectedBrokerId}
              onChange={(e) => setSelectedBrokerId(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="">Choose a broker...</option>
              {availableBrokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.full_name} ({b.email})
                </option>
              ))}
            </select>
          </div>
          {availableBrokers.length === 0 && (
            <p data-testid="no-available-brokers" className="text-sm text-gray-400">
              No available brokers to assign.
            </p>
          )}
        </div>
      </SlideOver>
    </div>
  );
}
