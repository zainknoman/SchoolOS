import '../api/api_client.dart';
import 'data_cache.dart';

/// Cache-first-then-refresh flow shared by every FEAT-014 screen: whatever was cached
/// for [cacheKey] is reported immediately (marked `stale: true`) so the screen never
/// starts from blank, then [fetch] runs; on success the fresh value replaces it
/// (`stale: false`) and is written back to the cache, and on failure the cached value
/// (if any) is left on screen instead of surfacing an error.
Future<void> loadWithCache<T>({
  required DataCache cache,
  required String cacheKey,
  required Future<T> Function() fetch,
  required dynamic Function(T) toJson,
  required T Function(dynamic) fromJson,
  required void Function(T data, DateTime lastUpdated, {required bool stale})
  onData,
  required void Function(String message) onError,
}) async {
  final cached = cache.read(cacheKey);
  if (cached != null) {
    onData(fromJson(cached.json), cached.fetchedAt, stale: true);
  }

  try {
    final fresh = await fetch();
    final now = DateTime.now();
    await cache.write(cacheKey, toJson(fresh));
    onData(fresh, now, stale: false);
  } on ApiException catch (e) {
    if (cached == null) onError(e.message);
  }
}
