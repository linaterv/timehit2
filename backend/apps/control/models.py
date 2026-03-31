from django.db import models


class AgencySettings(models.Model):
    """Singleton model for agency-wide settings."""
    default_payment_terms_client_days = models.IntegerField(default=30)
    default_payment_terms_contractor_days = models.IntegerField(default=35)

    class Meta:
        db_table = "agency_settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
