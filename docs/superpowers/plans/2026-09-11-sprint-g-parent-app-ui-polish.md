# Sprint G — Parent App Second-Pass UI Polish (UI Sprint 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the parent app's design maturity in line with the staff console's 2026-09-07 shell
redesign — dark mode, no more fabricated dashboard numbers, forms that respect the actively-selected
child, a bottom-nav label that doesn't collide with the in-app notification bell, and offline caching
on the two screens (Fees, Messages) that don't have it yet.

**Architecture:** No new architectural pattern — every item extends something already proven
elsewhere in `parent-app`: `ThemeController` mirrors `AuthState`'s constructor-then-async-restore
shape; the dark palette is a direct port of the staff console's `base.css` `[data-theme='dark']`
tokens into a second `ThemeData`; `activeChildId` threading extends the `provider`-based state
`HomeShell` already holds; Fees/Messages offline caching reuses `loadWithCache`/`DataCache`/
`LastUpdatedBanner` exactly as `CalendarTab`/`CircularsTab` already do — no new caching primitive.

**Tech Stack:** Flutter/Dart (parent-app only — this sprint has no backend or staff-console surface
per the roadmap's own Features line).

**Spec:** `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md`, Sprint G section (§4, "Sprint
G — Parent App Second-Pass UI Polish (UI Sprint 3)").

## Global Constraints

- Dark-mode color values must match the staff console's `staff-console/src/assets/base.css`
  `:root[data-theme='dark']` block exactly (same hex values) — this is a "mirror staff-console
  token values" requirement, not a free redesign.
- No new state-management library — extend the existing `provider`/`ChangeNotifier` pattern
  (`AuthState` is the model to follow), per the roadmap's own "no new state-management pattern" note.
- No new caching primitive — every offline-cache addition calls the existing `loadWithCache`
  (`lib/src/cache/cached_load.dart`) and renders the existing `LastUpdatedBanner`
  (`lib/src/cache/last_updated_banner.dart`), the same way `CircularsTab` already does.
- `MoreTab`'s "Notifications" **bell icon tooltip** (`home_shell.dart`'s AppBar `IconButton`) is a
  different feature from the bottom-nav "Notifications" tab label being renamed — the bell opens the
  cross-cutting `NotificationsSheet` (diary/circular/message alerts); the bottom-nav tab at index 2
  shows `CircularsTab` specifically. Only the bottom-nav label (and its one fallback-text array
  reference) changes to "Circulars"; the bell's tooltip stays "Notifications".
- Every existing test that constructs `FeesTab`/`MessagesTab` directly (not via `buildTestApp`) does
  **not** currently call `SharedPreferences.setMockInitialValues({})` — once those screens gain a
  `DataCache` dependency, those tests need that call added or they will hang on the unmocked
  platform channel (the exact failure mode `test_harness.dart`'s own comment already warns about).

---

## File Structure

- `lib/src/theme/app_theme.dart` (modify) — add `AppColorsDark` + `buildDarkAppTheme()` alongside
  the existing light `AppColors`/`buildAppTheme()`.
- `lib/src/theme/theme_controller.dart` (new) — `ThemeController extends ChangeNotifier`, persisted
  via `shared_preferences`, mirroring `AuthState`'s restore-after-construction shape.
- `lib/main.dart` (modify) — construct and provide a `ThemeController`; wire `darkTheme`/`themeMode`
  into `MaterialApp.router`.
- `test/test_harness.dart` (modify) — provide a `ThemeController` in the test tree too.
- `lib/src/screens/more_tab.dart` (modify) — appearance (theme) toggle; thread `activeChildId`
  through to `LeaveScreen`.
- `lib/src/screens/leave_screen.dart` (modify) — accept an optional `initialChildId`.
- `lib/src/screens/home_shell.dart` (modify) — pass `_activeChildId` to `MoreTab` and `MessagesTab`;
  rename the Circulars bottom-nav destination's label.
- `lib/src/screens/messages_tab.dart` (modify) — accept `activeChildId`, thread it into
  `_ComposeView`; add offline caching to the conversation list.
- `lib/src/screens/home_tab.dart` (modify) — real Fees balance; grayed-out Results placeholder.
- `lib/src/screens/fees_tab.dart` (modify) — add offline caching to the voucher list.
- `lib/src/api/models.dart` (modify) — add `toJson()` to `FeeVoucherItem`, `FeeVoucherSummary`,
  `ConversationSummary` (needed by `loadWithCache`'s `toJson` param).
- Test files: `test/theme/theme_controller_test.dart` (new), `test/screens/more_tab_test.dart` (new
  — none exists today), `test/screens/leave_screen_test.dart` (modify), `test/screens/messages_tab_test.dart`
  (modify), `test/screens/home_tab_test.dart` (modify), `test/screens/fees_tab_test.dart` (modify),
  `test/screens/home_shell_test.dart` (modify).

---

### Task 1: Dark theme — palette, `ThemeController`, app wiring, toggle UI

**Files:**
- Modify: `parent-app/lib/src/theme/app_theme.dart`
- Create: `parent-app/lib/src/theme/theme_controller.dart`
- Modify: `parent-app/lib/main.dart`
- Modify: `parent-app/test/test_harness.dart`
- Modify: `parent-app/lib/src/screens/more_tab.dart`
- Test: `parent-app/test/theme/theme_controller_test.dart` (new)
- Test: `parent-app/test/screens/more_tab_test.dart` (new)

**Interfaces:**
- Produces: `buildDarkAppTheme(): ThemeData`, `ThemeController` (`mode: ThemeMode` getter,
  `restore(): Future<void>`, `setMode(ThemeMode): Future<void>`) — consumed by `main.dart`,
  `test_harness.dart`, and `MoreTab`.

- [ ] **Step 1: Write the failing `ThemeController` test**

Create `parent-app/test/theme/theme_controller_test.dart`:

```dart
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/theme/theme_controller_test.dart`
Expected: FAIL — `Error: Not found: 'package:parent_app/src/theme/theme_controller.dart'`.

- [ ] **Step 3: Implement `ThemeController`**

Create `parent-app/lib/src/theme/theme_controller.dart`:

```dart
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/theme/theme_controller_test.dart`
Expected: PASS (4 cases)

- [ ] **Step 5: Add the dark palette + `buildDarkAppTheme()`**

Edit `parent-app/lib/src/theme/app_theme.dart` — append after the existing `buildAppTheme()`
function (keep every existing line above unchanged):

```dart
/// Same tokens as the staff console's `:root[data-theme='dark']` block
/// (staff-console/src/assets/base.css) — exact hex parity, not a re-derived palette.
class AppColorsDark {
  static const primary = Color(0xFFF1F5F9);
  static const accent = Color(0xFF4FC0F0);
  static const background = Color(0xFF0B1220);
  static const surface = Color(0xFF111A2C);
  static const text = Color(0xFFDCE4EE);
  static const muted = Color(0xFF8C9AB3);
  static const border = Color(0xFF233150);
  static const destructive = Color(0xFFF87171);
  static const present = Color(0xFF4ADE80);
  static const lateStatus = Color(0xFFFBBF24);
}

ThemeData buildDarkAppTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: AppColorsDark.accent,
    primary: AppColorsDark.accent,
    surface: AppColorsDark.surface,
    error: AppColorsDark.destructive,
    brightness: Brightness.dark,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColorsDark.background,
    textTheme: GoogleFonts.plusJakartaSansTextTheme(
      ThemeData(brightness: Brightness.dark).textTheme,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColorsDark.surface,
      foregroundColor: AppColorsDark.primary,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColorsDark.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColorsDark.border),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColorsDark.accent,
        foregroundColor: AppColorsDark.background,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColorsDark.surface,
      indicatorColor: AppColorsDark.accent.withValues(alpha: 0.12),
    ),
  );
}
```

- [ ] **Step 6: Wire `ThemeController` into `main.dart`**

Edit `parent-app/lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'src/api/api_client.dart';
import 'src/api/refreshing_http_client.dart';
import 'src/auth/auth_state.dart';
import 'src/auth/token_store.dart';
import 'src/notifications/device_token_registrar.dart';
import 'src/notifications/push_token_provider.dart';
import 'src/router/app_router.dart';
import 'src/theme/app_theme.dart';
import 'src/theme/theme_controller.dart';

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
  late final DeviceTokenRegistrar _deviceTokenRegistrar = DeviceTokenRegistrar(
    api: _api,
    tokenProvider: FirebaseMessagingTokenProvider(),
  );
  late final ThemeController _themeController = ThemeController();
  late final GoRouter _router = buildAppRouter(_auth);

  @override
  void initState() {
    super.initState();
    // Fire-and-forget: AuthState.notifyListeners() (via restoreSession) drives the router's
    // refreshListenable, so a restored session reroutes away from /login automatically.
    _auth.restoreSession();
    _themeController.restore();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: _api),
        ChangeNotifierProvider<AuthState>.value(value: _auth),
        Provider<DeviceTokenRegistrar>.value(value: _deviceTokenRegistrar),
        ChangeNotifierProvider<ThemeController>.value(value: _themeController),
      ],
      child: Consumer<ThemeController>(
        builder: (context, themeController, _) => MaterialApp.router(
          title: 'School OS',
          theme: buildAppTheme(),
          darkTheme: buildDarkAppTheme(),
          themeMode: themeController.mode,
          routerConfig: _router,
        ),
      ),
    );
  }
}
```

- [ ] **Step 7: Provide a `ThemeController` in the test harness**

Edit `parent-app/test/test_harness.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/auth/auth_state.dart';
import 'package:parent_app/src/auth/token_store.dart';
import 'package:parent_app/src/notifications/device_token_registrar.dart';
import 'package:parent_app/src/notifications/push_token_provider.dart';
import 'package:parent_app/src/router/app_router.dart';
import 'package:parent_app/src/theme/app_theme.dart';
import 'package:parent_app/src/theme/theme_controller.dart';

/// Builds the same provider/router tree as `ParentApp` (lib/main.dart), but with an injected
/// [ApiClient] and [TokenStore] instead of a real network client and platform secure storage —
/// neither of which is available in the widget-test environment. Also schoolos an empty
/// `shared_preferences` mock store, since FEAT-014's offline cache (`DataCache`) and
/// `ThemeController` both read/write it and would otherwise hang on the unmocked platform channel.
///
/// [deviceTokenRegistrar] defaults to a Noop-backed one so existing tests are unaffected; pass a
/// real one (built with a fake PushTokenProvider) only in the tests that specifically exercise
/// device-token registration or push-tap navigation. [themeController] defaults to a fresh,
/// unrestored controller (system mode) — pass one already set to a mode to test theme-dependent UI.
Widget buildTestApp({
  required ApiClient api,
  TokenStore? tokenStore,
  DeviceTokenRegistrar? deviceTokenRegistrar,
  ThemeController? themeController,
}) {
  SharedPreferences.setMockInitialValues({});
  final auth = AuthState(api: api, tokenStore: tokenStore ?? InMemoryTokenStore());
  final router = buildAppRouter(auth);
  final registrar =
      deviceTokenRegistrar ?? DeviceTokenRegistrar(api: api, tokenProvider: NoopPushTokenProvider());
  final theme = themeController ?? ThemeController();

  return MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: api),
      ChangeNotifierProvider<AuthState>.value(value: auth),
      Provider<DeviceTokenRegistrar>.value(value: registrar),
      ChangeNotifierProvider<ThemeController>.value(value: theme),
    ],
    child: Consumer<ThemeController>(
      builder: (context, themeController, _) => MaterialApp.router(
        theme: buildAppTheme(),
        darkTheme: buildDarkAppTheme(),
        themeMode: themeController.mode,
        routerConfig: router,
      ),
    ),
  );
}
```

- [ ] **Step 8: Run the full suite to confirm the harness change alone doesn't break anything**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: analyzer clean; all existing tests still pass (default `ThemeMode.system` renders
identically to the previous unconditional light theme on a test device with no dark-mode override).

- [ ] **Step 9: Write the failing `MoreTab` toggle test**

Create `parent-app/test/screens/more_tab_test.dart`:

```dart
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
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/more_tab_test.dart`
Expected: FAIL — `MoreTab` has no `activeChildId` parameter yet, and no `themeModeDropdown` key
exists.

- [ ] **Step 11: Add the appearance toggle to `MoreTab`**

Edit `parent-app/lib/src/screens/more_tab.dart` (the `activeChildId` parameter added here is also
what Task 3 threads into `LeaveScreen` — added now so this file only changes once):

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/theme_controller.dart';
import 'leave_screen.dart';

/// "More" bottom-nav tab (index 5) — a menu of screens that don't warrant their own tab, plus
/// account-wide settings (currently just appearance). Later additions (profile, …) are out of
/// scope here.
class MoreTab extends StatelessWidget {
  const MoreTab({
    super.key,
    required this.accessToken,
    required this.api,
    required this.children,
    this.activeChildId,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  /// The child currently selected in HomeShell's top switcher — threaded into LeaveScreen so its
  /// form defaults to the child the parent is actually looking at, not always the first one.
  final String? activeChildId;

  @override
  Widget build(BuildContext context) {
    final themeMode = context.watch<ThemeController>().mode;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            key: const Key('moreLeaveApplications'),
            leading: const Icon(Icons.event_busy_outlined),
            title: const Text('Leave Applications'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => LeaveScreen(accessToken: accessToken, api: api, children: children),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.dark_mode_outlined),
            title: const Text('Appearance'),
            trailing: DropdownButton<ThemeMode>(
              key: const Key('themeModeDropdown'),
              value: themeMode,
              items: const [
                DropdownMenuItem(value: ThemeMode.system, child: Text('System')),
                DropdownMenuItem(value: ThemeMode.light, child: Text('Light')),
                DropdownMenuItem(value: ThemeMode.dark, child: Text('Dark')),
              ],
              onChanged: (mode) {
                if (mode != null) context.read<ThemeController>().setMode(mode);
              },
            ),
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/more_tab_test.dart`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add parent-app/lib/src/theme/app_theme.dart parent-app/lib/src/theme/theme_controller.dart parent-app/lib/main.dart parent-app/test/test_harness.dart parent-app/lib/src/screens/more_tab.dart parent-app/test/theme/theme_controller_test.dart parent-app/test/screens/more_tab_test.dart
git commit -m "feat(parent-app): add dark theme, ThemeController, and an appearance toggle in More"
```

---

### Task 2: `HomeTab` — real Fees balance, grayed-out Results placeholder

**Files:**
- Modify: `parent-app/lib/src/screens/home_tab.dart`
- Modify: `parent-app/lib/src/api/api_client.dart` (none — `studentFees` already exists; no change)
- Test: Modify `parent-app/test/screens/home_tab_test.dart`

**Interfaces:**
- Consumes: `ApiClient.studentFees` (existing), `FeeVoucherSummary.amountDue` (existing field).

- [ ] **Step 1: Rewrite the test that currently asserts on the placeholder behavior**

The existing `'shows static placeholders for Fees and Results, not fabricated data'` test in
`parent-app/test/screens/home_tab_test.dart` asserts on exactly the two placeholders this task
removes — rewrite it, and add a `/fees` mock to `makeClient()` so the other tests exercise a real
value. Replace the whole file's content with:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/home_tab.dart';

void main() {
  ApiClient makeClient() {
    return ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/students/s1/attendance') {
          return http.Response(
            jsonEncode({
              'days': [],
              'summary': {
                'present': 18,
                'absent': 1,
                'late': 0,
                'holiday': 0,
                'leave': 0,
                'attendancePercentage': 93,
              },
            }),
            200,
          );
        }
        if (request.url.path == '/api/v1/students/s1/fees') {
          return http.Response(
            jsonEncode([
              {
                'id': 'v1',
                'studentId': 's1',
                'month': '2026-09',
                'dueDate': '2026-09-10',
                'items': [
                  {'label': 'Tuition Fee', 'amount': 500000},
                ],
                'totalAmount': 500000,
                'amountPaid': 0,
                'amountDue': 500000,
                'status': 'unpaid',
              },
              {
                'id': 'v2',
                'studentId': 's1',
                'month': '2026-08',
                'dueDate': '2026-08-10',
                'items': [
                  {'label': 'Tuition Fee', 'amount': 500000},
                ],
                'totalAmount': 500000,
                'amountPaid': 500000,
                'amountDue': 0,
                'status': 'paid',
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );
  }

  final sampleCirculars = [
    const CircularSummary(
      id: 'c1',
      title: 'Independence Day Holiday',
      description: 'School will remain closed on 14-Aug-2026.',
      scope: 'school',
      priority: 'normal',
      publishedAt: '2026-08-25T00:00:00.000Z',
      expiresAt: null,
      attachments: [],
      readAt: null,
    ),
    const CircularSummary(
      id: 'c2',
      title: 'Older notice',
      description: 'An older announcement.',
      scope: 'school',
      priority: 'normal',
      publishedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: null,
      attachments: [],
      readAt: null,
    ),
  ];

  testWidgets('shows the greeting, child card, attendance stat, and recent announcements', (
    tester,
  ) async {
    var timetableOpened = false;
    var seeAllTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeTab(
            studentId: 's1',
            childName: 'Zara Ahmed',
            childClass: 'Class 8A',
            accessToken: 'tok',
            api: makeClient(),
            circulars: sampleCirculars,
            onOpenTimetable: () => timetableOpened = true,
            onSeeAllAnnouncements: () => seeAllTapped = true,
            onOpenFees: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Assalam-o-Alaikum'), findsOneWidget);
    expect(find.text('Zara Ahmed'), findsOneWidget);
    expect(find.text('Class 8A'), findsOneWidget);
    expect(find.text('93%'), findsOneWidget);
    expect(find.text('Independence Day Holiday'), findsOneWidget);
    expect(find.text('Older notice'), findsOneWidget);

    await tester.tap(find.byKey(const Key('homeTimetableCard')));
    expect(timetableOpened, isTrue);

    await tester.tap(find.byKey(const Key('homeSeeAllAnnouncements')));
    expect(seeAllTapped, isTrue);
  });

  testWidgets(
    'shows the real outstanding balance on the Fees card and a grayed-out Results placeholder',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HomeTab(
              studentId: 's1',
              childName: 'Zara Ahmed',
              childClass: 'Class 8A',
              accessToken: 'tok',
              api: makeClient(),
              circulars: sampleCirculars,
              onOpenTimetable: () {},
              onSeeAllAnnouncements: () {},
              onOpenFees: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Only v1's 500000-paisa amountDue is outstanding (v2 is fully paid): PKR 5000.
      expect(find.text('PKR 5000'), findsOneWidget);
      expect(find.text('Coming soon'), findsOneWidget);
      expect(find.text('—'), findsNothing);
      expect(find.text('View latest results'), findsNothing);

      final opacity = tester.widget<Opacity>(
        find.descendant(of: find.byKey(const Key('homeResultsCard')), matching: find.byType(Opacity)),
      );
      expect(opacity.opacity, lessThan(1.0));
    },
  );

  testWidgets('shows a dash on the Fees card when the fees fetch fails, without blocking the rest', (
    tester,
  ) async {
    final failingClient = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response('nope', 404)),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeTab(
            studentId: 's1',
            childName: 'Zara Ahmed',
            childClass: 'Class 8A',
            accessToken: 'tok',
            api: failingClient,
            circulars: sampleCirculars,
            onOpenTimetable: () {},
            onSeeAllAnnouncements: () {},
            onOpenFees: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The rest of the screen still renders — greeting, child card, and announcements — even
    // though both the attendance and fees fetches failed; only their own stat cards are affected.
    expect(find.text('Assalam-o-Alaikum'), findsOneWidget);
    expect(find.text('Zara Ahmed'), findsOneWidget);
    expect(find.text('Independence Day Holiday'), findsOneWidget);
    expect(find.text('Unavailable'), findsOneWidget);
    expect(find.text('—'), findsOneWidget);
  });

  testWidgets('the stat grid does not overflow on a phone-sized viewport', (tester) async {
    final originalSize = tester.view.physicalSize;
    final originalDpr = tester.view.devicePixelRatio;
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 3;
    addTearDown(() {
      tester.view.physicalSize = originalSize;
      tester.view.devicePixelRatio = originalDpr;
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeTab(
            studentId: 's1',
            childName: 'Zara Ahmed',
            childClass: 'Class 8A',
            accessToken: 'tok',
            api: makeClient(),
            circulars: sampleCirculars,
            onOpenTimetable: () {},
            onSeeAllAnnouncements: () {},
            onOpenFees: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/home_tab_test.dart`
Expected: FAIL — `HomeTab` doesn't fetch fees yet, so the Fees card still shows `'—'` and the
Results card is still full-opacity with no `Opacity` ancestor.

- [ ] **Step 3: Implement the real Fees balance and the grayed Results card**

Edit `parent-app/lib/src/screens/home_tab.dart` — replace the whole file's content with:

```dart
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/text_direction.dart';

/// Home tab (bottom-nav index 0) — greeting, active-child summary, a 2x2 stat/quick-link grid,
/// and the most recent announcements. Fetches its own attendance/fees data (the same
/// self-contained pattern `CalendarTab` and `CircularsTab` use); circulars are passed down from
/// `HomeShell`, which already fetches them for the Notifications bottom-nav badge — avoids a
/// redundant parent-scoped fetch every time the active child changes.
class HomeTab extends StatefulWidget {
  const HomeTab({
    super.key,
    required this.studentId,
    required this.childName,
    required this.childClass,
    required this.accessToken,
    required this.api,
    required this.circulars,
    required this.onOpenTimetable,
    required this.onSeeAllAnnouncements,
    required this.onOpenFees,
  });

  final String studentId;
  final String childName;
  final String childClass;
  final String accessToken;
  final ApiClient api;
  final List<CircularSummary> circulars;
  final VoidCallback onOpenTimetable;
  final VoidCallback onSeeAllAnnouncements;
  final VoidCallback onOpenFees;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  AttendanceReport? _attendance;
  String? _attendanceError;
  List<FeeVoucherSummary>? _vouchers;
  String? _feesError;

  @override
  void initState() {
    super.initState();
    _loadAttendance();
    _loadFees();
  }

  Future<void> _loadAttendance() async {
    final month = DateTime.now().toIso8601String().substring(0, 7);
    try {
      final attendance = await widget.api.attendance(widget.accessToken, widget.studentId, month);
      if (mounted) setState(() => _attendance = attendance);
    } on ApiException catch (e) {
      if (mounted) setState(() => _attendanceError = e.message);
    }
  }

  Future<void> _loadFees() async {
    try {
      final vouchers = await widget.api.studentFees(widget.accessToken, widget.studentId);
      if (mounted) setState(() => _vouchers = vouchers);
    } on ApiException catch (e) {
      if (mounted) setState(() => _feesError = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final recentAnnouncements = [...widget.circulars]
      ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    final topAnnouncements = recentAnnouncements.take(2).toList();

    final attendanceValue = _attendance != null
        ? '${_attendance!.summary.attendancePercentage}%'
        : (_attendanceError != null ? '—' : '…');
    final attendanceHint = _attendanceError != null ? 'Unavailable' : 'This Month';

    final vouchers = _vouchers;
    final feesValue = vouchers != null
        ? 'PKR ${(vouchers.fold<int>(0, (sum, v) => sum + v.amountDue) / 100).toStringAsFixed(0)}'
        : (_feesError != null ? '—' : '…');
    final feesHint = _feesError != null ? 'Unavailable' : 'Outstanding';

    // A SingleChildScrollView + Column (rather than ListView) so every child — including the
    // 2x2 stat grid and the announcements below it — is built eagerly. A ListView's SliverList
    // estimates offscreen extents from already-laid-out siblings, and the tall GridView ahead of
    // the announcements section made it under-estimate and stop building children that are well
    // within the default 250px cache extent.
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Assalam-o-Alaikum', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const CircleAvatar(child: Icon(Icons.person_outline)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.childName, style: Theme.of(context).textTheme.titleSmall),
                        Text(widget.childClass, style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          GridView(
            // A fixed mainAxisExtent (not childAspectRatio) so each cell's height doesn't scale
            // with the device's width — an aspect-ratio-derived height fits a wide test/desktop
            // viewport but overflows real phone widths, where each cell is much narrower.
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              mainAxisExtent: 136,
            ),
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              _StatCard(
                key: const Key('homeAttendanceCard'),
                label: 'Attendance',
                value: attendanceValue,
                hint: attendanceHint,
              ),
              _StatCard(
                key: const Key('homeFeesCard'),
                label: 'Fees',
                value: feesValue,
                hint: feesHint,
                onTap: widget.onOpenFees,
              ),
              const _StatCard(
                key: Key('homeResultsCard'),
                label: 'Results',
                value: 'Coming soon',
                muted: true,
              ),
              _StatCard(
                key: const Key('homeTimetableCard'),
                label: 'Timetable',
                value: 'View timetable',
                onTap: widget.onOpenTimetable,
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Recent Announcements',
                  style: Theme.of(context).textTheme.titleSmall,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton(
                key: const Key('homeSeeAllAnnouncements'),
                onPressed: widget.onSeeAllAnnouncements,
                child: const Text('See All'),
              ),
            ],
          ),
          if (topAnnouncements.isEmpty) const Text('No announcements yet.'),
          for (final c in topAnnouncements)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: DirectionalText(c.title),
                subtitle: DirectionalText(c.description),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    super.key,
    required this.label,
    required this.value,
    this.hint,
    this.onTap,
    this.muted = false,
  });

  final String label;
  final String value;
  final String? hint;
  final VoidCallback? onTap;

  /// Report cards (the Results feature this card links to) aren't built yet (roadmap Sprint I) —
  /// muted keeps the card visible as a preview of what's coming, per the roadmap's "hide/gray"
  /// instruction, rather than fabricating a number or removing the card outright.
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Opacity(
      opacity: muted ? 0.5 : 1,
      child: Card(
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(label, style: theme.textTheme.bodySmall),
                const SizedBox(height: 4),
                Text(value, style: theme.textTheme.titleMedium),
                if (hint != null) Text(hint!, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/home_tab_test.dart`
Expected: PASS (4 cases)

- [ ] **Step 5: Run the `home_shell_test.dart` integration tests too**

Run: `cd parent-app && flutter test test/screens/home_shell_test.dart`
Expected: PASS — its `makeHomeIntegrationClient()` mock has no `/fees` route, so `HomeTab`'s new
fees fetch there 404s and `_feesError` is set; no existing assertion in that file checks the Fees
card's value, so this is silent and harmless (matches the attendance card's pre-existing behavior
under the same mock).

- [ ] **Step 6: Commit**

```bash
git add parent-app/lib/src/screens/home_tab.dart parent-app/test/screens/home_tab_test.dart
git commit -m "feat(parent-app): show a real Fees balance and gray out the not-yet-built Results card"
```

---

### Task 3: Thread `activeChildId` into `LeaveScreen`

**Files:**
- Modify: `parent-app/lib/src/screens/leave_screen.dart`
- Modify: `parent-app/lib/src/screens/more_tab.dart`
- Test: Modify `parent-app/test/screens/leave_screen_test.dart`

**Interfaces:**
- Consumes: `MoreTab.activeChildId` (Task 1 added this field to `MoreTab`'s constructor but did not
  yet forward it anywhere — `MoreTab`'s `LeaveScreen(...)` call still omitted it, since
  `LeaveScreen` had no such parameter yet. This task adds the parameter to `LeaveScreen` and is the
  one that wires `MoreTab`'s call site to actually pass it — keeps Task 1 compiling standalone.

- [ ] **Step 1: Write the failing test**

Edit `parent-app/test/screens/leave_screen_test.dart` — add a second child constant and a new test
case after the existing one:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/leave_screen.dart';

const _child = ChildSummary(
  id: 'child-1',
  name: 'Eshaal Sample',
  grNumber: 'GR-1001',
  campus: 'Gulistan-e-Jauhar',
  schoolClass: 'Grade 3',
  section: '3A',
);

const _secondChild = ChildSummary(
  id: 'child-2',
  name: 'Ahmed Sample',
  grNumber: 'GR-2002',
  campus: 'Gulshan-e-Iqbal',
  schoolClass: 'Grade 6',
  section: '6B',
);

void main() {
  testWidgets('submits a leave request and shows it in the past-requests list', (tester) async {
    var submitted = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/leave-requests') {
          return http.Response(
            jsonEncode(
              submitted
                  ? [
                      {
                        'id': 'lr-1',
                        'studentId': 'child-1',
                        'startDate': '2026-09-05',
                        'endDate': '2026-09-06',
                        'reason': 'Family trip',
                        'status': 'pending',
                      },
                    ]
                  : [],
            ),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/leave-requests') {
          submitted = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: LeaveScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No leave requests yet.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('leaveStartDateButton')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('leaveEndDateButton')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('leaveReasonField')), 'Family trip');
    await tester.tap(find.byKey(const Key('leaveSubmitButton')));
    await tester.pumpAndSettle();

    expect(find.text('Leave request submitted.'), findsOneWidget);
    expect(find.text('Family trip'), findsWidgets);
  });

  testWidgets('defaults to the actively-selected child, not always the first one', (tester) async {
    String? requestedStudentId;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' &&
            request.url.path.startsWith('/api/v1/students/') &&
            request.url.path.endsWith('/leave-requests')) {
          requestedStudentId = request.url.pathSegments[2];
          return http.Response(jsonEncode(<dynamic>[]), 200);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: LeaveScreen(
          accessToken: 'tok',
          api: api,
          children: const [_child, _secondChild],
          initialChildId: 'child-2',
        ),
      ),
    );
    await tester.pumpAndSettle();

    // child-2 (Ahmed) is the active child, not children.first (child-1 / Eshaal).
    expect(requestedStudentId, 'child-2');
    expect(find.text('Ahmed Sample'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/leave_screen_test.dart`
Expected: FAIL — `LeaveScreen` has no `initialChildId` parameter yet, so it always defaults to
`children.first.id` (`child-1`).

- [ ] **Step 3: Implement the default-child fix**

Edit `parent-app/lib/src/screens/leave_screen.dart` — change the constructor and the
`_selectedChildId` initializer only (every other line stays the same):

```dart
class LeaveScreen extends StatefulWidget {
  const LeaveScreen({
    super.key,
    required this.accessToken,
    required this.api,
    required this.children,
    this.initialChildId,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  /// The child currently selected in HomeShell's top switcher, if any (null when LeaveScreen is
  /// reached from a context with no active-child concept). Falls back to children.first when null
  /// or when it doesn't match any child actually passed in.
  final String? initialChildId;

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  late String _selectedChildId = widget.children.any((c) => c.id == widget.initialChildId)
      ? widget.initialChildId!
      : widget.children.first.id;
```

(Every method below `_selectedChildId`'s declaration — `_loadRequests`, `_pickDate`, `_submit`,
`build`, etc. — is unchanged.)

- [ ] **Step 4: Wire `MoreTab`'s call site to actually pass the field it already receives**

Edit `parent-app/lib/src/screens/more_tab.dart` — `MoreTab` has carried an `activeChildId` field
since Task 1, but its `LeaveScreen(...)` call didn't forward it yet (there was nowhere to forward
it to, before this task's Step 3). Change just the `onTap` callback inside the "Leave Applications"
`ListTile`:

```dart
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => LeaveScreen(
                  accessToken: accessToken,
                  api: api,
                  children: children,
                  initialChildId: activeChildId,
                ),
              ),
            ),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/leave_screen_test.dart test/screens/more_tab_test.dart`
Expected: PASS (2 cases in `leave_screen_test.dart`, 1 in `more_tab_test.dart`)

- [ ] **Step 6: Commit**

```bash
git add parent-app/lib/src/screens/leave_screen.dart parent-app/lib/src/screens/more_tab.dart parent-app/test/screens/leave_screen_test.dart
git commit -m "fix(parent-app): LeaveScreen defaults to the actively-selected child, not children.first"
```

---

### Task 4: Thread `activeChildId` into Messages-compose

**Files:**
- Modify: `parent-app/lib/src/screens/messages_tab.dart`
- Modify: `parent-app/lib/src/screens/home_shell.dart`
- Test: Modify `parent-app/test/screens/messages_tab_test.dart`

**Interfaces:**
- Produces: `MessagesTab.activeChildId` — consumed by `HomeShell` (Step 3 below).

- [ ] **Step 1: Write the failing test**

Edit `parent-app/test/screens/messages_tab_test.dart` — add a second child to the existing
`children` list and a new test case at the end of `main()`:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/messages_tab.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  const children = [
    ChildSummary(
      id: 's1',
      name: 'Eshaal',
      grNumber: 'GR-1001',
      campus: 'Gulistan-e-Jauhar',
      schoolClass: 'Grade 3',
      section: '3A',
    ),
    ChildSummary(
      id: 's2',
      name: 'Ahmed',
      grNumber: 'GR-2002',
      campus: 'Gulshan-e-Iqbal',
      schoolClass: 'Grade 6',
      section: '6B',
    ),
  ];

  testWidgets('lists conversations, opens a thread, and starts a new one', (tester) async {
    var conversationStarted = false;
    var replySent = false;
    String? startedForStudentId;

    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations') {
          return http.Response(
            jsonEncode(
              conversationStarted
                  ? [
                      {
                        'id': 'conv-1',
                        'recipientType': 'CLASS_TEACHER',
                        'studentId': 's1',
                        'otherPartyName': 'Ms. Sample Teacher',
                        'lastMessageAt': '2026-08-29T00:00:00.000Z',
                        'unread': false,
                      },
                    ]
                  : [],
            ),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations') {
          conversationStarted = true;
          startedForStudentId = (jsonDecode(request.body) as Map<String, dynamic>)['studentId'] as String?;
          return http.Response(jsonEncode({'id': 'conv-1'}), 201);
        }
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations/conv-1') {
          return http.Response(
            jsonEncode({
              'id': 'conv-1',
              'recipientType': 'CLASS_TEACHER',
              'studentId': 's1',
              'messages': [
                {
                  'id': 'm1',
                  'senderId': 'parent-1',
                  'senderName': 'Parent A',
                  'body': 'Can Eshaal get extra homework?',
                  'createdAt': '2026-08-29T00:00:00.000Z',
                },
                if (replySent)
                  {
                    'id': 'm2',
                    'senderId': 'teacher-1',
                    'senderName': 'Ms. Sample Teacher',
                    'body': 'Sure thing.',
                    'createdAt': '2026-08-29T01:00:00.000Z',
                  },
              ],
            }),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations/conv-1/read') {
          return http.Response('', 201);
        }
        if (request.method == 'POST' &&
            request.url.path == '/api/v1/conversations/conv-1/messages') {
          replySent = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MessagesTab(accessToken: 'tok', api: api, children: children, activeChildId: 's1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No messages yet.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('newConversation')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('bodyField')), 'Can Eshaal get extra homework?');
    await tester.tap(find.byKey(const Key('sendButton')));
    await tester.pumpAndSettle();

    expect(startedForStudentId, 's1');
    expect(find.text('Ms. Sample Teacher'), findsOneWidget);

    await tester.tap(find.text('Ms. Sample Teacher'));
    await tester.pumpAndSettle();

    expect(find.text('Can Eshaal get extra homework?'), findsOneWidget);
    // Sender name shown above the message body — 'Ms. Sample Teacher' also appears in the
    // conversation list above, so only assert the sender-only 'Parent A' label here.
    expect(find.text('Parent A'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('replyField')), 'Any update?');
    await tester.tap(find.byKey(const Key('sendReplyButton')));
    await tester.pumpAndSettle();

    expect(find.text('Sure thing.'), findsOneWidget);
  });

  testWidgets('initialConversationId opens straight to that thread, skipping the list', (
    tester,
  ) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations') {
          return http.Response(
            jsonEncode([
              {
                'id': 'conv-1',
                'recipientType': 'CLASS_TEACHER',
                'studentId': 's1',
                'otherPartyName': 'Ms. Sample Teacher',
                'lastMessageAt': '2026-08-29T00:00:00.000Z',
                'unread': true,
              },
            ]),
            200,
          );
        }
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations/conv-1') {
          return http.Response(
            jsonEncode({
              'id': 'conv-1',
              'recipientType': 'CLASS_TEACHER',
              'studentId': 's1',
              'messages': [
                {
                  'id': 'm1',
                  'senderId': 'teacher-1',
                  'senderName': 'Ms. Sample Teacher',
                  'body': 'Reminder: bring your workbook tomorrow.',
                  'createdAt': '2026-08-29T00:00:00.000Z',
                },
              ],
            }),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations/conv-1/read') {
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MessagesTab(
            accessToken: 'tok',
            api: api,
            children: children,
            activeChildId: 's1',
            initialConversationId: 'conv-1',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Lands directly on the thread — the conversation list ("No messages yet." / the FAB) never
    // shows.
    expect(find.text('Reminder: bring your workbook tomorrow.'), findsOneWidget);
    expect(find.byKey(const Key('newConversation')), findsNothing);
  });

  testWidgets('compose defaults the child picker to the actively-selected child, not children.first', (
    tester,
  ) async {
    String? startedForStudentId;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations') {
          return http.Response(jsonEncode(<dynamic>[]), 200);
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations') {
          startedForStudentId = (jsonDecode(request.body) as Map<String, dynamic>)['studentId'] as String?;
          return http.Response(jsonEncode({'id': 'conv-1'}), 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          // Ahmed (s2) is the active child — the second entry in `children`, not the first.
          body: MessagesTab(accessToken: 'tok', api: api, children: children, activeChildId: 's2'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('newConversation')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('bodyField')), 'About Ahmed');
    await tester.tap(find.byKey(const Key('sendButton')));
    await tester.pumpAndSettle();

    expect(startedForStudentId, 's2');
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/messages_tab_test.dart`
Expected: FAIL — `MessagesTab` has no `activeChildId` parameter yet.

- [ ] **Step 3: Implement the threading**

Edit `parent-app/lib/src/screens/messages_tab.dart` — the changes are limited to `MessagesTab`'s
constructor/fields, `_ComposeView`'s construction inside `MessagesTab.build()`, and
`_ComposeView`'s own constructor/`initState`. Apply these targeted edits (everything else in the
file — `_ThreadView`, `formatMessageTime`, `recipientLabel`, `_buildList`'s body — is unchanged):

```dart
class MessagesTab extends StatefulWidget {
  const MessagesTab({
    super.key,
    required this.accessToken,
    required this.api,
    required this.children,
    required this.activeChildId,
    this.initialConversationId,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  /// The child currently selected in HomeShell's top switcher — the compose flow defaults its
  /// "About which child?" picker to this instead of always children.first.
  final String? activeChildId;

  /// Set when this tab is opened from a `type: 'message'` notification — opens straight to that
  /// conversation's thread instead of the list, so the reader doesn't have to hunt for it.
  final String? initialConversationId;

  @override
  State<MessagesTab> createState() => _MessagesTabState();
}
```

In `_MessagesTabState.build()`'s `case _MessagesView.compose:` branch, add the new field to the
`_ComposeView` construction:

```dart
      case _MessagesView.compose:
        return _ComposeView(
          accessToken: widget.accessToken,
          api: widget.api,
          children: widget.children,
          activeChildId: widget.activeChildId,
          onCancel: () => setState(() => _view = _MessagesView.list),
          onSent: () {
            setState(() => _view = _MessagesView.list);
            _loadList();
          },
        );
```

`_ComposeView`'s constructor and `initState`:

```dart
class _ComposeView extends StatefulWidget {
  const _ComposeView({
    required this.accessToken,
    required this.api,
    required this.children,
    required this.activeChildId,
    required this.onCancel,
    required this.onSent,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;
  final String? activeChildId;
  final VoidCallback onCancel;
  final VoidCallback onSent;

  @override
  State<_ComposeView> createState() => _ComposeViewState();
}

class _ComposeViewState extends State<_ComposeView> {
  String _recipientType = 'CLASS_TEACHER';
  String? _studentId;
  final _bodyController = TextEditingController();
  bool _isSending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final activeChildIsInList =
        widget.children.any((c) => c.id == widget.activeChildId);
    _studentId = activeChildIsInList
        ? widget.activeChildId
        : (widget.children.isNotEmpty ? widget.children.first.id : null);
  }
```

- [ ] **Step 4: Wire `HomeShell` to pass its active child through**

Edit `parent-app/lib/src/screens/home_shell.dart` — at the `_tabIndex == 3` branch (the
`MessagesTab` construction), add `activeChildId: _activeChildId,`:

```dart
    if (_tabIndex == 3) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return MessagesTab(
        // Keyed on the requested conversation id so a fresh notification tap (or a change from
        // one conversation to another) forces a new element — same reasoning as CalendarTab's
        // key above: without this, Flutter would reuse the existing MessagesTab element and
        // silently ignore the new initialConversationId.
        key: ValueKey('messages_${_messagesInitialConversationId ?? 'list'}'),
        accessToken: auth.accessToken!,
        api: api,
        children: _children,
        activeChildId: _activeChildId,
        initialConversationId: _messagesInitialConversationId,
      );
    }
```

Also update the `_tabIndex == 5` branch (`MoreTab`) to pass the same field, since Task 1 already
added `activeChildId` to `MoreTab`'s constructor:

```dart
    if (_tabIndex == 5) {
      return MoreTab(
        accessToken: context.read<AuthState>().accessToken!,
        api: context.read<ApiClient>(),
        children: _children,
        activeChildId: _activeChildId,
      );
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/messages_tab_test.dart`
Expected: PASS (3 cases)

- [ ] **Step 6: Run the full suite to confirm `HomeShell`'s wiring compiles and nothing regressed**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: analyzer clean, full suite passing (the `home_shell_test.dart` tests that reach
`MoreTab`/`MessagesTab` continue to pass since `_activeChildId` was already tracked there before
this task — only the constructor plumbing is new).

- [ ] **Step 7: Commit**

```bash
git add parent-app/lib/src/screens/messages_tab.dart parent-app/lib/src/screens/home_shell.dart parent-app/test/screens/messages_tab_test.dart
git commit -m "fix(parent-app): Messages-compose defaults to the actively-selected child, not children.first"
```

---

### Task 5: Rename the "Notifications" bottom-nav tab to "Circulars"

**Files:**
- Modify: `parent-app/lib/src/screens/home_shell.dart`
- Test: Modify `parent-app/test/screens/home_shell_test.dart`

**Interfaces:** None — this is a label-only change; the bell icon's "Notifications" tooltip
(separate feature) is untouched.

- [ ] **Step 1: Update the one test that taps the old label**

Edit `parent-app/test/screens/home_shell_test.dart` — in the `'the Notifications tab shows a badge
for unread circulars'` test, change:

```dart
    await tester.tap(find.text('Notifications'));
```

to:

```dart
    await tester.tap(find.text('Circulars'));
```

(This is the only `find.text('Notifications')` reference in the test suite — confirmed via a
project-wide search before writing this plan.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/home_shell_test.dart -N "the Notifications tab shows a badge for unread circulars"`
Expected: FAIL — no widget with text `'Circulars'` exists yet; the bottom-nav destination still
says "Notifications".

- [ ] **Step 3: Rename the label**

Edit `parent-app/lib/src/screens/home_shell.dart` — two occurrences, both plain string literals (do
**not** touch line ~208's `tooltip: 'Notifications'` on the AppBar bell `IconButton` — that's the
unrelated bell feature):

Change the `NavigationDestination` at bottom-nav index 2:

```dart
          NavigationDestination(
            icon: _unreadCirculars > 0
                ? Badge(label: Text('$_unreadCirculars'), child: const Icon(Icons.notifications_none))
                : const Icon(Icons.notifications_none),
            label: 'Circulars',
          ),
```

And the fallback-text `labels` array near the bottom of `_buildBody()`:

```dart
    final labels = ['Home', 'Calendar', 'Circulars', 'Messages', 'Fees', 'More'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/home_shell_test.dart`
Expected: PASS — full file (13 cases as of this task, after Tasks 1-4's additions).

- [ ] **Step 5: Commit**

```bash
git add parent-app/lib/src/screens/home_shell.dart parent-app/test/screens/home_shell_test.dart
git commit -m "fix(parent-app): rename the Circulars bottom-nav tab, no longer colliding with the notification bell"
```

---

### Task 6: Extend offline caching to `FeesTab`

**Files:**
- Modify: `parent-app/lib/src/api/models.dart`
- Modify: `parent-app/lib/src/screens/fees_tab.dart`
- Test: Modify `parent-app/test/screens/fees_tab_test.dart`

**Interfaces:**
- Produces: `FeeVoucherItem.toJson()`, `FeeVoucherSummary.toJson()` — consumed by
  `loadWithCache`'s `toJson` param.

- [ ] **Step 1: Add `toJson()` to the fee-voucher models**

Edit `parent-app/lib/src/api/models.dart` — add a `toJson()` method to each class (insert right
after each existing `fromJson` factory; nothing else in these two classes changes):

```dart
class FeeVoucherItem {
  const FeeVoucherItem({required this.label, required this.amount});
  final String label;
  final int amount;

  factory FeeVoucherItem.fromJson(Map<String, dynamic> json) => FeeVoucherItem(
    label: json['label'] as String,
    amount: json['amount'] as int,
  );

  Map<String, dynamic> toJson() => {'label': label, 'amount': amount};
}

class FeeVoucherSummary {
  const FeeVoucherSummary({
    required this.id,
    required this.studentId,
    required this.month,
    required this.dueDate,
    required this.items,
    required this.totalAmount,
    required this.amountPaid,
    required this.amountDue,
    required this.status,
  });

  final String id;
  final String studentId;
  final String month;
  final String dueDate;
  final List<FeeVoucherItem> items;
  final int totalAmount;
  final int amountPaid;
  final int amountDue;
  final String status;

  factory FeeVoucherSummary.fromJson(Map<String, dynamic> json) =>
      FeeVoucherSummary(
        id: json['id'] as String,
        studentId: json['studentId'] as String,
        month: json['month'] as String,
        dueDate: json['dueDate'] as String,
        items: (json['items'] as List<dynamic>)
            .map((e) => FeeVoucherItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        totalAmount: json['totalAmount'] as int,
        amountPaid: json['amountPaid'] as int,
        amountDue: json['amountDue'] as int,
        status: json['status'] as String,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'studentId': studentId,
    'month': month,
    'dueDate': dueDate,
    'items': items.map((i) => i.toJson()).toList(),
    'totalAmount': totalAmount,
    'amountPaid': amountPaid,
    'amountDue': amountDue,
    'status': status,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Edit `parent-app/test/screens/fees_tab_test.dart` — add `SharedPreferences` setup and a new
stale-cache test:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/fees_tab.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('lists vouchers with status and payment history with a receipt link', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/fees') {
          return http.Response(
            jsonEncode([
              {
                'id': 'v1',
                'studentId': 'child-1',
                'month': '2026-09',
                'dueDate': '2026-09-10',
                'items': [
                  {'label': 'Tuition Fee', 'amount': 500000},
                ],
                'totalAmount': 500000,
                'amountPaid': 0,
                'amountDue': 500000,
                'status': 'unpaid',
              },
            ]),
            200,
          );
        }
        if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/fees/payments') {
          return http.Response(
            jsonEncode([
              {
                'id': 'p1',
                'amount': 500000,
                'method': 'jazzcash',
                'status': 'completed',
                'voucherIds': ['v0'],
                'receiptId': 'r1',
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(home: FeesTab(studentId: 'child-1', accessToken: 'tok', api: api)),
    );
    await tester.pumpAndSettle();

    expect(find.text('2026-09'), findsOneWidget);
    expect(find.text('unpaid'), findsOneWidget);
    expect(find.text('completed'), findsOneWidget);
    expect(find.byIcon(Icons.receipt_long_outlined), findsOneWidget);
    expect(find.textContaining('Last updated'), findsOneWidget);
  });

  testWidgets(
    'completing a payment from the voucher detail screen returns all the way to FeesTab with '
    'refreshed data, not a stale voucher detail screen',
    (tester) async {
      var feesCallCount = 0;

      final api = ApiClient(
        baseUrl: 'http://test',
        client: MockClient((request) async {
          if (request.method == 'GET' && request.url.path == '/api/v1/students/child-1/fees') {
            feesCallCount++;
            // First load (pre-payment): v1 is unpaid with 500000 due. After the payment flow
            // completes and FeesTab reloads, the same voucher now comes back fully paid — proving
            // the screen the user lands on reflects fresh data, not what was shown pre-payment.
            final isPaid = feesCallCount > 1;
            return http.Response(
              jsonEncode([
                {
                  'id': 'v1',
                  'studentId': 'child-1',
                  'month': '2026-09',
                  'dueDate': '2026-09-10',
                  'items': [
                    {'label': 'Tuition Fee', 'amount': 500000},
                  ],
                  'totalAmount': 500000,
                  'amountPaid': isPaid ? 500000 : 0,
                  'amountDue': isPaid ? 0 : 500000,
                  'status': isPaid ? 'paid' : 'unpaid',
                },
              ]),
              200,
            );
          }
          if (request.method == 'GET' &&
              request.url.path == '/api/v1/students/child-1/fees/payments') {
            return http.Response(jsonEncode(<dynamic>[]), 200);
          }
          if (request.method == 'POST' && request.url.path == '/api/v1/fee-vouchers/v1/pay') {
            return http.Response(
              jsonEncode({'redirectUrl': '/pay/stub-checkout?ref=x', 'paymentId': 'p1'}),
              201,
            );
          }
          if (request.method == 'POST' && request.url.path == '/api/v1/payments/webhook/stub') {
            return http.Response(jsonEncode({'received': true}), 200);
          }
          if (request.method == 'GET' && request.url.path == '/api/v1/fee-payments/p1') {
            return http.Response(
              jsonEncode({
                'id': 'p1',
                'amount': 500000,
                'method': 'jazzcash',
                'status': 'completed',
                'voucherIds': ['v1'],
                'receiptId': 'r1',
              }),
              200,
            );
          }
          return http.Response('not found', 404);
        }),
      );

      await tester.pumpWidget(
        MaterialApp(home: FeesTab(studentId: 'child-1', accessToken: 'tok', api: api)),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('voucher_v1')));
      await tester.pumpAndSettle();
      expect(find.text('Voucher — 2026-09'), findsOneWidget);

      await tester.tap(find.byKey(const Key('payNowButton')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('completePaymentButton')));
      await tester.pumpAndSettle();
      expect(find.text('Payment completed.'), findsOneWidget);

      await tester.tap(find.byKey(const Key('checkoutDoneButton')));
      await tester.pumpAndSettle();

      // Landed back on FeesTab (not lingering on the stale voucher detail screen), and the
      // voucher list reflects the fresh, post-payment fetch.
      expect(find.text('Voucher — 2026-09'), findsNothing);
      expect(find.text('paid'), findsOneWidget);
      expect(find.text('unpaid'), findsNothing);
    },
  );

  testWidgets(
    'falls back to cached vouchers with a Last updated timestamp when the live fetch fails',
    (tester) async {
      final cachedAt = DateTime.now().subtract(const Duration(hours: 2));
      SharedPreferences.setMockInitialValues({
        'cache:fees:child-1': jsonEncode({
          'fetchedAt': cachedAt.toIso8601String(),
          'data': [
            {
              'id': 'v1',
              'studentId': 'child-1',
              'month': '2026-09',
              'dueDate': '2026-09-10',
              'items': [
                {'label': 'Tuition Fee', 'amount': 500000},
              ],
              'totalAmount': 500000,
              'amountPaid': 0,
              'amountDue': 500000,
              'status': 'unpaid',
            },
          ],
        }),
      });
      final api = ApiClient(
        baseUrl: 'http://test',
        client: MockClient((request) async => http.Response('server down', 500)),
      );

      await tester.pumpWidget(
        MaterialApp(home: FeesTab(studentId: 'child-1', accessToken: 'tok', api: api)),
      );
      await tester.pumpAndSettle();

      expect(find.text('2026-09'), findsOneWidget);
      expect(find.textContaining('Last updated'), findsOneWidget);
      expect(find.textContaining('offline'), findsOneWidget);
    },
  );
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/fees_tab_test.dart`
Expected: FAIL — no `LastUpdatedBanner` renders yet, and the new stale-cache test finds no
`'2026-09'` text (the live 500 error currently just shows a bare error message, no cache fallback).

- [ ] **Step 4: Implement caching in `FeesTab`**

Edit `parent-app/lib/src/screens/fees_tab.dart` — replace the whole file's content with:

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../cache/cached_load.dart';
import '../cache/data_cache.dart';
import '../cache/last_updated_banner.dart';
import 'voucher_detail_screen.dart';

/// Fees bottom-nav tab (index 4): outstanding vouchers (tap for the itemized breakdown, PDF, and
/// Pay Now) plus payment history with a receipt download for each completed payment. The voucher
/// list is cached per-student (the offline-critical content, same as CircularsTab's single list);
/// payment history is a secondary, live-only fetch that degrades to empty on failure rather than
/// blocking the voucher list from rendering.
class FeesTab extends StatefulWidget {
  const FeesTab({super.key, required this.studentId, required this.accessToken, required this.api});

  final String studentId;
  final String accessToken;
  final ApiClient api;

  @override
  State<FeesTab> createState() => _FeesTabState();
}

class _FeesTabState extends State<FeesTab> {
  List<FeeVoucherSummary>? _vouchers;
  List<FeePaymentSummary>? _payments;
  String? _error;
  DateTime? _lastUpdated;
  bool _stale = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final cache = await DataCache.open();
    await loadWithCache<List<FeeVoucherSummary>>(
      cache: cache,
      cacheKey: 'cache:fees:${widget.studentId}',
      fetch: () => widget.api.studentFees(widget.accessToken, widget.studentId),
      toJson: (vouchers) => vouchers.map((v) => v.toJson()).toList(),
      fromJson: (json) => (json as List<dynamic>)
          .map((e) => FeeVoucherSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      onData: (data, lastUpdated, {required stale}) {
        if (mounted) {
          setState(() {
            _vouchers = data;
            _lastUpdated = lastUpdated;
            _stale = stale;
            _error = null;
          });
        }
      },
      onError: (message) {
        if (mounted) setState(() => _error = message);
      },
    );
    await _loadPayments();
  }

  Future<void> _loadPayments() async {
    try {
      final payments = await widget.api.studentFeePayments(widget.accessToken, widget.studentId);
      if (mounted) setState(() => _payments = payments);
    } on ApiException catch (_) {
      // Payment history is secondary — the voucher list above is the offline-critical content.
    }
  }

  Future<void> _openVoucher(FeeVoucherSummary voucher) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            VoucherDetailScreen(voucher: voucher, accessToken: widget.accessToken, api: widget.api),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    final vouchers = _vouchers;
    if (vouchers == null) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
        const SizedBox(height: 12),
        Text('Fee Vouchers', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (vouchers.isEmpty) const Text('No fee vouchers yet.'),
        for (final v in vouchers)
          Card(
            child: ListTile(
              key: Key('voucher_${v.id}'),
              title: Text(v.month),
              subtitle: Text('Due ${v.dueDate}'),
              trailing: Chip(label: Text(v.status)),
              onTap: () => _openVoucher(v),
            ),
          ),
        const SizedBox(height: 24),
        Text('Payment History', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (_payments == null)
          const Center(child: CircularProgressIndicator())
        else if (_payments!.isEmpty)
          const Text('No payments yet.')
        else
          for (final p in _payments!)
            Card(
              child: ListTile(
                title: Text('PKR ${(p.amount / 100).toStringAsFixed(2)}'),
                subtitle: Text(p.status),
                trailing: p.receiptId == null
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.receipt_long_outlined),
                        onPressed: () => launchUrl(
                          widget.api.receiptPdfUrl(p.id, widget.accessToken),
                          mode: LaunchMode.externalApplication,
                        ),
                      ),
              ),
            ),
      ],
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/fees_tab_test.dart`
Expected: PASS (3 cases)

- [ ] **Step 6: Run the full suite (the payment-flow integration test exercises `_load()`'s new cache-then-payments sequencing end to end)**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: analyzer clean, full suite passing.

- [ ] **Step 7: Commit**

```bash
git add parent-app/lib/src/api/models.dart parent-app/lib/src/screens/fees_tab.dart parent-app/test/screens/fees_tab_test.dart
git commit -m "feat(parent-app): extend offline caching (loadWithCache/LastUpdatedBanner) to FeesTab"
```

---

### Task 7: Extend offline caching to `MessagesTab`'s conversation list

**Files:**
- Modify: `parent-app/lib/src/api/models.dart`
- Modify: `parent-app/lib/src/screens/messages_tab.dart`
- Test: Modify `parent-app/test/screens/messages_tab_test.dart`

**Interfaces:**
- Produces: `ConversationSummary.toJson()` — consumed by `loadWithCache`'s `toJson` param.

- [ ] **Step 1: Add `toJson()` to `ConversationSummary`**

Edit `parent-app/lib/src/api/models.dart` — add right after the existing `fromJson` factory
(nothing else in this class changes):

```dart
class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.recipientType,
    required this.studentId,
    required this.otherPartyName,
    required this.lastMessageAt,
    required this.unread,
  });

  final String id;
  final String recipientType;
  final String? studentId;
  final String otherPartyName;
  final String lastMessageAt;
  final bool unread;

  factory ConversationSummary.fromJson(Map<String, dynamic> json) =>
      ConversationSummary(
        id: json['id'] as String,
        recipientType: json['recipientType'] as String,
        studentId: json['studentId'] as String?,
        otherPartyName: json['otherPartyName'] as String,
        lastMessageAt: json['lastMessageAt'] as String,
        unread: json['unread'] as bool,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'recipientType': recipientType,
    'studentId': studentId,
    'otherPartyName': otherPartyName,
    'lastMessageAt': lastMessageAt,
    'unread': unread,
  };
}
```

- [ ] **Step 2: Write the failing test**

Add to `parent-app/test/screens/messages_tab_test.dart`, at the end of `main()` (after Task 4's
"compose defaults..." test):

```dart
  testWidgets(
    'falls back to cached conversations with a Last updated timestamp when the live fetch fails',
    (tester) async {
      final cachedAt = DateTime.now().subtract(const Duration(hours: 1));
      SharedPreferences.setMockInitialValues({
        'cache:conversations': jsonEncode({
          'fetchedAt': cachedAt.toIso8601String(),
          'data': [
            {
              'id': 'conv-1',
              'recipientType': 'CLASS_TEACHER',
              'studentId': 's1',
              'otherPartyName': 'Cached Teacher',
              'lastMessageAt': '2026-08-29T00:00:00.000Z',
              'unread': false,
            },
          ],
        }),
      });
      final api = ApiClient(
        baseUrl: 'http://test',
        client: MockClient((request) async => http.Response('server down', 500)),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessagesTab(accessToken: 'tok', api: api, children: children, activeChildId: 's1'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Cached Teacher'), findsOneWidget);
      expect(find.textContaining('Last updated'), findsOneWidget);
    },
  );
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/messages_tab_test.dart`
Expected: FAIL — the new test's cached conversation never appears (the live fetch fails and there
is no cache fallback yet).

- [ ] **Step 4: Implement caching in `MessagesTab`'s conversation list**

Edit `parent-app/lib/src/screens/messages_tab.dart` — add the cache imports at the top, add
`_lastUpdated`/`_stale` fields, replace `_loadList()`, and wrap `_buildList()`'s body in the same
banner-above-content layout `CircularsTab`/`FeesTab` use:

```dart
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../cache/cached_load.dart';
import '../cache/data_cache.dart';
import '../cache/last_updated_banner.dart';
import '../theme/text_direction.dart';
```

```dart
class _MessagesTabState extends State<MessagesTab> {
  _MessagesView _view = _MessagesView.list;
  List<ConversationSummary>? _conversations;
  String? _error;
  DateTime? _lastUpdated;
  bool _stale = false;
  String? _openConversationId;
  ConversationDetail? _openConversation;

  @override
  void initState() {
    super.initState();
    _loadList();
    if (widget.initialConversationId != null) {
      _openThread(widget.initialConversationId!);
    }
  }

  Future<void> _loadList() async {
    final cache = await DataCache.open();
    await loadWithCache<List<ConversationSummary>>(
      cache: cache,
      cacheKey: 'cache:conversations',
      fetch: () => widget.api.conversations(widget.accessToken),
      toJson: (list) => list.map((c) => c.toJson()).toList(),
      fromJson: (json) => (json as List<dynamic>)
          .map((e) => ConversationSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
      onData: (data, lastUpdated, {required stale}) {
        if (mounted) {
          setState(() {
            _conversations = data;
            _lastUpdated = lastUpdated;
            _stale = stale;
            _error = null;
          });
        }
      },
      onError: (message) {
        if (mounted) setState(() => _error = message);
      },
    );
  }
```

Replace `_buildList()` with:

```dart
  Widget _buildList() {
    if (_error != null) return Center(child: Text(_error!));
    final conversations = _conversations;
    if (conversations == null) return const Center(child: CircularProgressIndicator());

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        key: const Key('newConversation'),
        onPressed: () => setState(() => _view = _MessagesView.compose),
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
            ),
          ),
          Expanded(
            child: conversations.isEmpty
                ? const Center(child: Text('No messages yet.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: conversations.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final c = conversations[i];
                      return ListTile(
                        onTap: () => _openThread(c.id),
                        leading: Icon(c.unread ? Icons.circle : Icons.circle_outlined, size: 12),
                        title: Text(
                          c.otherPartyName,
                          style: TextStyle(fontWeight: c.unread ? FontWeight.bold : FontWeight.normal),
                        ),
                        subtitle: Text(recipientLabel(c.recipientType)),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
```

(`_openThread`, `_refreshThread`, `build()`'s switch, `_ComposeView`, and `_ThreadView` are all
unchanged from Task 4.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/messages_tab_test.dart`
Expected: PASS (4 cases)

- [ ] **Step 6: Run the full suite**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: analyzer clean, full suite passing.

- [ ] **Step 7: Commit**

```bash
git add parent-app/lib/src/api/models.dart parent-app/lib/src/screens/messages_tab.dart parent-app/test/screens/messages_tab_test.dart
git commit -m "feat(parent-app): extend offline caching (loadWithCache/LastUpdatedBanner) to Messages' conversation list"
```

---

### Task 8: Docs — update the roadmap checklist and `PROJECT-STATUS.md`

**Files:**
- Modify: `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md`
- Modify: `build/PROJECT-STATUS.md`

Per [[roadmap-checklist-convention]] — both trackers are updated whenever a sprint ships (verified,
not just merged).

- [ ] **Step 1: Check Sprint G's box and sub-items in the roadmap**

Edit `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md` — replace the Sprint G block with
(fill in the actual merge commit range and test counts once Tasks 1-7 are committed and merged —
do not leave a placeholder in the final edit):

```markdown
- [x] **Sprint G — Parent App Second-Pass UI Polish (UI Sprint 3)** — merged to `main` <DATE>
      (`<START_SHA>..<END_SHA>`)
  - [x] Parent-app dark theme (mirrors staff-console token values) — `AppColorsDark`/
    `buildDarkAppTheme()` port `base.css`'s `[data-theme='dark']` hex values exactly; a
    `ThemeController` (System/Light/Dark, persisted) is toggled from a new "Appearance" row in
    the More tab.
  - [x] Fix `HomeTab`'s hardcoded Fees/Results stat cards — Fees now sums real `amountDue` across
    a fetched voucher list; Results is grayed out (`Opacity` 0.5) with a "Coming soon" label until
    report cards ship (roadmap Sprint I), rather than a fabricated number or a misleadingly-live-
    looking static string.
  - [x] Thread `activeChildId` into `LeaveScreen` and Messages-compose — both previously defaulted
    to `children.first`, silently showing/submitting-for the wrong child whenever a parent had
    switched away from their first-listed child before opening either screen.
  - [x] Rename "Notifications" bottom-nav tab to "Circulars" — the AppBar bell's own "Notifications"
    tooltip (a different, cross-cutting feature) is unchanged.
  - [x] Extend offline caching (`loadWithCache`) to Fees and Messages — Fees' voucher list is cached
    per-student; Messages' conversation list is cached; both show a `Last updated:` banner,
    matching Timetable/Attendance/Diary/Circulars' existing pattern exactly.
  - Plan: `docs/superpowers/plans/2026-09-11-sprint-g-parent-app-ui-polish.md`. Verified: parent-app
    `flutter analyze` clean, `flutter test` <N> tests passing.
```

- [ ] **Step 2: Add the Sprint G section to `PROJECT-STATUS.md`**

Edit `build/PROJECT-STATUS.md` — insert a new `## Sprint G — Parent App Second-Pass UI Polish (UI
Sprint 3) ✅ DONE` section between the `## Sprint F — Push Notifications...` section and `## Sprint
11-12 — Hardening + Pilot ⏳ PENDING`, following the same structure used by the Sprint E/F sections
immediately above it (goal, what shipped, what's verified). Include: the exact dark-palette-parity
claim (and that it's a direct port, not a re-derived palette), the `Opacity`-based "gray, don't
remove" choice for the Results card and why (report cards aren't built until Sprint I), the two
wrong-child-default fixes and which screens they were in, the bell-tooltip-vs-bottom-nav-label
distinction (so a future reader doesn't "fix" the bell tooltip by mistake), and the final test
counts from the last full `flutter test` run.

- [ ] **Step 3: Commit**

```bash
git add docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md PROJECT-STATUS.md
git commit -m "docs: mark Sprint G done in the roadmap checklist and PROJECT-STATUS.md"
```

---

## Self-Review Notes (for whoever executes this plan)

- **Spec coverage:** All five Sprint G bullet items from the roadmap (dark theme → Task 1; Fees/
  Results card fixes → Task 2; `activeChildId` into Leave → Task 3; `activeChildId` into
  Messages-compose → Task 4; bottom-nav rename → Task 5; offline caching on Fees/Messages → Tasks 6-7)
  are covered. The roadmap's Testing note ("a dark-mode snapshot/golden-file pass if the project has
  one, otherwise manual verification") is satisfied by Task 1's `ThemeController`/`MoreTab` tests
  plus every other task's widget tests rendering correctly under the default theme — this project has
  no golden-file harness today, and adding one is out of this sprint's scope.
- **Task ordering matters, but each task still compiles standalone:** Task 1 adds `activeChildId`
  to `MoreTab`'s constructor as an *optional* field (not `required`) specifically so Task 1 compiles
  on its own even though nothing forwards that field into `LeaveScreen` yet, and `HomeShell`'s
  existing `MoreTab(...)` call site (which doesn't pass it) keeps compiling too. Task 3 is what adds
  `LeaveScreen`'s `initialChildId` parameter *and* updates `MoreTab`'s call site to forward
  `activeChildId` into it, in the same task/commit — the two halves of that feature never ship out
  of sync. Task 4 separately updates `HomeShell`'s `MoreTab` and `MessagesTab` call sites to pass
  the real `_activeChildId` value (upgrading from the implicit `null` default), since `HomeShell` is
  already being edited in that task for `MessagesTab`'s new required field. Execute Tasks 1 → 3 → 4
  in that relative order (2 and 5-7 can run anywhere after 1) — every intermediate state still
  compiles and passes its own tests, it's only the *real* `activeChildId` value that arrives in
  stages.
- **Known non-goal:** The roadmap's Sprint G duration/scope does not include a staff-console-side
  change of any kind, and does not include full parent-app localization or a golden-file testing
  harness — none of those are in scope here even though they're adjacent to "design maturity."

---

## Execution Handoff

Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch execution
with checkpoints.
