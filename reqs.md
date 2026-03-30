I want to create some basic recruitment agency platform. core business is contracting - sell for client and rate X, hire contactor for Y, take margin Y-X. Invoices/hours - monthly. Usually contractors need their hours approved. sometimes by agency sometimes by client and agency. invoices happen automatically both directions. Contract (or placement) usually requires several docs pdfs (nda,contract,etc). Contractors can see only their data.Contractors usually have customised requirements for invoices.(vat/no vat, series number)Brokers can see only clients data that are assigned to them.(and contracts and contractors).COntractors visible - all.Admin can do all.---## 1. Business Model

The platform runs an IT contracting agency. The agency places contractors at client companies and takes a margin on every hour worked.

**The money flow:**

1. Agency signs a client who needs a contractor. They agree on a billing rate (e.g., €80/hr).
2. Agency hires a contractor at a pay rate (e.g., €60/hr).
3. Contractor works. Agency keeps the margin (€20/hr).
4. Monthly cycle: contractor logs hours → hours get approved → two invoices generate automatically:
   - Invoice TO the client at the client rate.
   - Invoice FROM the contractor (payment to contractor) at the contractor rate.
5. Agency collects from client, pays contractor, keeps the difference.

One contractor can have multiple placements. One client can have multiple contractors. The cycle repeats every month for every active placement.
---
There is control screen functionality for brokers and admin,
where they see actvie contracts and what is missing statuses timesheets,etc.
---
contractors usually need to input hours per day, sometimes split into hours per task.
Also they need (if checked in placement) be able to add attachments to timesheet (like screenshot of approved hours from SAP)

---
I need you to help me to create more detailed functionality documentation. Think deeply about flow and ask questions needed .Think about different scenarios .Dont yet generate anything
