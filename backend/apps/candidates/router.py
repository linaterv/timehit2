class CandidatesRouter:
    app_label = "candidates"

    def db_for_read(self, model, **hints):
        if model._meta.app_label == self.app_label:
            return "candidates"
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == self.app_label:
            return "candidates"
        return None

    def allow_relation(self, obj1, obj2, **hints):
        if obj1._meta.app_label == self.app_label and obj2._meta.app_label == self.app_label:
            return True
        return None

    def allow_migrate(self, db, app_label, **hints):
        if app_label == self.app_label:
            return db == "candidates"
        return db == "default"
