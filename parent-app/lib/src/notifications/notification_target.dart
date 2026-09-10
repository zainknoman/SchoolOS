import 'package:firebase_messaging/firebase_messaging.dart';

/// Same (type, entityRef) shape HomeShell already uses for in-app notification taps
/// (NotificationsSheet's onOpenType) — this lets a push-notification tap reuse that exact
/// navigation logic instead of a second, parallel one.
class NotificationTarget {
  const NotificationTarget({required this.type, this.entityRef});

  final String type;
  final String? entityRef;
}

/// Maps an FCM [RemoteMessage]'s data payload to a [NotificationTarget]. The payload shape comes
/// from the backend's NotificationsService.notify() (backend/src/notifications/notifications.service.ts):
/// `data: { type: input.type, entityRef: input.entityRef ?? '' }`.
NotificationTarget? notificationTargetFromMessage(RemoteMessage message) {
  final type = message.data['type'] as String?;
  if (type == null || type.isEmpty) return null;
  final rawEntityRef = message.data['entityRef'] as String?;
  final entityRef = (rawEntityRef == null || rawEntityRef.isEmpty) ? null : rawEntityRef;
  return NotificationTarget(type: type, entityRef: entityRef);
}