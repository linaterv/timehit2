"""
Populate database with realistic test data per req-populatedata.md.
Usage:
    python manage.py populate          # populate (skips if data exists)
    python manage.py populate --clean  # wipe everything and repopulate
"""
import calendar
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from apps.users.models import User
from apps.clients.models import Client, ClientContact, BrokerClientAssignment
from apps.contractors.models import ContractorProfile
from apps.placements.models import Placement, PlacementDocument
from apps.invoices.models import InvoiceNotification
from apps.timesheets.models import Timesheet, TimesheetEntry, TimesheetAttachment
from apps.invoices.models import Invoice, InvoiceCorrectionLink, InvoiceTemplate
from apps.invoices.pdf import generate_invoice_pdf
from apps.control.models import AgencySettings

D = Decimal
PWD = "a"


def workdays_in_month(year, month, max_days=None):
    """Return list of workday dates (Mon-Fri) in a month, optionally capped."""
    days = []
    _, num_days = calendar.monthrange(year, month)
    for d in range(1, num_days + 1):
        dt = date(year, month, d)
        if dt.weekday() < 5:
            days.append(dt)
    if max_days:
        days = days[:max_days]
    return days



def workdays_from(year, month, start_date):
    """Workdays in a month starting from start_date."""
    days = workdays_in_month(year, month)
    return [d for d in days if d >= start_date]


