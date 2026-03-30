# Seed Data Requirements

All passwords: `a`
Current date for reference: **March 2026**

---

## Users (14 total)

### Admins (2)
| email | full_name |
|---|---|
| admin@timehit.com | Sarah Admin |
| admin2@timehit.com | Mark Director |

### Brokers (3)
| email | full_name | assigned clients |
|---|---|---|
| jonas@timehit.com | Jonas Broker | TechVibe, NordSoft, MediCorp |
| laura@timehit.com | Laura Sales | CloudBase, NordSoft |
| peter@timehit.com | Peter Junior | CloudBase |

### Contractors (5)
| email | full_name | company | country | VAT | invoice_prefix | bank |
|---|---|---|---|---|---|---|
| dev.alex@mail.com | Alex Turner | AT Consulting | LT | yes, 21% LT999111222 | AT-2026- | SEB, LT11 2233 4455 6677 8899 |
| dev.mia@mail.com | Mia Chen | MC Digital Ltd | GB | no | MC- | Barclays, GB29 NWBK 6016 1331 9268 19 |
| dev.oscar@mail.com | Oscar Petrov | — (freelancer) | DE | yes, 19% DE111222333 | OP- | Deutsche Bank, DE89 3704 0044 0532 0130 00 |
| dev.nina@mail.com | Nina Kowalski | NK Solutions | PL | yes, 23% PL1234567890 | NK-2026- | mBank, PL61 1090 1014 0000 0712 1981 2874 |
| dev.sam@mail.com | Sam Rivera | — (freelancer) | US | no | SR- | Chase, US account |

### Client Contacts (4)
| email | full_name | client | job_title | is_primary |
|---|---|---|---|---|
| anna@techvibe.com | Anna Schmidt | TechVibe GmbH | Engineering Manager | yes |
| bob@cloudbase.io | Bob Wilson | CloudBase Inc | CTO | yes |
| carla@nordsoft.se | Carla Lindgren | NordSoft AB | Project Lead | yes |
| dave@medicorp.de | Dave Mueller | MediCorp AG | IT Director | yes |

---

## Clients (4)

| company_name | country | currency | billing_address | vat_number | payment_terms |
|---|---|---|---|---|---|
| TechVibe GmbH | DE | EUR | Friedrichstr. 123, 10117 Berlin | DE812345678 | 30 days |
| CloudBase Inc | US | USD | 450 Market St, San Francisco, CA 94105 | — | 45 days |
| NordSoft AB | SE | EUR | Kungsgatan 55, 111 22 Stockholm | SE556677889901 | 30 days |
| MediCorp AG | DE | EUR | Leopoldstr. 44, 80802 Munich | DE998877665 | 60 days |

---

## Placements (8)

### Active placements (5) — contractors currently working

| # | client | contractor | client_rate | contr_rate | currency | start | end | approval_flow | notes |
|---|---|---|---|---|---|---|---|---|---|
| P1 | TechVibe | Alex Turner | 95.00 | 70.00 | EUR | 2025-10-01 | 2026-09-30 | CLIENT_THEN_BROKER | Long-term backend dev |
| P2 | TechVibe | Mia Chen | 105.00 | 80.00 | EUR | 2026-01-15 | 2026-12-31 | CLIENT_THEN_BROKER | Frontend lead |
| P3 | CloudBase | Oscar Petrov | 120.00 | 90.00 | USD | 2025-07-01 | — (open) | BROKER_ONLY | Cloud architect, open-ended |
| P4 | NordSoft | Nina Kowalski | 85.00 | 65.00 | EUR | 2026-02-01 | 2026-07-31 | BROKER_ONLY | Data engineering project |
| P5 | MediCorp | Sam Rivera | 110.00 | 85.00 | EUR | 2026-01-01 | 2026-06-30 | CLIENT_THEN_BROKER | Security audit |

### Completed placements (2) — expired contracts

| # | client | contractor | client_rate | contr_rate | currency | start | end | approval_flow | notes |
|---|---|---|---|---|---|---|---|---|---|
| P6 | CloudBase | Alex Turner | 100.00 | 75.00 | USD | 2025-03-01 | 2025-08-31 | BROKER_ONLY | API migration (completed) |
| P7 | NordSoft | Mia Chen | 90.00 | 70.00 | EUR | 2025-06-01 | 2025-12-31 | CLIENT_THEN_BROKER | Legacy system rewrite (completed) |

### Draft placement (1) — not yet started

