from __future__ import annotations

from . import notification_delivery as delivery


LEGACY_ALL = {"reply", "followup", "mail", "deal"}


def install_system_notification_category() -> None:
    """Extend external reminders without surprising partially-scoped routes.

    Existing routes that selected all four historical business categories are
    treated as "all reminders" and automatically receive system/backup alerts.
    Routes that intentionally selected only a subset keep that exact scope.
    """
    if getattr(delivery, "_huidi_system_category_installed", False):
        return
    delivery.CATEGORY_NAMES["system"] = "系统与备份"
    if "system" not in delivery.DEFAULT_CATEGORIES:
        delivery.DEFAULT_CATEGORIES.append("system")

    original_categories = delivery._categories

    def categories_with_system(value: str) -> list[str]:
        out = list(original_categories(value))
        if LEGACY_ALL.issubset(set(out)) and "system" not in out:
            out.append("system")
        return out

    delivery._categories = categories_with_system
    delivery._huidi_system_category_installed = True


install_system_notification_category()
