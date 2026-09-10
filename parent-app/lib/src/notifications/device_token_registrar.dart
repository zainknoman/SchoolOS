import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;
import '../api/api_client.dart';
import 'push_token_provider.dart';

/// Best-effort device-token registration — deliberately never throws past registerIfPossible, so
/// a parent with no FCM token yet (no real Firebase project configured, an unsupported platform,
/// a registration-endpoint hiccup) just gets no push notifications; it must never block or break
/// the screen that calls it.
class DeviceTokenRegistrar {
  DeviceTokenRegistrar({required this.api, required this.tokenProvider});

  final ApiClient api;
  final PushTokenProvider tokenProvider;

  /// No dart:io Platform — this codebase deliberately avoids dart:io so `flutter run -d chrome`
  /// (the only locally-previewable target in this dev environment) keeps compiling.
  /// defaultTargetPlatform defaults to TargetPlatform.android under flutter_test unless a test
  /// overrides debugDefaultTargetPlatformOverride, which is what makes this registrar exercisable
  /// in a widget test without any platform-channel mocking.
  String? _currentPlatformName() {
    if (kIsWeb) return null;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      default:
        return null;
    }
  }

  Future<void> registerIfPossible(String accessToken) async {
    final platform = _currentPlatformName();
    if (platform == null) return;

    final token = await tokenProvider.getToken();
    if (token == null) return;

    try {
      await api.registerDeviceToken(accessToken, token, platform);
    } on ApiException catch (_) {
      // Convenience registration only — never surface this failure to the user.
    }
  }
}