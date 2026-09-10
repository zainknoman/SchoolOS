import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/notifications/notification_target.dart';

void main() {
  test('maps a circular push message to its NotificationTarget', () {
    final message = RemoteMessage(data: {'type': 'circular', 'entityRef': 'c1'});

    final target = notificationTargetFromMessage(message);

    expect(target, isNotNull);
    expect(target!.type, 'circular');
    expect(target.entityRef, 'c1');
  });

  test('treats an empty entityRef the same as absent (matches the backend sending "")', () {
    final message = RemoteMessage(data: {'type': 'diary', 'entityRef': ''});

    final target = notificationTargetFromMessage(message);

    expect(target!.entityRef, isNull);
  });

  test('returns null for a message with no type in its data payload', () {
    final message = RemoteMessage(data: {});

    expect(notificationTargetFromMessage(message), isNull);
  });
}