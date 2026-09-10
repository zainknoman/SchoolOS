import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../firebase_options.dart';
import 'notification_target.dart';

/// Seam between HomeShell/DeviceTokenRegistrar and the real firebase_messaging plugin — lets
/// tests and the (currently placeholder-only) web target substitute a no-op implementation
/// instead of touching real platform channels.
abstract class PushTokenProvider {
  Future<String?> getToken();
  Stream<NotificationTarget> get onNotificationTapped;
}

/// Real implementation. Firebase.initializeApp() is guarded: this project has no real Firebase
/// project yet (see firebase_options.dart), so initialization is expected to fail today — that
/// failure (and any MissingPluginException from running under `flutter test`, which has no real
/// platform channels) degrades to "no push for this session" rather than crashing the app. The
/// foreground-resume polling stopgap (HomeShell's WidgetsBindingObserver) is what keeps the app
/// useful in the meantime.
class FirebaseMessagingTokenProvider implements PushTokenProvider {
  bool _initialized = false;

  Future<bool> _ensureInitialized() async {
    if (_initialized) return true;
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      _initialized = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<String?> getToken() async {
    if (!await _ensureInitialized()) return null;
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<NotificationTarget> get onNotificationTapped => FirebaseMessaging.onMessageOpenedApp
      .map(notificationTargetFromMessage)
      .where((target) => target != null)
      .cast<NotificationTarget>();
}

/// Used wherever push isn't meaningful: widget tests (test_harness.dart) and any future web
/// build (FCM web push needs a service worker + VAPID key, out of this sprint's scope — the
/// roadmap's Definition of Done targets "a physical/emulated Android device").
class NoopPushTokenProvider implements PushTokenProvider {
  @override
  Future<String?> getToken() async => null;

  @override
  Stream<NotificationTarget> get onNotificationTapped => const Stream.empty();
}