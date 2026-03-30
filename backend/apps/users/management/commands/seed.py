from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.users.models import User
from apps.clients.models import Client, ClientContact, BrokerClientAssignment
from apps.contractors.models import ContractorProfile
from apps.placements.models import Placement
from apps.timesheets.models import Timesheet, TimesheetEntry
from apps.invoices.models import Invoice


class Command(BaseCommand):
    help = "Seed database with test data"

    def handle(self, *args, **options):
        if User.objects.exists():
            self.stdout.write("Database already seeded. Skipping.")
            return

        # Users
        admin = User.objects.create_user("admin@test.com", "a", full_name="Admin User", role="ADMIN")
        broker1 = User.objects.create_user("broker1@test.com", "a", full_name="Broker One", role="BROKER")
        broker2 = User.objects.create_user("broker2@test.com", "a", full_name="Broker Two", role="BROKER")
        contr1 = User.objects.create_user("contractor1@test.com", "a", full_name="John Doe", role="CONTRACTOR")
        contr2 = User.objects.create_user("contractor2@test.com", "a", full_name="Jane Smith", role="CONTRACTOR")
        cc1_user = User.objects.create_user("client1@test.com", "a", full_name="Alice Acme", role="CLIENT_CONTACT")
        cc2_user = User.objects.create_user("client2@test.com", "a", full_name="Bob Globex", role="CLIENT_CONTACT")

        # Contractor profiles
        p1 = ContractorProfile.objects.create(
            user=contr1, company_name="JD Consulting", country="LT", vat_registered=True,
            vat_number="LT123456789", vat_rate_percent=Decimal("21.00"),
            invoice_series_prefix="JD-2026-", bank_name="SEB",
            bank_account_iban="LT12 3456 7890 1234 5678", bank_swift_bic="CBVILT2X",
            billing_address="123 Main St, Vilnius", payment_terms_days=14,
        )
        p2 = ContractorProfile.objects.create(
            user=contr2, company_name="JS Dev Ltd", country="GB", default_currency="GBP",
            invoice_series_prefix="JS-", bank_name="Barclays",
            bank_account_iban="GB29 NWBK 6016 1331 9268 19", bank_swift_bic="NWBKGB2L",
            billing_address="456 High St, London", payment_terms_days=30,
        )

        # Clients
        acme = Client.objects.create(
            company_name="Acme Corp", billing_address="789 Corp Ave, Berlin",
            country="DE", default_currency="EUR", payment_terms_days=30,
            vat_number="DE123456789",
        )
        globex = Client.objects.create(
            company_name="Globex Inc", billing_address="321 Business Rd, London",
            country="GB", default_currency="GBP", payment_terms_days=45,
        )

        # Client contacts
        ClientContact.objects.create(user=cc1_user, client=acme, job_title="PM", is_primary=True)
        ClientContact.objects.create(user=cc2_user, client=globex, job_title="CTO", is_primary=True)

        # Broker assignments
        BrokerClientAssignment.objects.create(broker=broker1, client=acme)
        BrokerClientAssignment.objects.create(broker=broker1, client=globex)
        BrokerClientAssignment.objects.create(broker=broker2, client=globex)

        # Placements
        pl1 = Placement.objects.create(
            client=acme, contractor=contr1, client_rate=Decimal("80.00"),
            contractor_rate=Decimal("60.00"), currency="EUR",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
            status=Placement.Status.ACTIVE, approval_flow=Placement.ApprovalFlow.CLIENT_THEN_BROKER,
            client_can_view_invoices=True, client_can_view_documents=True,
        )
        pl2 = Placement.objects.create(
            client=globex, contractor=contr2, client_rate=Decimal("90.00"),
            contractor_rate=Decimal("70.00"), currency="GBP",
            start_date=date(2026, 1, 1),
            status=Placement.Status.ACTIVE, approval_flow=Placement.ApprovalFlow.BROKER_ONLY,
        )
        pl3 = Placement.objects.create(
            client=acme, contractor=contr2, client_rate=Decimal("85.00"),
            contractor_rate=Decimal("65.00"), currency="EUR",
            start_date=date(2026, 4, 1),
            status=Placement.Status.DRAFT,
        )

        # Timesheets
        # pl1: Feb APPROVED, Mar SUBMITTED
        ts1 = Timesheet.objects.create(placement=pl1, year=2026, month=2, status=Timesheet.Status.APPROVED, total_hours=Decimal("160.00"))
        for day in range(1, 21):
            TimesheetEntry.objects.create(timesheet=ts1, date=date(2026, 2, day), hours=Decimal("8.00"), task_name="Development")

        ts2 = Timesheet.objects.create(placement=pl1, year=2026, month=3, status=Timesheet.Status.SUBMITTED, total_hours=Decimal("120.00"))
        for day in range(1, 16):
            TimesheetEntry.objects.create(timesheet=ts2, date=date(2026, 3, day), hours=Decimal("8.00"), task_name="Development")

        # pl2: Feb DRAFT
        ts3 = Timesheet.objects.create(placement=pl2, year=2026, month=2, status=Timesheet.Status.DRAFT, total_hours=Decimal("40.00"))
        for day in range(1, 6):
            TimesheetEntry.objects.create(timesheet=ts3, date=date(2026, 2, day), hours=Decimal("8.00"), task_name="Consulting")

        # Invoices for pl1 Feb (approved)
        Invoice.objects.create(
            invoice_number="AGY-2026-0001", invoice_type=Invoice.Type.CLIENT_INVOICE,
            timesheet=ts1, placement=pl1, client=acme, contractor=contr1,
            year=2026, month=2, currency="EUR", hourly_rate=Decimal("80.00"),
            total_hours=Decimal("160.00"), subtotal=Decimal("12800.00"),
            total_amount=Decimal("12800.00"), status=Invoice.Status.ISSUED,
            issue_date=date(2026, 3, 1), due_date=date(2026, 3, 31),
            billing_snapshot={"client_company_name": "Acme Corp", "client_billing_address": "789 Corp Ave, Berlin"},
            generated_by=broker1,
        )
        Invoice.objects.create(
            invoice_number="JD-2026-0001", invoice_type=Invoice.Type.CONTRACTOR_INVOICE,
            timesheet=ts1, placement=pl1, client=acme, contractor=contr1,
            year=2026, month=2, currency="EUR", hourly_rate=Decimal("60.00"),
            total_hours=Decimal("160.00"), subtotal=Decimal("9600.00"),
            vat_rate_percent=Decimal("21.00"), vat_amount=Decimal("2016.00"),
            total_amount=Decimal("11616.00"), status=Invoice.Status.DRAFT,
            issue_date=date(2026, 3, 1), due_date=date(2026, 3, 15),
            billing_snapshot={"contractor_company_name": "JD Consulting", "contractor_bank_iban": "LT12 3456 7890 1234 5678"},
            generated_by=broker1,
        )
        # Update contractor next_invoice_number
        p1.next_invoice_number = 2
        p1.save()

        self.stdout.write(self.style.SUCCESS("Seeded: 7 users, 2 clients, 3 placements, 3 timesheets, 2 invoices"))
