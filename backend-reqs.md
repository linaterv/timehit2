# Backend Implementation Requirements

## Stack

- **Python 3.12+**, **Django 5+**, **Django REST Framework**
- **SQLite** database (default `db.sqlite3`)
- **SimpleJWT** for JWT authentication
- **drf-spectacular** for OpenAPI 3.0 schema + Swagger UI
- File uploads stored at `media/` (local filesystem)

## API Spec

Implement all endpoints defined in [`timehit-api.md`](timehit-api.md). That file is the source of truth for:
- URL paths, methods, request/response JSON schemas
- Authentication and authorization rules
- State machine transitions and validation rules
- Pagination, filtering, sorting, error format

## OpenAPI / Swagger

- Serve Swagger UI at `/api/docs/`
- Serve ReDoc at `/api/redoc/`
- Serve raw schema at `/api/schema/`
- All serializers must have explicit field definitions (no `fields = "__all__"`) so the generated schema is complete and accurate
- Use `@extend_schema` decorators for action endpoints (state transitions, bulk operations, file downloads)
- Tag endpoints by resource: Auth, Users, Clients, Client Contacts, Contractors, Placements, Placement Documents, Timesheets, Timesheet Entries, Timesheet Attachments, Invoices, Control

## Project Structure

```
backend/
├── manage.py
├── config/              # Django project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── auth/            # login, refresh, logout, change-password
│   ├── users/           # User CRUD, /me
│   ├── clients/         # Client, ClientContact, BrokerClientAssignment
│   ├── contractors/     # ContractorProfile
│   ├── placements/      # Placement, PlacementDocument
│   ├── timesheets/      # Timesheet, TimesheetEntry, TimesheetAttachment
│   ├── invoices/        # Invoice, InvoiceCorrectionLink, PDF generation
│   └── control/         # Control screen overview, summary, export
├── media/               # uploaded files
└── requirements.txt
```

## Test Users (seeded via management command `python manage.py seed`)

| email | role | notes |
|---|---|---|
| admin@test.com | ADMIN | |
| broker1@test.com | BROKER | assigned to "Acme Corp" and "Globex Inc" |
| broker2@test.com | BROKER | assigned to "Globex Inc" |
| contractor1@test.com | CONTRACTOR | has placement at Acme Corp |
| contractor2@test.com | CONTRACTOR | has placement at Globex Inc |
| client1@test.com | CLIENT_CONTACT | contact for Acme Corp |
| client2@test.com | CLIENT_CONTACT | contact for Globex Inc |

**Password for all: `a`**

Seed data should also create:
- 2 clients: Acme Corp, Globex Inc
- 2 active placements (one per contractor, different rates/currencies)
- 1 draft placement
- Sample timesheets in various states (DRAFT, SUBMITTED, APPROVED)
- Sample invoices (DRAFT, ISSUED)

## Key Implementation Notes

- Use Django's `AbstractBaseUser` with email as username field
- Decimal fields for all monetary values (no floats)
- Enforce state machine transitions in model methods, not just serializer validation
- Broker scoping: use a queryset mixin that filters by `broker_client_assignments` for broker role
- Invoice generation: snapshot billing details into JSON field on the invoice model
- Contractor `next_invoice_number`: use `F()` expression + `select_for_update()` for atomic increment
- PDF generation: use **weasyprint** or **reportlab**
- File upload fields: use `FileField` with upload paths `media/placements/<placement_id>/` and `media/timesheets/<timesheet_id>/`
