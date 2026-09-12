from __future__ import annotations

from . import notification_delivery as delivery


def install_system_notification_category() -> None:
    """Keep the system/backup trigger available without silently subscribing rules.

    The canonical NotificationDelivery owner already declares ``system`` as an
    available category. This compatibility hook intentionally does *not* append
    it to DEFAULT_CATEGORIES and does not rewrite historical four-category routes.
    System/backup alerts are higher-sensitivity operational events and therefore
    require an explicit owner/admin opt-in on each notification automation rule.
    """
    if getattr(delivery, "_huidi_system_category_installed", False):
        return
    delivery.CATEGORY_NAMES.setdefault("system", "系统检查 / 备份")
    delivery._huidi_system_category_installed = True


install_system_notification_category()