| # | client | contractor | client_rate | contr_rate | currency | start | end | approval_flow | notes |
|---|---|---|---|---|---|---|---|---|---|
| P8 | MediCorp | Oscar Petrov | 130.00 | 100.00 | EUR | 2026-04-01 | 2026-09-30 | CLIENT_THEN_BROKER | Upcoming infra project |

---

## Timesheets + Entries

### P1 — Alex @ TechVibe (started Oct 2025, CLIENT_THEN_BROKER)

| month | status | hours | entries | notes |
|---|---|---|---|---|
| Oct 2025 | APPROVED | 168 | 21 days x 8h, task="Backend API development" | |
| Nov 2025 | APPROVED | 160 | 20 days x 8h, task="Backend API development" | |
| Dec 2025 | APPROVED | 128 | 16 days x 8h (holidays), task="Database optimization" | |
| Jan 2026 | APPROVED | 168 | 21 days x 8h, task="Microservices migration" | |
| Feb 2026 | APPROVED | 160 | 20 days x 8h, task="Microservices migration" | |
| **Mar 2026** | **MISSING** | — | — | Contractor needs to create + fill |

### P2 — Mia @ TechVibe (started Jan 15 2026, CLIENT_THEN_BROKER)

| month | status | hours | entries | notes |
|---|---|---|---|---|
| Jan 2026 | APPROVED | 104 | 13 days x 8h (started mid-month), task="React component library" | |
| Feb 2026 | APPROVED | 160 | 20 days x 8h, task="React component library" | |
| **Mar 2026** | **SUBMITTED** | 120 | 15 days x 8h, task="Dashboard redesign" | Awaiting client approval |

### P3 — Oscar @ CloudBase (started Jul 2025, BROKER_ONLY)

| month | status | hours | entries | notes |
|---|---|---|---|---|
| Jul 2025 | APPROVED | 176 | 22 days x 8h, task="Cloud architecture design" | |
| Aug 2025 | APPROVED | 168 | 21 days x 8h, task="AWS migration" | |
| Sep 2025 | APPROVED | 160 | 20 days x 8h, task="AWS migration" | |
| Oct 2025 | APPROVED | 176 | 22 days x 8h, task="Kubernetes setup" | |
| Nov 2025 | APPROVED | 160 | 20 days x 8h, task="Kubernetes setup" | |
| Dec 2025 | APPROVED | 128 | 16 days x 8h (holidays), task="Monitoring & alerts" | |
| Jan 2026 | APPROVED | 168 | 21 days x 8h, task="CI/CD pipeline" | |
| Feb 2026 | APPROVED | 160 | 20 days x 8h, task="CI/CD pipeline" | |
| **Mar 2026** | **DRAFT** | 64 | 8 days x 8h so far, task="Performance tuning" | Partially filled, not submitted |

### P4 — Nina @ NordSoft (started Feb 2026, BROKER_ONLY)

| month | status | hours | entries | notes |
|---|---|---|---|---|
| Feb 2026 | APPROVED | 160 | 20 days x 8h, task="Data pipeline setup" | |
| **Mar 2026** | **MISSING** | — | — | Contractor needs to create + fill |

### P5 — Sam @ MediCorp (started Jan 2026, CLIENT_THEN_BROKER)

| month | status | hours | entries | notes |
|---|---|---|---|---|
| Jan 2026 | APPROVED | 168 | 21 days x 8h, task="Security assessment" | |
| Feb 2026 | APPROVED | 160 | 20 days x 8h, task="Penetration testing" | |
| **Mar 2026** | **SUBMITTED** | 136 | 17 days x 8h, task="Vulnerability remediation" | Awaiting client approval |

### P6 — Alex @ CloudBase (COMPLETED, Mar-Aug 2025)

| month | status | hours | entries |
|---|---|---|---|
| Mar 2025 | APPROVED | 176 | 22 days x 8h, task="API audit" |
| Apr 2025 | APPROVED | 168 | 21 days x 8h, task="API migration" |
| May 2025 | APPROVED | 176 | 22 days x 8h, task="API migration" |
| Jun 2025 | APPROVED | 160 | 20 days x 8h, task="Testing & QA" |
| Jul 2025 | APPROVED | 176 | 22 days x 8h, task="Documentation" |
| Aug 2025 | APPROVED | 168 | 21 days x 8h, task="Handover" |

### P7 — Mia @ NordSoft (COMPLETED, Jun-Dec 2025)

