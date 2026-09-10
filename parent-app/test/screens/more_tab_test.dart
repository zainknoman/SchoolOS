import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/more_tab.dart';
import 'package:parent_app/src/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _child = ChildSummary(
  id: 'child-1',
  name: 'Eshaal Sample',
  grNumber: 'GR-1001',
  campus: 'Gulistan-e-Jauhar',
  schoolClass: 'Grade 3',
  section: '3A',
);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('the appearance dropdown switches ThemeController to Dark', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response('not found', 404)),
    );
    final themeController = ThemeController();

    await tester.pumpWidget(
      MultiProvider(
        providers: [ChangeNotifierProvider<ThemeController>.value(value: themeController)],
        child: MaterialApp(
          home: Scaffold(
            body: MoreTab(
              accessToken: 'tok',
              api: api,
              children: const [_child],
              activeChildId: 'child-1',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(themeController.mode, ThemeMode.system);

    await tester.tap(find.byKey(const Key('themeModeDropdown')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dark').last);
    await tester.pumpAndSettle();

    expect(themeController.mode, ThemeMode.dark);
  });
}