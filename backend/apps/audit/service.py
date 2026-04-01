def log_audit(*, entity_type, entity_id, action, title, text="",
              user=None, data_before=None, data_after=None,
              visible_to_contractor=True, visible_to_client=True):
    from .models import AuditLog
    return AuditLog.objects.create(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        title=title,
        text=text,
        created_by=user,
        data_before=data_before,
        data_after=data_after,
        visible_to_contractor=visible_to_contractor,
        visible_to_client=visible_to_client,
    )
