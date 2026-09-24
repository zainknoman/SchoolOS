import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'token_store.dart';

/// Parent app's session state — deliberately mirrors staff-console's Pinia auth store so the two
/// clients behave the same way against the same backend contract.
class AuthState extends ChangeNotifier {
  //AuthState({required ApiClient api, required TokenStore tokenStore})
  //  : _api = api,
  //    _tokenStore = tokenStore;
  AuthState({required this._api, required this._tokenStore});

  final ApiClient _api;
  final TokenStore _tokenStore;

  String? _accessToken;
  String? _refreshToken;
  String? _role;
  bool _mustChangePassword = false;

  // Single-flight guard for concurrent 401s: several in-flight requests can all expire around the
  // same moment, and the backend rotates the refresh token on every redemption — a second
  // concurrent refresh call would present an already-revoked token and fail.
  Future<String?>? _inFlightRefresh;

  bool get isAuthenticated => _accessToken != null;
  String? get role => _role;
  String? get accessToken => _accessToken;

  /// True while the server requires a new password (BL-21/BL-64); the router shows only the
  /// change-password screen until it is cleared.
  bool get mustChangePassword => _mustChangePassword;

  /// Called once at app start — restores a session from secure storage so the parent isn't
  /// forced to log in again every time the app opens (FEAT-005 acceptance criteria).
  Future<void> restoreSession() async {
    final accessToken = await _tokenStore.read('accessToken');
    final refreshToken = await _tokenStore.read('refreshToken');
    final role = await _tokenStore.read('role');
    if (accessToken != null && refreshToken != null && role != null) {
      _accessToken = accessToken;
      _refreshToken = refreshToken;
      _role = role;
      _mustChangePassword = await _tokenStore.read('mustChangePassword') == 'true';
      notifyListeners();
    }
  }

  Future<void> login(String identifier, String password) async {
    // Errors propagate to the caller (LoginScreen) unmodified — this state layer must not add or
    // remove information from the generic auth error.
    final session = await _api.login(identifier, password);
    await _applySession(session);
  }

  /// Changes the password and adopts the fresh session the server returns — every other device
  /// is signed out by the server (BL-21).
  Future<void> changePassword(String currentPassword, String newPassword) async {
    final token = _accessToken;
    if (token == null) return;
    final session = await _api.changePassword(token, currentPassword, newPassword);
    await _applySession(session);
  }

  /// The server answered 403 PASSWORD_CHANGE_REQUIRED (e.g. an admin reset happened after sign-in).
  Future<void> markPasswordChangeRequired() async {
    if (_mustChangePassword) return;
    _mustChangePassword = true;
    await _tokenStore.write('mustChangePassword', 'true');
    notifyListeners();
  }

  Future<void> _applySession(LoginResponse session) async {
    _accessToken = session.accessToken;
    _refreshToken = session.refreshToken;
    _role = session.role;
    _mustChangePassword = session.mustChangePassword;

    await _tokenStore.write('accessToken', session.accessToken);
    await _tokenStore.write('refreshToken', session.refreshToken);
    await _tokenStore.write('role', session.role);
    await _tokenStore.write('mustChangePassword', session.mustChangePassword.toString());

    notifyListeners();
  }

  /// Called by [RefreshingHttpClient] on a 401. Returns the new access token on success (having
  /// already persisted the rotated session), or null after logging out on failure.
  Future<String?> refreshSession() {
    return _inFlightRefresh ??= _doRefresh().whenComplete(() {
      _inFlightRefresh = null;
    });
  }

  Future<String?> _doRefresh() async {
    final refreshToken = _refreshToken;
    if (refreshToken == null) return null;

    try {
      final session = await _api.refresh(refreshToken);
      await _applySession(session);
      return session.accessToken;
    } catch (_) {
      await logout();
      return null;
    }
  }

  Future<void> logout() async {
    // Revoke this device's refresh token server-side (BL-21) — best effort: signing out locally
    // must never fail because the network did.
    final refreshToken = _refreshToken;
    if (refreshToken != null) {
      try {
        await _api.logout(refreshToken);
      } catch (_) {
        // offline or already revoked — the local sign-out below still happens
      }
    }
    _accessToken = null;
    _refreshToken = null;
    _role = null;
    _mustChangePassword = false;

    await _tokenStore.delete('accessToken');
    await _tokenStore.delete('refreshToken');
    await _tokenStore.delete('role');
    await _tokenStore.delete('mustChangePassword');

    notifyListeners();
  }
}
