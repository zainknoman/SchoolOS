import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/auth/auth_state.dart';
import 'package:parent_app/src/auth/token_store.dart';
import 'package:parent_app/src/router/app_router.dart';
import 'package:parent_app/src/theme/app_theme.dart';

/// Builds the same provider/router tree as `ParentApp` (lib/main.dart), but with an injected
/// [ApiClient] and [TokenStore] instead of a real network client and platform secure storage —
/// neither of which is available in the widget-test environment. Also seeds an empty
/// `shared_preferences` mock store, since FEAT-014's offline cache (`DataCache`) reads/writes
/// it on every screen and would otherwise hang on the unmocked platform channel.
Widget buildTestApp({required ApiClient api, TokenStore? tokenStore}) {
  SharedPreferences.setMockInitialValues({});
  final auth = AuthState(api: api, tokenStore: tokenStore ?? InMemoryTokenStore());
  final router = buildAppRouter(auth);

  return MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: api),
      ChangeNotifierProvider<AuthState>.value(value: auth),
    ],
    child: MaterialApp.router(theme: buildAppTheme(), routerConfig: router),
  );
}
