import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// A previously-cached JSON payload plus when it was fetched — backs the
/// "Last updated: …" indicator FEAT-014 shows in place of a blank screen.
class CachedData {
  const CachedData({required this.fetchedAt, required this.json});

  final DateTime fetchedAt;
  final dynamic json;
}

/// Persists each screen's last-successful response under its own key, so a cold
/// start or a failed refresh can still show real data instead of a blank screen.
class DataCache {
  DataCache(this._prefs);

  final SharedPreferences _prefs;

  static Future<DataCache> open() async =>
      DataCache(await SharedPreferences.getInstance());

  CachedData? read(String key) {
    final raw = _prefs.getString(key);
    if (raw == null) return null;
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return CachedData(
      fetchedAt: DateTime.parse(decoded['fetchedAt'] as String),
      json: decoded['data'],
    );
  }

  Future<void> write(String key, dynamic json) {
    final payload = jsonEncode({
      'fetchedAt': DateTime.now().toIso8601String(),
      'data': json,
    });
    return _prefs.setString(key, payload);
  }
}
