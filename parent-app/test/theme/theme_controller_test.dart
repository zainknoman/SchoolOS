import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('starts on system mode before restore() runs', () {
    final controller = ThemeController();
    expect(controller.mode, ThemeMode.system);
  });

  test('restore() loads a previously-saved mode and notifies listeners', () async {
    SharedPreferences.setMockInitialValues({'theme_mode': 'dark'});
    final controller = ThemeController();
    var notified = false;
    controller.addListener(() => notified = true);

    await controller.restore();

    expect(controller.mode, ThemeMode.dark);
    expect(notified, isTrue);
  });

  test('restore() leaves the default when nothing was saved', () async {
    final controller = ThemeController();

    await controller.restore();

    expect(controller.mode, ThemeMode.system);
  });

  test('setMode() updates immediately and persists for the next restore()', () async {
    final controller = ThemeController();

    await controller.setMode(ThemeMode.light);
    expect(controller.mode, ThemeMode.light);

    final reloaded = ThemeController();
    await reloaded.restore();
    expect(reloaded.mode, ThemeMode.light);
  });
}