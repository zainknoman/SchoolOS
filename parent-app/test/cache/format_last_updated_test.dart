import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/cache/format_last_updated.dart';

void main() {
  test('formats month, day and zero-padded 24h time', () {
    expect(formatLastUpdated(DateTime(2026, 9, 5, 14, 32)), 'Sep 5, 14:32');
  });

  test('zero-pads a single-digit hour and minute', () {
    expect(formatLastUpdated(DateTime(2026, 1, 1, 9, 5)), 'Jan 1, 09:05');
  });
}
