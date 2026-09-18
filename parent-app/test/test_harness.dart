import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/auth/auth_state.dart';
import 'package:parent_app/src/auth/token_store.dart';
import 'package:parent_app/src/notifications/device_token_registrar.dart';
import 'package:parent_app/src/notifications/push_token_provider.dart';
import 'package:parent_app/src/router/app_router.dart';
import 'package:parent_app/src/theme/app_theme.dart';
import 'package:parent_app/src/theme/theme_controller.dart';
import 'package:parent_app/src/theme/locale_controller.dart';
import 'package:parent_app/l10n/app_localizations.dart';

/// Builds the same provider/router tree as `ParentApp` (lib/main.dart), but with an injected
/// [ApiClient] and [TokenStore] instead of a real network client and platform secure storage —
/// neither of which is available in the widget-test environment. Also schoolos an empty
/// `shared_preferences` mock store, since FEAT-014's offline cache (`DataCache`) and
/// `ThemeController` both read/write it and would otherwise hang on the unmocked platform channel.
///
/// [deviceTokenRegistrar] defaults to a Noop-backed one so existing tests are unaffected; pass a
/// real one (built with a fake PushTokenProvider) only in the tests that specifically exercise
/// device-token registration or push-tap navigation. [themeController] defaults to a fresh,
/// unrestored controller (system mode) — pass one already set to a mode to test theme-dependent UI.
Widget buildTestApp({
  required ApiClient api,
  TokenStore? tokenStore,
  DeviceTokenRegistrar? deviceTokenRegistrar,
  ThemeController? themeController,
}) {
  SharedPreferences.setMockInitialValues({});
  final auth = AuthState(api: api, tokenStore: tokenStore ?? InMemoryTokenStore());
  final router = buildAppRouter(auth);
  final registrar =
      deviceTokenRegistrar ?? DeviceTokenRegistrar(api: api, tokenProvider: NoopPushTokenProvider());
  final theme = themeController ?? ThemeController();
  final locale = LocaleController();

  return MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: api),
      ChangeNotifierProvider<AuthState>.value(value: auth),
      Provider<DeviceTokenRegistrar>.value(value: registrar),
      ChangeNotifierProvider<ThemeController>.value(value: theme),
      ChangeNotifierProvider<LocaleController>.value(value: locale),
    ],
    child: Consumer<ThemeController>(
      builder: (context, themeController, _) => MaterialApp.router(
        theme: buildAppTheme(),
        darkTheme: buildDarkAppTheme(),
        themeMode: themeController.mode,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
}