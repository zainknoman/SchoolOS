import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'src/api/api_client.dart';
import 'src/api/refreshing_http_client.dart';
import 'src/auth/auth_state.dart';
import 'src/auth/token_store.dart';
import 'src/router/app_router.dart';
import 'src/theme/app_theme.dart';

// Override at build/run time with --dart-define=API_BASE_URL=http://10.0.2.2:3000 for the Android
// emulator (which can't reach the host's localhost directly), or the LAN IP for a physical device.
const _apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');

void main() {
  runApp(const ParentApp());
}

class ParentApp extends StatefulWidget {
  const ParentApp({super.key});

  @override
  State<ParentApp> createState() => _ParentAppState();
}

class _ParentAppState extends State<ParentApp> {
  // _api's RefreshingHttpClient closes over `_auth` via a closure that isn't invoked until an
  // actual 401 happens — by then `_auth`'s own (lazy, late-final) initializer below has always
  // already run, since evaluating `_auth`'s initializer is what first triggers `_api`'s.
  late final ApiClient _api = ApiClient(
    baseUrl: _apiBaseUrl,
    client: RefreshingHttpClient(inner: http.Client(), onUnauthorized: () => _auth.refreshSession()),
  );
  late final AuthState _auth = AuthState(api: _api, tokenStore: SecureTokenStore());
  late final GoRouter _router = buildAppRouter(_auth);

  @override
  void initState() {
    super.initState();
    // Fire-and-forget: AuthState.notifyListeners() (via restoreSession) drives the router's
    // refreshListenable, so a restored session reroutes away from /login automatically.
    _auth.restoreSession();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: _api),
        ChangeNotifierProvider<AuthState>.value(value: _auth),
      ],
      child: MaterialApp.router(
        title: 'School OS',
        theme: buildAppTheme(),
        routerConfig: _router,
      ),
    );
  }
}