class Command(BaseCommand):
    help = "Populate database with realistic test data"

    def add_arguments(self, parser):
        parser.add_argument("--clean", action="store_true", help="Wipe all data and repopulate")

    def handle(self, *args, **options):
        if options["clean"]:
            self.stdout.write("Cleaning all data...")
            InvoiceNotification.objects.all().delete()
            InvoiceCorrectionLink.objects.all().delete()
            Invoice.objects.all().delete()
            InvoiceTemplate.objects.all().delete()
            TimesheetAttachment.objects.all().delete()
            TimesheetEntry.objects.all().delete()
            Timesheet.objects.all().delete()
            PlacementDocument.objects.all().delete()
            Placement.objects.all().delete()
            BrokerClientAssignment.objects.all().delete()
            ClientContact.objects.all().delete()
            ContractorProfile.objects.all().delete()
            Client.objects.all().delete()
            User.objects.all().delete()
            AgencySettings.objects.all().delete()
            self.stdout.write("Done cleaning.")

        if User.objects.exists():
            self.stdout.write("Data already exists. Use --clean to repopulate.")
            return

        # ── USERS ────────────────────────────────────────────────────────────
        self.stdout.write("Creating users...")
        admin1 = User.objects.create_user("admin@timehit.com", PWD, full_name="Sarah Admin", role="ADMIN")
        admin2 = User.objects.create_user("admin2@timehit.com", PWD, full_name="Mark Director", role="ADMIN")

        jonas = User.objects.create_user("jonas@timehit.com", PWD, full_name="Jonas Broker", role="BROKER")
        laura = User.objects.create_user("laura@timehit.com", PWD, full_name="Laura Sales", role="BROKER")
        peter = User.objects.create_user("peter@timehit.com", PWD, full_name="Peter Junior", role="BROKER")

        alex = User.objects.create_user("dev.alex@mail.com", PWD, full_name="Alex Turner", role="CONTRACTOR")
        mia = User.objects.create_user("dev.mia@mail.com", PWD, full_name="Mia Chen", role="CONTRACTOR")
        oscar = User.objects.create_user("dev.oscar@mail.com", PWD, full_name="Oscar Petrov", role="CONTRACTOR")
        nina = User.objects.create_user("dev.nina@mail.com", PWD, full_name="Nina Kowalski", role="CONTRACTOR")
        sam = User.objects.create_user("dev.sam@mail.com", PWD, full_name="Sam Rivera", role="CONTRACTOR")

        anna_u = User.objects.create_user("anna@techvibe.com", PWD, full_name="Anna Schmidt", role="CLIENT_CONTACT")
        bob_u = User.objects.create_user("bob@cloudbase.io", PWD, full_name="Bob Wilson", role="CLIENT_CONTACT")
        carla_u = User.objects.create_user("carla@nordsoft.se", PWD, full_name="Carla Lindgren", role="CLIENT_CONTACT")
        dave_u = User.objects.create_user("dave@medicorp.de", PWD, full_name="Dave Mueller", role="CLIENT_CONTACT")

        # ── CONTRACTOR PROFILES ──────────────────────────────────────────────
        self.stdout.write("Creating contractor profiles...")
        prof_alex = ContractorProfile.objects.create(
            user=alex, company_name="AT Consulting", country="LT",
            vat_registered=True, vat_number="LT999111222", vat_rate_percent=D("21"),
            invoice_series_prefix="AT-2026-", bank_name="SEB",
            bank_account_iban="LT11 2233 4455 6677 8899", bank_swift_bic="CBVILT2X",
            billing_address="Gedimino pr. 1, Vilnius", payment_terms_days=14,
        )
        prof_mia = ContractorProfile.objects.create(
            user=mia, company_name="MC Digital Ltd", country="GB",
            invoice_series_prefix="MC-", bank_name="Barclays",
            bank_account_iban="GB29 NWBK 6016 1331 9268 19", bank_swift_bic="NWBKGB2L",
            billing_address="10 Downing St, London", payment_terms_days=30,
        )
        prof_oscar = ContractorProfile.objects.create(
            user=oscar, country="DE",
            vat_registered=True, vat_number="DE111222333", vat_rate_percent=D("19"),
            invoice_series_prefix="OP-", bank_name="Deutsche Bank",
            bank_account_iban="DE89 3704 0044 0532 0130 00", bank_swift_bic="DEUTDEDB",
            billing_address="Berliner Str. 5, Munich", payment_terms_days=14,
        )
        prof_nina = ContractorProfile.objects.create(
            user=nina, company_name="NK Solutions", country="PL",
            vat_registered=True, vat_number="PL1234567890", vat_rate_percent=D("23"),
            invoice_series_prefix="NK-2026-", bank_name="mBank",
            bank_account_iban="PL61 1090 1014 0000 0712 1981 2874", bank_swift_bic="BREXPLPW",
            billing_address="ul. Marszalkowska 10, Warsaw", payment_terms_days=21,
        )
        prof_sam = ContractorProfile.objects.create(
            user=sam, country="US",
            invoice_series_prefix="SR-", bank_name="Chase",
            bank_account_iban="US-CHASE-ACCT-1234", bank_swift_bic="CHASUS33",
            billing_address="100 Broadway, New York", payment_terms_days=30,
        )

        # ── CLIENTS ──────────────────────────────────────────────────────────
        self.stdout.write("Creating clients...")
        techvibe = Client.objects.create(
            company_name="TechVibe GmbH", country="DE", default_currency="EUR",
            billing_address="Friedrichstr. 123, 10117 Berlin",
            vat_number="DE812345678", payment_terms_days=30,
        )
        cloudbase = Client.objects.create(
            company_name="CloudBase Inc", country="US", default_currency="USD",
            billing_address="450 Market St, San Francisco, CA 94105",
            payment_terms_days=45,
        )
        nordsoft = Client.objects.create(
            company_name="NordSoft AB", country="SE", default_currency="EUR",
            billing_address="Kungsgatan 55, 111 22 Stockholm",
            vat_number="SE556677889901", payment_terms_days=30,
        )
        medicorp = Client.objects.create(
            company_name="MediCorp AG", country="DE", default_currency="EUR",
            billing_address="Leopoldstr. 44, 80802 Munich",
            vat_number="DE998877665", payment_terms_days=60,
        )

        # ── CLIENT CONTACTS ──────────────────────────────────────────────────
        ClientContact.objects.create(user=anna_u, client=techvibe, job_title="Engineering Manager", is_primary=True)
        ClientContact.objects.create(user=bob_u, client=cloudbase, job_title="CTO", is_primary=True)
        ClientContact.objects.create(user=carla_u, client=nordsoft, job_title="Project Lead", is_primary=True)
        ClientContact.objects.create(user=dave_u, client=medicorp, job_title="IT Director", is_primary=True)

        # ── BROKER ASSIGNMENTS ───────────────────────────────────────────────
        BrokerClientAssignment.objects.create(broker=jonas, client=techvibe)
        BrokerClientAssignment.objects.create(broker=jonas, client=nordsoft)
        BrokerClientAssignment.objects.create(broker=jonas, client=medicorp)
        BrokerClientAssignment.objects.create(broker=laura, client=cloudbase)
        BrokerClientAssignment.objects.create(broker=laura, client=nordsoft)
        BrokerClientAssignment.objects.create(broker=peter, client=cloudbase)

        # ── INVOICE TEMPLATES ────────────────────────────────────────────────
        self.stdout.write("Creating invoice templates...")
        for prof in [prof_alex, prof_mia, prof_oscar, prof_nina, prof_sam]:
            InvoiceTemplate.objects.create(
                title=f"{prof.company_name or prof.user.full_name} - Default",
                code="DEFAULT",
                template_type=InvoiceTemplate.Type.CONTRACTOR, status=InvoiceTemplate.Status.ACTIVE,
                is_default=True, contractor=prof.user,
                company_name=prof.company_name, registration_number=prof.registration_number,
                billing_address=prof.billing_address, country=prof.country,
                default_currency=prof.default_currency,
                vat_registered=prof.vat_registered, vat_number=prof.vat_number,
                vat_rate_percent=prof.vat_rate_percent,
                bank_name=prof.bank_name, bank_account_iban=prof.bank_account_iban,
                bank_swift_bic=prof.bank_swift_bic,
                invoice_series_prefix=prof.invoice_series_prefix, next_invoice_number=prof.next_invoice_number,
                payment_terms_days=prof.payment_terms_days,
            )
        for cl in [techvibe, cloudbase, nordsoft, medicorp]:
            InvoiceTemplate.objects.create(
                title=f"{cl.company_name} - Default",
                code="DEFAULT",
                template_type=InvoiceTemplate.Type.CLIENT, status=InvoiceTemplate.Status.ACTIVE,
                is_default=True, client=cl,
                company_name=cl.company_name, registration_number=cl.registration_number,
                billing_address=cl.billing_address, country=cl.country,
                default_currency=cl.default_currency,
                vat_number=cl.vat_number, payment_terms_days=cl.payment_terms_days,
            )

        # Global Contractor→Agency templates (LT and EN)
        global_contr_lt = InvoiceTemplate.objects.create(
            title="LT Template", code="LT",
            template_type=InvoiceTemplate.Type.CONTRACTOR, status=InvoiceTemplate.Status.ACTIVE,
            billing_address="Klientas:\nUAB \u201eWISE INTEGRATION\u201c\n\u012emon\u0117s kodas: 302666833\nPVM mok\u0117tojo kodas: LT100006404014\nAdresas: Paneri\u0173 g. 11, LT-03209 Vilnius, Lietuva\nEl. pa\u0161tas: info@wiseintegration.com\nTinklalapis: https://hitcontract.lt",
            bank_name="Beneficiary Bank\nSEB Bank AB\nVilnius Lithuania\nSwift: CBVILT2X\nIBAN: LT06 7044 0600 0817 7672\nAccount Name: MB \u201eMidija\u201c\nCompany Code: 304612656",
            company_name="UAB \u201eWISE INTEGRATION\u201c", country="LT", default_currency="EUR",
        )
        global_contr_en = InvoiceTemplate.objects.create(
            title="EN Template", code="EN",
            template_type=InvoiceTemplate.Type.CONTRACTOR, status=InvoiceTemplate.Status.ACTIVE,
            billing_address="Client:\nUAB \"WISE INTEGRATION\"\nCompany code: 302666833\nVAT No.: LT100006404014\nRegistered address: Paneri\u0173 g. 11, LT-03209 Vilnius, Lithuania\nEmail: info@hitcontract.com\nWebsite: https://hitcontract.lt\nPhone: +370 671 80231",
            bank_name="Beneficiary Bank\nSEB Bank AB\nVilnius Lithuania\nSwift: CBVILT2X\nIBAN: LT06 7044 0600 0817 7672\nAccount Name: MB \u201eMidija\u201c\nCompany Code: 304612656",
            company_name="UAB \"WISE INTEGRATION\"", country="LT", default_currency="EUR",
        )

        # Global Client templates (LT and EN) — used as base for per-client billing templates
        client_tpl_lt = InvoiceTemplate.objects.create(
            title="Client LT Template", code="LT",
            template_type=InvoiceTemplate.Type.CLIENT, status=InvoiceTemplate.Status.ACTIVE,
            billing_address="Siunt\u0117jas:\nUAB \u201eWISE INTEGRATION\u201c\n\u012emon\u0117s kodas: 302666833\nPVM mok\u0117tojo kodas: LT100006404014\nAdresas: Paneri\u0173 g. 11, LT-03209 Vilnius, Lietuva\nEl. pa\u0161tas: info@wiseintegration.com\nTinklalapis: https://hitcontract.lt",
            company_name="UAB \u201eWISE INTEGRATION\u201c",
            country="LT", default_currency="EUR",
            vat_registered=True, vat_rate_percent=21,
            payment_terms_days=30,
        )
        client_tpl_en = InvoiceTemplate.objects.create(
            title="Client EN Template", code="EN",
            template_type=InvoiceTemplate.Type.CLIENT, status=InvoiceTemplate.Status.ACTIVE,
            billing_address="Service Provider:\nUAB \"WISE INTEGRATION\"\nCompany code: 302666833\nVAT No.: LT100006404014\nRegistered address: Paneri\u0173 g. 11, LT-03209 Vilnius, Lithuania\nEmail: info@hitcontract.com\nWebsite: https://hitcontract.lt\nPhone: +370 671 80231",
            company_name="UAB \"WISE INTEGRATION\"",
            country="LT", default_currency="EUR",
            vat_registered=True, vat_rate_percent=21,
            payment_terms_days=30,
        )

        # ── AGENCY SETTINGS ──────────────────────────────────────────────────
        AgencySettings.objects.create(
            pk=1,
            default_payment_terms_client_days=30,
            default_payment_terms_contractor_days=35,
            default_client_invoice_template=client_tpl_lt,
        )

        # ── PLACEMENTS ───────────────────────────────────────────────────────
        self.stdout.write("Creating placements...")
        p1 = Placement.objects.create(
            client=techvibe, contractor=alex, client_rate=D("95"), contractor_rate=D("70"),
            currency="EUR", start_date=date(2025, 10, 1), end_date=date(2026, 9, 30),
            status="ACTIVE", approval_flow="CLIENT_THEN_BROKER",
            client_can_view_invoices=True, client_can_view_documents=True,
            client_invoice_template=client_tpl_lt,
            title="Backend Developer", notes="Long-term backend dev",
        )
        p2 = Placement.objects.create(
            client=techvibe, contractor=mia, client_rate=D("105"), contractor_rate=D("80"),
            currency="EUR", start_date=date(2026, 1, 15), end_date=date(2026, 12, 31),
            status="ACTIVE", approval_flow="CLIENT_THEN_BROKER",
            client_can_view_invoices=True, client_can_view_documents=True,
            client_invoice_template=client_tpl_lt,
            title="Frontend Lead", notes="Frontend lead",
        )
        p3 = Placement.objects.create(
            client=cloudbase, contractor=oscar, client_rate=D("120"), contractor_rate=D("90"),
            currency="USD", start_date=date(2025, 7, 1),
            status="ACTIVE", approval_flow="BROKER_ONLY",
            client_invoice_template=client_tpl_lt,
            title="Cloud Architect", notes="Cloud architect, open-ended",
        )
        p4 = Placement.objects.create(
            client=nordsoft, contractor=nina, client_rate=D("85"), contractor_rate=D("65"),
            currency="EUR", start_date=date(2026, 2, 1), end_date=date(2026, 7, 31),
            status="ACTIVE", approval_flow="BROKER_ONLY",
            client_invoice_template=client_tpl_lt,
            title="Data Engineer", notes="Data engineering project",
        )
        p5 = Placement.objects.create(
            client=medicorp, contractor=sam, client_rate=D("110"), contractor_rate=D("85"),
            currency="EUR", start_date=date(2026, 1, 1), end_date=date(2026, 6, 30),
            status="ACTIVE", approval_flow="CLIENT_THEN_BROKER",
            client_can_view_invoices=True,
            client_invoice_template=client_tpl_lt,
            title="Security Consultant", notes="Security audit",
        )
        p6 = Placement.objects.create(
            client=cloudbase, contractor=alex, client_rate=D("100"), contractor_rate=D("75"),
            currency="USD", start_date=date(2025, 3, 1), end_date=date(2025, 8, 31),
            status="COMPLETED", approval_flow="BROKER_ONLY",
            client_invoice_template=client_tpl_lt,
            title="API Developer", notes="API migration (completed)",
        )
        p7 = Placement.objects.create(
            client=nordsoft, contractor=mia, client_rate=D("90"), contractor_rate=D("70"),
            currency="EUR", start_date=date(2025, 6, 1), end_date=date(2025, 12, 31),
            status="COMPLETED", approval_flow="CLIENT_THEN_BROKER",
            client_invoice_template=client_tpl_lt,
            title="Full Stack Developer", notes="Legacy system rewrite (completed)",
        )
        p8 = Placement.objects.create(
            client=medicorp, contractor=oscar, client_rate=D("130"), contractor_rate=D("100"),
            currency="EUR", start_date=date(2026, 4, 1), end_date=date(2026, 9, 30),
            status="DRAFT", approval_flow="CLIENT_THEN_BROKER",
            client_invoice_template=client_tpl_lt,
            title="Infrastructure Engineer", notes="Upcoming infra project",
        )

        # ── NEW: Demo client + contractor + placement for Generate button ───
        demo_client = Client.objects.create(
            company_name="DemoTech UAB", country="LT", default_currency="EUR",
            billing_address="Demo St. 1, Vilnius, Lithuania",
            vat_number="LT999000111", payment_terms_days=30,
        )
        BrokerClientAssignment.objects.create(broker=jonas, client=demo_client)
        InvoiceTemplate.objects.create(
            title="DemoTech UAB - Default", code="DEFAULT",
            template_type=InvoiceTemplate.Type.CLIENT, status=InvoiceTemplate.Status.ACTIVE,
            is_default=True, client=demo_client, parent=client_tpl_lt,
            company_name=demo_client.company_name, billing_address=demo_client.billing_address,
            country=demo_client.country, default_currency=demo_client.default_currency,
            vat_number=demo_client.vat_number, payment_terms_days=demo_client.payment_terms_days,
        )
        demo_contr = User.objects.create_user(
            "demo.contr@mail.com", PWD, full_name="Demo Contractor", role="CONTRACTOR"
        )
        demo_prof = ContractorProfile.objects.create(
            user=demo_contr, company_name="Demo Consulting",
            country="LT", vat_registered=True, vat_number="LT888000222",
            vat_rate_percent=D("21"), invoice_series_prefix="DEMO-",
            bank_name="SEB", bank_account_iban="LT00 1111 2222 3333 4444",
            bank_swift_bic="CBVILT2X", billing_address="Demo Address, Vilnius",
            payment_terms_days=14,
        )
        InvoiceTemplate.objects.create(
            title="Demo Contractor - Default", code="DEFAULT",
            template_type=InvoiceTemplate.Type.CONTRACTOR, status=InvoiceTemplate.Status.ACTIVE,
            is_default=True, contractor=demo_contr, parent=global_contr_lt,
            company_name=demo_prof.company_name, billing_address=demo_prof.billing_address,
            country="LT", default_currency="EUR",
            vat_registered=True, vat_number=demo_prof.vat_number,
            vat_rate_percent=demo_prof.vat_rate_percent,
            bank_name=demo_prof.bank_name, bank_account_iban=demo_prof.bank_account_iban,
            bank_swift_bic=demo_prof.bank_swift_bic,
            invoice_series_prefix=demo_prof.invoice_series_prefix,
            next_invoice_number=1, payment_terms_days=14,
        )
        p_demo = Placement.objects.create(
            client=demo_client, contractor=demo_contr,
            client_rate=D("85"), contractor_rate=D("60"),
            currency="EUR", start_date=date(2026, 2, 1),
            status="ACTIVE", approval_flow="BROKER_ONLY",
            client_invoice_template=client_tpl_lt,
            title="QA Engineer", notes="Demo placement for invoice generation",
        )

        # Demo contractor 2
        demo_contr2 = User.objects.create_user(
            "demo.contr2@mail.com", PWD, full_name="Demo DevOps", role="CONTRACTOR"
        )
        demo_prof2 = ContractorProfile.objects.create(
            user=demo_contr2, company_name="DevOps Pro UAB",
            country="LT", vat_registered=True, vat_number="LT777000333",
            vat_rate_percent=D("21"), invoice_series_prefix="DOP-",
            bank_name="Swedbank", bank_account_iban="LT00 5555 6666 7777 8888",
            bank_swift_bic="HABALT22", billing_address="DevOps St. 5, Kaunas",
            payment_terms_days=21,
        )
        InvoiceTemplate.objects.create(
            title="DevOps Pro - Default", code="DEFAULT",
            template_type=InvoiceTemplate.Type.CONTRACTOR, status=InvoiceTemplate.Status.ACTIVE,
            is_default=True, contractor=demo_contr2, parent=global_contr_lt,
            company_name=demo_prof2.company_name, billing_address=demo_prof2.billing_address,
            country="LT", default_currency="EUR",
            vat_registered=True, vat_number=demo_prof2.vat_number,
            vat_rate_percent=demo_prof2.vat_rate_percent,
            bank_name=demo_prof2.bank_name, bank_account_iban=demo_prof2.bank_account_iban,
            bank_swift_bic=demo_prof2.bank_swift_bic,
            invoice_series_prefix=demo_prof2.invoice_series_prefix,
            next_invoice_number=1, payment_terms_days=21,
        )
        p_demo2 = Placement.objects.create(
            client=demo_client, contractor=demo_contr2,
            client_rate=D("110"), contractor_rate=D("80"),
            currency="EUR", start_date=date(2026, 2, 1),
            status="ACTIVE", approval_flow="BROKER_ONLY",
            client_invoice_template=client_tpl_lt,
            title="DevOps Engineer", notes="Demo DevOps placement",
        )

        # Demo contractor 3
        demo_contr3 = User.objects.create_user(
            "demo.contr3@mail.com", PWD, full_name="Demo Designer", role="CONTRACTOR"
        )
        demo_prof3 = ContractorProfile.objects.create(
            user=demo_contr3, company_name="Design Studio MB",
            country="LT", vat_registered=False,
            invoice_series_prefix="DS-",
            bank_name="Luminor", bank_account_iban="LT00 9999 0000 1111 2222",
            bank_swift_bic="AGBLLT2X", billing_address="Design Ave. 10, Vilnius",
            payment_terms_days=30,
        )
        InvoiceTemplate.objects.create(
            title="Design Studio - Default", code="DEFAULT",
            template_type=InvoiceTemplate.Type.CONTRACTOR, status=InvoiceTemplate.Status.ACTIVE,
            is_default=True, contractor=demo_contr3, parent=global_contr_lt,
            company_name=demo_prof3.company_name, billing_address=demo_prof3.billing_address,
            country="LT", default_currency="EUR",
            vat_registered=False,
            bank_name=demo_prof3.bank_name, bank_account_iban=demo_prof3.bank_account_iban,
            bank_swift_bic=demo_prof3.bank_swift_bic,
            invoice_series_prefix=demo_prof3.invoice_series_prefix,
            next_invoice_number=1, payment_terms_days=30,
        )
        p_demo3 = Placement.objects.create(
            client=demo_client, contractor=demo_contr3,
            client_rate=D("75"), contractor_rate=D("55"),
            currency="EUR", start_date=date(2026, 2, 1),
            status="ACTIVE", approval_flow="BROKER_ONLY",
            client_invoice_template=client_tpl_lt,
            title="UI/UX Designer", notes="Demo design placement",
        )

        # ── HELPER: create timesheet with entries ────────────────────────────
        def make_ts(placement, year, month, status, task, num_days=None, start_from=None):
            if start_from:
                days = workdays_from(year, month, start_from)
            else:
                days = workdays_in_month(year, month)
            if num_days:
                days = days[:num_days]
            hours = D(str(len(days) * 8))
            ts = Timesheet.objects.create(
                placement=placement, year=year, month=month,
                status=status, total_hours=hours,
            )
            for d in days:
                TimesheetEntry.objects.create(timesheet=ts, date=d, hours=D("8"), task_name=task)
            return ts

        # ── TIMESHEETS ───────────────────────────────────────────────────────
        self.stdout.write("Creating timesheets...")

        # P1 — Alex @ TechVibe
        ts_p1 = []
        ts_p1.append(make_ts(p1, 2025, 10, "APPROVED", "Backend API development"))
        ts_p1.append(make_ts(p1, 2025, 11, "APPROVED", "Backend API development"))
        ts_p1.append(make_ts(p1, 2025, 12, "APPROVED", "Database optimization", num_days=16))
        ts_p1.append(make_ts(p1, 2026, 1, "APPROVED", "Microservices migration"))
        # Feb 2026 MISSING (no timesheet, no invoice)
        # Mar 2026 MISSING

        # P2 — Mia @ TechVibe (starts Jan 15)
        ts_p2 = []
        ts_p2.append(make_ts(p2, 2026, 1, "APPROVED", "React component library", start_from=date(2026, 1, 15)))
        ts_p2.append(make_ts(p2, 2026, 2, "APPROVED", "React component library"))
        ts_p2.append(make_ts(p2, 2026, 3, "SUBMITTED", "Dashboard redesign", num_days=15))

        # P3 — Oscar @ CloudBase
        ts_p3 = []
        ts_p3.append(make_ts(p3, 2025, 7, "APPROVED", "Cloud architecture design"))
        ts_p3.append(make_ts(p3, 2025, 8, "APPROVED", "AWS migration"))
        ts_p3.append(make_ts(p3, 2025, 9, "APPROVED", "AWS migration"))
        ts_p3.append(make_ts(p3, 2025, 10, "APPROVED", "Kubernetes setup"))
        ts_p3.append(make_ts(p3, 2025, 11, "APPROVED", "Kubernetes setup"))
        ts_p3.append(make_ts(p3, 2025, 12, "APPROVED", "Monitoring & alerts", num_days=16))
        ts_p3.append(make_ts(p3, 2026, 1, "APPROVED", "CI/CD pipeline"))
        ts_p3.append(make_ts(p3, 2026, 2, "APPROVED", "CI/CD pipeline"))
        ts_p3.append(make_ts(p3, 2026, 3, "DRAFT", "Performance tuning", num_days=8))

        # P4 — Nina @ NordSoft
        ts_p4 = []
        ts_p4.append(make_ts(p4, 2026, 2, "APPROVED", "Data pipeline setup"))
        # Mar 2026 MISSING

        # P5 — Sam @ MediCorp
        ts_p5 = []
        ts_p5.append(make_ts(p5, 2026, 1, "APPROVED", "Security assessment"))
        ts_p5.append(make_ts(p5, 2026, 2, "APPROVED", "Penetration testing"))
        ts_p5.append(make_ts(p5, 2026, 3, "SUBMITTED", "Vulnerability remediation", num_days=17))

        # P6 — Alex @ CloudBase (completed)
        ts_p6 = []
        ts_p6.append(make_ts(p6, 2025, 3, "APPROVED", "API audit"))
        ts_p6.append(make_ts(p6, 2025, 4, "APPROVED", "API migration"))
        ts_p6.append(make_ts(p6, 2025, 5, "APPROVED", "API migration"))
        ts_p6.append(make_ts(p6, 2025, 6, "APPROVED", "Testing & QA"))
        ts_p6.append(make_ts(p6, 2025, 7, "APPROVED", "Documentation"))
        ts_p6.append(make_ts(p6, 2025, 8, "APPROVED", "Handover"))

        # P7 — Mia @ NordSoft (completed)
        ts_p7 = []
        ts_p7.append(make_ts(p7, 2025, 6, "APPROVED", "Legacy code analysis"))
        ts_p7.append(make_ts(p7, 2025, 7, "APPROVED", "Rewrite planning"))
        ts_p7.append(make_ts(p7, 2025, 8, "APPROVED", "Core module rewrite"))
        ts_p7.append(make_ts(p7, 2025, 9, "APPROVED", "Core module rewrite"))
        ts_p7.append(make_ts(p7, 2025, 10, "APPROVED", "Integration testing"))
        ts_p7.append(make_ts(p7, 2025, 11, "APPROVED", "UAT & bug fixes"))
        ts_p7.append(make_ts(p7, 2025, 12, "APPROVED", "Deployment & handover", num_days=16))

        # Demo placement timesheets
        ts_demo = []
        ts_demo.append(make_ts(p_demo, 2026, 2, "APPROVED", "QA testing setup"))
        ts_demo.append(make_ts(p_demo, 2026, 3, "APPROVED", "Regression testing"))  # March — no invoice!

        ts_demo2 = []
        ts_demo2.append(make_ts(p_demo2, 2026, 2, "APPROVED", "CI/CD setup"))
        ts_demo2.append(make_ts(p_demo2, 2026, 3, "APPROVED", "Kubernetes migration"))  # March — no invoice!

        ts_demo3 = []
        ts_demo3.append(make_ts(p_demo3, 2026, 2, "APPROVED", "Wireframes"))
        ts_demo3.append(make_ts(p_demo3, 2026, 3, "APPROVED", "UI mockups"))  # March — no invoice!

        # ── HELPER: create invoice pair ──────────────────────────────────────
        agy_counter = {"2025": 0, "2026": 0}
        contr_counters = {alex.id: 0, mia.id: 0, oscar.id: 0, nina.id: 0, sam.id: 0, demo_contr.id: 0, demo_contr2.id: 0, demo_contr3.id: 0}
        profiles = {alex.id: prof_alex, mia.id: prof_mia, oscar.id: prof_oscar, nina.id: prof_nina, sam.id: prof_sam, demo_contr.id: demo_prof, demo_contr2.id: demo_prof2, demo_contr3.id: demo_prof3}

        def make_invoices(ts, inv_status, payment_date=None):
            pl = ts.placement
            profile = profiles[pl.contractor_id]
            year_key = str(ts.year)
            if year_key not in agy_counter:
                agy_counter[year_key] = 0
            agy_counter[year_key] += 1
            contr_counters[pl.contractor_id] += 1

            agy_num = f"AGY-{ts.year}-{agy_counter[year_key]:04d}"
            contr_num = f"{profile.invoice_series_prefix}{contr_counters[pl.contractor_id]:04d}"

            issue_dt = date(ts.year, ts.month, 1) + timedelta(days=31)
            issue_dt = date(issue_dt.year, issue_dt.month, 1)
            due_dt = issue_dt + timedelta(days=pl.client.payment_terms_days or 30)
            contr_due = issue_dt + timedelta(days=profile.payment_terms_days or 14)

            c_sub = ts.total_hours * pl.client_rate
            co_sub = ts.total_hours * pl.contractor_rate
            vat_rate = profile.vat_rate_percent if profile.vat_registered else None
            vat_amt = (co_sub * vat_rate / 100) if vat_rate else None
            co_total = co_sub + (vat_amt or 0)

            c_snapshot = {
                "client_company_name": pl.client.company_name,
                "client_billing_address": pl.client.billing_address,
                "client_vat_number": pl.client.vat_number,
                "client_payment_terms_days": pl.client.payment_terms_days,
            }
            co_snapshot = {
                "contractor_company_name": profile.company_name,
                "contractor_vat_number": profile.vat_number,
                "contractor_bank_iban": profile.bank_account_iban,
                "contractor_bank_swift": profile.bank_swift_bic,
                "contractor_bank_name": profile.bank_name,
                "contractor_billing_address": profile.billing_address,
                "contractor_payment_terms_days": profile.payment_terms_days,
                "contractor_invoice_series_prefix": profile.invoice_series_prefix,
            }

            broker = jonas  # default generated_by
            Invoice.objects.create(
                invoice_number=agy_num, invoice_type="CLIENT_INVOICE",
                timesheet=ts, placement=pl, client=pl.client, contractor=pl.contractor,
                year=ts.year, month=ts.month, currency=pl.currency,
                hourly_rate=pl.client_rate, total_hours=ts.total_hours,
                subtotal=c_sub, total_amount=c_sub,
                status=inv_status, issue_date=issue_dt, due_date=due_dt,
                payment_date=payment_date, billing_snapshot=c_snapshot,
                generated_by=broker,
            )
            Invoice.objects.create(
                invoice_number=contr_num, invoice_type="CONTRACTOR_INVOICE",
                timesheet=ts, placement=pl, client=pl.client, contractor=pl.contractor,
                year=ts.year, month=ts.month, currency=pl.currency,
                hourly_rate=pl.contractor_rate, total_hours=ts.total_hours,
                subtotal=co_sub, vat_rate_percent=vat_rate, vat_amount=vat_amt,
                total_amount=co_total,
                status=inv_status, issue_date=issue_dt, due_date=contr_due,
                payment_date=payment_date, billing_snapshot=co_snapshot,
                generated_by=broker,
            )

        def last_day(year, month):
            _, d = calendar.monthrange(year, month)
            return date(year, month, d)

        # ── INVOICES ─────────────────────────────────────────────────────────
        self.stdout.write("Creating invoices...")

        # All approved timesheets get invoices
        all_approved = []
        all_approved += ts_p1[:5]   # P1: Oct-Feb (5)
        all_approved += ts_p2[:2]   # P2: Jan-Feb (2)
        all_approved += ts_p3[:8]   # P3: Jul 2025 - Feb 2026 (8)
        all_approved += ts_p4[:1]   # P4: Feb (1)
        all_approved += ts_p5[:2]   # P5: Jan-Feb (2)
        all_approved += ts_p6       # P6: Mar-Aug 2025 (6)
        all_approved += ts_p7       # P7: Jun-Dec 2025 (7)
        all_approved += ts_demo[:1]  # Demo: Feb only (March left without invoice!)
        all_approved += ts_demo2[:1] # Demo2: Feb only
        all_approved += ts_demo3[:1] # Demo3: Feb only

        for ts in all_approved:
            is_2025 = ts.year == 2025
            is_jan26 = ts.year == 2026 and ts.month == 1
            if is_2025:
                next_m = ts.month + 1 if ts.month < 12 else 1
                next_y = ts.year if ts.month < 12 else ts.year + 1
                pay_dt = last_day(next_y, next_m)
                make_invoices(ts, "PAID", payment_date=pay_dt)
            elif is_jan26:
                make_invoices(ts, "PAID", payment_date=date(2026, 2, 28))
            else:
                make_invoices(ts, "ISSUED")

        # Update contractor next_invoice_numbers (both profile and template)
        for uid, count in contr_counters.items():
            ContractorProfile.objects.filter(user_id=uid).update(next_invoice_number=count + 1)
            InvoiceTemplate.objects.filter(
                contractor_id=uid, template_type="CONTRACTOR", is_default=True
            ).update(next_invoice_number=count + 1)

        # ── GENERATE PDFs ────────────────────────────────────────────────────
        self.stdout.write("Generating invoice PDFs...")
        for inv in Invoice.objects.select_related("client", "contractor").exclude(invoice_number__startswith="AGY-TEST"):
            generate_invoice_pdf(inv)

        # ── INVOICE NOTIFICATIONS ─────────────────────────────────────────────
        self.stdout.write("Creating invoice notifications...")
        for inv in Invoice.objects.select_related("client", "contractor").exclude(invoice_number__startswith="AGY-TEST"):
            # Created notification
            InvoiceNotification.objects.create(
                invoice=inv, created_by=jonas, title="Invoice Created",
                text=f"Invoice {inv.invoice_number} created for {inv.client.company_name}",
                status="DRAFT", visible_to_contractor=False, visible_to_client=False,
            )
            if inv.status in ("ISSUED", "PAID", "VOIDED", "CORRECTED"):
                InvoiceNotification.objects.create(
                    invoice=inv, created_by=jonas, title="Invoice Issued",
                    text=f"Invoice {inv.invoice_number} has been issued",
                    status="ISSUED", visible_to_contractor=True, visible_to_client=True,
                )
            if inv.status == "PAID":
                InvoiceNotification.objects.create(
                    invoice=inv, created_by=jonas, title="Payment Received",
                    text=f"Payment received for invoice {inv.invoice_number}",
                    status="PAID", visible_to_contractor=True, visible_to_client=True,
                )

        # ── DOCUMENTS ────────────────────────────────────────────────────────
        self.stdout.write("Creating placement documents...")
        docs = [
            (p1, "alex_techvibe_nda.pdf", "NDA", jonas),
            (p1, "alex_techvibe_contract.pdf", "Contract", jonas),
            (p2, "mia_techvibe_contract.pdf", "Contract", jonas),
            (p3, "oscar_cloudbase_nda.pdf", "NDA", laura),
            (p3, "oscar_cloudbase_contract.pdf", "Contract", laura),
            (p3, "oscar_cloudbase_sow.pdf", "Statement of Work", laura),
            (p4, "nina_nordsoft_contract.pdf", "Contract", jonas),
            (p5, "sam_medicorp_nda.pdf", "NDA", jonas),
            (p5, "sam_medicorp_contract.pdf", "Contract", jonas),
        ]
        for placement, filename, label, uploader in docs:
            content = ContentFile(b"%PDF-1.4 dummy content for " + filename.encode(), name=filename)
            PlacementDocument.objects.create(
                placement=placement, file=content, file_name=filename,
                file_size_bytes=len(content), mime_type="application/pdf",
                label=label, uploaded_by=uploader,
            )

        # ── LEGACY TEST USERS (for backend API tests + Playwright tests) ────
        self.stdout.write("Creating legacy test users (admin@test.com, broker1@test.com, etc.)...")

        # Users
        t_admin = User.objects.create_user("admin@test.com", PWD, full_name="Admin User", role="ADMIN")
        t_broker1 = User.objects.create_user("broker1@test.com", PWD, full_name="Broker One", role="BROKER")
        t_broker2 = User.objects.create_user("broker2@test.com", PWD, full_name="Broker Two", role="BROKER")
        t_contr1 = User.objects.create_user("contractor1@test.com", PWD, full_name="John Doe", role="CONTRACTOR")
        t_contr2 = User.objects.create_user("contractor2@test.com", PWD, full_name="Jane Smith", role="CONTRACTOR")
        t_cc1 = User.objects.create_user("client1@test.com", PWD, full_name="Alice Acme", role="CLIENT_CONTACT")
        t_cc2 = User.objects.create_user("client2@test.com", PWD, full_name="Bob Globex", role="CLIENT_CONTACT")

        # Contractor profiles
        ContractorProfile.objects.create(
            user=t_contr1, company_name="JD Consulting", country="LT",
            vat_registered=True, vat_number="LT123456789", vat_rate_percent=D("21"),
            invoice_series_prefix="JD-2026-", bank_name="SEB",
            bank_account_iban="LT12 3456 7890 1234 5678", bank_swift_bic="CBVILT2X",
            billing_address="123 Main St, Vilnius", payment_terms_days=14,
        )
        ContractorProfile.objects.create(
            user=t_contr2, company_name="JS Dev Ltd", country="GB",
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
        ClientContact.objects.create(user=t_cc1, client=acme, job_title="PM", is_primary=True)
        ClientContact.objects.create(user=t_cc2, client=globex, job_title="CTO", is_primary=True)

        # Broker assignments: broker1 -> both, broker2 -> Globex only
        BrokerClientAssignment.objects.create(broker=t_broker1, client=acme)
        BrokerClientAssignment.objects.create(broker=t_broker1, client=globex)
        BrokerClientAssignment.objects.create(broker=t_broker2, client=globex)

        # Placements
        t_pl1 = Placement.objects.create(
            client=acme, contractor=t_contr1, client_rate=D("80"), contractor_rate=D("60"),
            currency="EUR", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
            status="ACTIVE", approval_flow="CLIENT_THEN_BROKER",
            client_can_view_invoices=True, client_can_view_documents=True,
        )
        t_pl2 = Placement.objects.create(
            client=globex, contractor=t_contr2, client_rate=D("90"), contractor_rate=D("70"),
            currency="GBP", start_date=date(2026, 1, 1),
            status="ACTIVE", approval_flow="BROKER_ONLY",
        )
        Placement.objects.create(
            client=acme, contractor=t_contr2, client_rate=D("85"), contractor_rate=D("65"),
            currency="EUR", start_date=date(2026, 4, 1), status="DRAFT",
        )

        # Timesheets: Feb APPROVED + Mar SUBMITTED for pl1, Feb DRAFT for pl2
        t_ts1 = Timesheet.objects.create(
            placement=t_pl1, year=2026, month=2, status="APPROVED", total_hours=D("160"),
        )
        for day in range(1, 21):
            TimesheetEntry.objects.create(timesheet=t_ts1, date=date(2026, 2, day), hours=D("8"), task_name="Development")
        t_ts2 = Timesheet.objects.create(
            placement=t_pl1, year=2026, month=3, status="SUBMITTED", total_hours=D("120"),
        )
        for day in range(1, 16):
            TimesheetEntry.objects.create(timesheet=t_ts2, date=date(2026, 3, day), hours=D("8"), task_name="Development")
        t_ts3 = Timesheet.objects.create(
            placement=t_pl2, year=2026, month=2, status="DRAFT", total_hours=D("40"),
        )
        for day in range(1, 6):
            TimesheetEntry.objects.create(timesheet=t_ts3, date=date(2026, 2, day), hours=D("8"), task_name="Consulting")

        # Invoices for t_pl1 Feb
        Invoice.objects.create(
            invoice_number="AGY-TEST-0001", invoice_type="CLIENT_INVOICE",
            timesheet=t_ts1, placement=t_pl1, client=acme, contractor=t_contr1,
            year=2026, month=2, currency="EUR", hourly_rate=D("80"),
            total_hours=D("160"), subtotal=D("12800"), total_amount=D("12800"),
            status="ISSUED", issue_date=date(2026, 3, 1), due_date=date(2026, 3, 31),
            billing_snapshot={"client_company_name": "Acme Corp"},
            generated_by=t_broker1,
        )
        Invoice.objects.create(
            invoice_number="JD-TEST-0001", invoice_type="CONTRACTOR_INVOICE",
            timesheet=t_ts1, placement=t_pl1, client=acme, contractor=t_contr1,
            year=2026, month=2, currency="EUR", hourly_rate=D("60"),
            total_hours=D("160"), subtotal=D("9600"),
            vat_rate_percent=D("21"), vat_amount=D("2016"), total_amount=D("11616"),
            status="DRAFT", issue_date=date(2026, 3, 1), due_date=date(2026, 3, 15),
            billing_snapshot={"contractor_company_name": "JD Consulting"},
            generated_by=t_broker1,
        )

        # ── SUMMARY ──────────────────────────────────────────────────────────
        ts_count = Timesheet.objects.count()
        inv_count = Invoice.objects.count()
        doc_count = PlacementDocument.objects.count()
        user_count = User.objects.count()
        client_count = Client.objects.count()
        pl_count = Placement.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f"Populated: {user_count} users, {client_count} clients, {pl_count} placements, "
            f"{ts_count} timesheets, {inv_count} invoices, {doc_count} documents"
        ))
