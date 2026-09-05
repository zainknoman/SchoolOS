import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/cache/cached_load.dart';
import 'package:parent_app/src/cache/data_cache.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('no cache, fetch succeeds: reports fresh data as not stale and writes the cache', () async {
    final cache = await DataCache.open();
    final reported = <(int, bool)>[];

    await loadWithCache<int>(
      cache: cache,
      cacheKey: 'k',
      fetch: () async => 42,
      toJson: (v) => v,
      fromJson: (j) => j as int,
      onData: (data, lastUpdated, {required stale}) => reported.add((data, stale)),
      onError: (_) => fail('should not error'),
    );

    expect(reported, [(42, false)]);
    expect(cache.read('k')!.json, 42);
  });

  test('cache present, fetch succeeds: reports cached data first (stale), then fresh data (not stale)', () async {
    final cache = await DataCache.open();
    await cache.write('k', 1);
    final reported = <(int, bool)>[];

    await loadWithCache<int>(
      cache: cache,
      cacheKey: 'k',
      fetch: () async => 2,
      toJson: (v) => v,
      fromJson: (j) => j as int,
      onData: (data, lastUpdated, {required stale}) => reported.add((data, stale)),
      onError: (_) => fail('should not error'),
    );

    expect(reported, [(1, true), (2, false)]);
  });

  test('cache present, fetch fails: only reports cached data (stale) and never calls onError', () async {
    final cache = await DataCache.open();
    await cache.write('k', 1);
    final reported = <(int, bool)>[];

    await loadWithCache<int>(
      cache: cache,
      cacheKey: 'k',
      fetch: () async => throw ApiException('offline', 0),
      toJson: (v) => v,
      fromJson: (j) => j as int,
      onData: (data, lastUpdated, {required stale}) => reported.add((data, stale)),
      onError: (_) => fail('should not error when cache can cover the failure'),
    );

    expect(reported, [(1, true)]);
  });

  test('no cache, fetch fails: reports the error', () async {
    final cache = await DataCache.open();
    String? error;

    await loadWithCache<int>(
      cache: cache,
      cacheKey: 'k',
      fetch: () async => throw ApiException('offline', 0),
      toJson: (v) => v,
      fromJson: (j) => j as int,
      onData: (_, _, {required stale}) => fail('should not have data'),
      onError: (message) => error = message,
    );

    expect(error, 'offline');
  });
}
