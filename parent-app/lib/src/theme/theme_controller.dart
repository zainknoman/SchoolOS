import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _themeModeKey = 'theme_mode';

/// Persisted appearance preference — mirrors AuthState's shape (constructed with a safe default,
/// then asynchronously restored from storage, notifying listeners once that completes) rather than
/// requiring an async factory, so it can be constructed synchronously in main.dart/test_harness.dart
/// alongside ApiClient/AuthState/DeviceTokenRegistrar.
class ThemeController extends ChangeNotifier {
  ThemeMode _mode = ThemeMode.system;

  ThemeMode get mode => _mode;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_themeModeKey);
    if (raw == null) return;
    _mode = ThemeMode.values.byName(raw);
    notifyListeners();
  }

  Future<void> setMode(ThemeMode mode) async {
    _mode = mode;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeModeKey, mode.name);
  }
}