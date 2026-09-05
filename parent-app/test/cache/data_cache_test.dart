import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/cache/data_cache.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('read returns null when nothing has been cached for that key', () async {
    final cache = await DataCache.open();

    expect(cache.read('timetable:s1'), isNull);
  });

  test('write then read round-trips the JSON payload and records the fetch time', () async {
    final cache = await DataCache.open();
    final before = DateTime.now();

    await cache.write('timetable:s1', [
      {'subject': 'Math'},
    ]);
    final result = cache.read('timetable:s1');

    expect(result, isNotNull);
    expect(result!.json, [
      {'subject': 'Math'},
    ]);
    expect(result.fetchedAt.isAfter(before.subtract(const Duration(seconds: 1))), isTrue);
  });

  test('different keys do not collide', () async {
    final cache = await DataCache.open();

    await cache.write('timetable:s1', {'a': 1});
    await cache.write('timetable:s2', {'a': 2});

    expect(cache.read('timetable:s1')!.json, {'a': 1});
    expect(cache.read('timetable:s2')!.json, {'a': 2});
  });
}