| month | status | hours | entries |
|---|---|---|---|
| Jun 2025 | APPROVED | 160 | 20 days x 8h, task="Legacy code analysis" |
| Jul 2025 | APPROVED | 176 | 22 days x 8h, task="Rewrite planning" |
| Aug 2025 | APPROVED | 168 | 21 days x 8h, task="Core module rewrite" |
| Sep 2025 | APPROVED | 160 | 20 days x 8h, task="Core module rewrite" |
| Oct 2025 | APPROVED | 176 | 22 days x 8h, task="Integration testing" |
| Nov 2025 | APPROVED | 160 | 20 days x 8h, task="UAT & bug fixes" |
| Dec 2025 | APPROVED | 128 | 16 days x 8h, task="Deployment & handover" |

---

## Invoices

Generate invoice pairs (client + contractor) for **every APPROVED timesheet** above. That's **31 approved timesheets = 62 invoices**.

### Invoice statuses by period:

| Period | Client Invoice Status | Contractor Invoice Status |
|---|---|---|
| **2025 months** (all completed placements) | PAID | PAID |
| **Jan 2026** | PAID | PAID |
| **Feb 2026** | ISSUED | ISSUED |
| **Mar 2026** (if approved) | — | — |

### Invoice numbering:

- Client invoices: `AGY-2025-0001` through `AGY-2025-NNNN`, then `AGY-2026-0001` onward
- Contractor invoices: use each contractor's prefix (AT-2026-0001, MC-0001, OP-0001, NK-2026-0001, SR-0001)

### Payment dates (for PAID invoices):

- 2025 invoices: payment_date = last day of the following month
- Jan 2026 invoices: payment_date = 2026-02-28

---

## Summary of Current State (March 2026)

### What the dashboard should show:

| Placement | TS Status Mar | Invoice Status Feb | Flags |
|---|---|---|---|
| Alex @ TechVibe | **MISSING** | ISSUED (unpaid) | no_timesheet, invoice_unpaid |
| Mia @ TechVibe | SUBMITTED | ISSUED (unpaid) | pending_approval, invoice_unpaid |
| Oscar @ CloudBase | DRAFT | ISSUED (unpaid) | timesheet_draft, invoice_unpaid |
| Nina @ NordSoft | **MISSING** | ISSUED (unpaid) | no_timesheet, invoice_unpaid |
| Sam @ MediCorp | SUBMITTED | ISSUED (unpaid) | pending_approval, invoice_unpaid |

### What different roles will experience:

- **Admin**: sees all 5 active placements, all issues, full control
- **Jonas (broker)**: sees TechVibe (2 placements), NordSoft (1), MediCorp (1) = 4 placements
- **Laura (broker)**: sees CloudBase (1), NordSoft (1) = 2 placements
- **Peter (broker)**: sees CloudBase (1) = 1 placement
- **Alex (contractor)**: sees 1 active placement (TechVibe), needs to create Mar timesheet
- **Mia (contractor)**: sees 1 active placement (TechVibe), Mar timesheet submitted awaiting approval
- **Oscar (contractor)**: sees 1 active placement (CloudBase), Mar timesheet in draft
- **Nina (contractor)**: sees 1 active placement (NordSoft), needs to create Mar timesheet
- **Sam (contractor)**: sees 1 active placement (MediCorp), Mar timesheet submitted
- **Anna (client, TechVibe)**: sees 2 submitted timesheets to approve (Mia Mar, potentially Alex if submitted)
- **Bob (client, CloudBase)**: no timesheets to approve (BROKER_ONLY flow)
- **Carla (client, NordSoft)**: no timesheets to approve (BROKER_ONLY flow)
- **Dave (client, MediCorp)**: sees 1 submitted timesheet to approve (Sam Mar)

---

## Placement Documents

Upload 1-2 dummy documents per active placement:

| placement | file_name | label |
|---|---|---|
| P1 Alex@TechVibe | alex_techvibe_nda.pdf | NDA |
| P1 Alex@TechVibe | alex_techvibe_contract.pdf | Contract |
| P2 Mia@TechVibe | mia_techvibe_contract.pdf | Contract |
| P3 Oscar@CloudBase | oscar_cloudbase_nda.pdf | NDA |
| P3 Oscar@CloudBase | oscar_cloudbase_contract.pdf | Contract |
| P3 Oscar@CloudBase | oscar_cloudbase_sow.pdf | Statement of Work |
| P4 Nina@NordSoft | nina_nordsoft_contract.pdf | Contract |
| P5 Sam@MediCorp | sam_medicorp_nda.pdf | NDA |
| P5 Sam@MediCorp | sam_medicorp_contract.pdf | Contract |
