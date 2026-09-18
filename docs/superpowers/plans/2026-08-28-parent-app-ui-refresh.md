# Parent-App UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build out the parent-app's Home tab (currently a placeholder) and restyle the Calendar tab's Timetable/Attendance/Diary sub-tabs (weekly grid for Timetable, card-wrapped entries for Attendance and Diary), following the `docs/wireframe/` layouts, against the existing SchoolOS design tokens.

**Architecture:** Flutter/Dart widget changes on top of the existing `AppColors`/`buildAppTheme()` token system in `parent-app/lib/src/theme/app_theme.dart` (kept in sync with the staff-console's CSS tokens — see the companion plan `2026-08-28-staff-console-ui-refresh.md`). Every screen here reads real data from the existing `ApiClient` (`timetable`, `attendance`, `circulars`) — unlike the staff-console plan, nothing here needs mock data, since FEAT-006/007/008/009 (timetable, attendance, diary, circulars) are already built and live.

**Tech Stack:** Flutter 3 (Material 3, `useMaterial3: true`), `flutter_test` + `http.testing.MockClient` for widget tests, `provider` for DI (`ApiClient`/`AuthState`).

**Spec:** `build/docs/superpowers/specs/2026-08-28-wireframe-css-refresh-design.md`

## Global Constraints

- No new pubspec dependencies — everything below is built from Flutter Material widgets already in use elsewhere in this app (`Card`, `Chip`, `GridView`, `ListView`).
- New design tokens on `AppColors` (`parent-app/lib/src/theme/app_theme.dart`), matching the staff-console's `--color-present`/`--color-late` exactly so both clients share one palette: `present = Color(0xFF15803D)`, `lateStatus = Color(0xFFB45309)` (named `lateStatus`, not `late`, since `late` is a Dart built-in identifier and reusing it as a static field name is legal but needlessly confusing to read).
- The parent's actual name is not available anywhere in the API (`LoginResponse`/`ChildSummary` have no name field for the logged-in parent, only the child's name) — the Home tab greeting is "Assalam-o-Alaikum" with no name appended, not a fabricated placeholder name.
- Fees outstanding has no backing endpoint yet (FEAT-012 not built) — the Home tab's Fees card shows a static "—", never a fabricated number. Results (report cards) is explicitly a Release-2 feature per `PROJECT-STATUS.md`'s Deferred section — its Home tab card is a static, non-interactive label.
- New interactive widgets get a `Key(...)` (not a `data-testid`, this is Flutter, not the Vue app) following the existing convention (`Key('childSwitcher')`, `Key('logoutButton')` in `home_shell.dart`).
- Tests use `flutter_test` + `http.testing.MockClient`, matching the exact pattern in `test/screens/calendar_tab_test.dart` and `test/screens/home_shell_test.dart` — a `MockClient` callback keyed on `request.url.path`, falling through to a 404 for unhandled paths.
- Simplification versus the spec's §5 wording: the spec describes the Home tab's child-summary card as "tappable to open the existing child-switcher dropdown". This plan makes it a static info card instead (name + class/section, no tap target) — the AppBar dropdown (`Key('childSwitcher')`, already implemented and tested) remains the only way to switch the active child. Wiring a second entry point into the same interactive dropdown from a child widget adds real complexity (the dropdown would need to become externally triggerable) for zero functional gain, since both are one tap away on the same screen.

---

### Task 1: Design tokens

**Files:**
- Modify: `parent-app/lib/src/theme/app_theme.dart`
- Test: `parent-app/test/theme/app_theme_test.dart` (new file)

**Interfaces:**
- Produces: `AppColors.present`, `AppColors.lateStatus` — consumed by Tasks 3/4 (status-colored chips/cards), if needed, and available for any later feature.

- [ ] **Step 1: Write the failing test**

Create `parent-app/test/theme/app_theme_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/theme/app_theme.dart';

void main() {
  test('present and late status colors match the staff-console design tokens', () {
    expect(AppColors.present, const Color(0xFF15803D));
    expect(AppColors.lateStatus, const Color(0xFFB45309));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/theme/app_theme_test.dart`
Expected: FAIL — `AppColors.present`/`AppColors.lateStatus` don't exist yet (compile error).

- [ ] **Step 3: Add the two tokens**

In `parent-app/lib/src/theme/app_theme.dart`, extend the `AppColors` class (add after the existing `destructive` line):

```dart
class AppColors {
  static const primary = Color(0xFF0F172A);
  static const accent = Color(0xFF0369A1);
  static const background = Color(0xFFF8FAFC);
  static const surface = Color(0xFFFFFFFF);
  static const text = Color(0xFF1E293B);
  static const muted = Color(0xFF64748B);
  static const border = Color(0xFFE2E8F0);
  static const destructive = Color(0xFFDC2626);
  static const present = Color(0xFF15803D);
  static const lateStatus = Color(0xFFB45309);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/theme/app_theme_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add parent-app/lib/src/theme/app_theme.dart parent-app/test/theme/app_theme_test.dart
git commit -m "style: add present/late status color tokens to AppColors"
```

---

### Task 2: Home tab

**Files:**
- Create: `parent-app/lib/src/screens/home_tab.dart`
- Test: `parent-app/test/screens/home_tab_test.dart` (new file)
- Modify: `parent-app/lib/src/screens/home_shell.dart`

**Interfaces:**
- Consumes: `ApiClient.attendance(accessToken, studentId, month) -> Future<AttendanceReport>`, `ApiClient.circulars(accessToken) -> Future<List<CircularSummary>>` (both already exist in `lib/src/api/api_client.dart`).
- Produces: `HomeTab` widget with constructor `HomeTab({Key? key, required String studentId, required String childName, required String childClass, required String accessToken, required ApiClient api, required VoidCallback onOpenTimetable, required VoidCallback onSeeAllAnnouncements})`.

- [ ] **Step 1: Write the failing test**

Create `parent-app/test/screens/home_tab_test.dart`:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
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
        if (request.url.path == '/api/v1/circulars') {
          return http.Response(
            jsonEncode([
              {
                'id': 'c1',
                'title': 'Independence Day Holiday',
                'description': 'School will remain closed on 14-Aug-2026.',
                'scope': 'school',
                'priority': 'normal',
                'publishedAt': '2026-08-25T00:00:00.000Z',
                'expiresAt': null,
                'attachments': [],
                'readAt': null,
              },
              {
                'id': 'c2',
                'title': 'Older notice',
                'description': 'An older announcement.',
                'scope': 'school',
                'priority': 'normal',
                'publishedAt': '2026-08-01T00:00:00.000Z',
                'expiresAt': null,
                'attachments': [],
                'readAt': null,
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );
  }

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
            onOpenTimetable: () => timetableOpened = true,
            onSeeAllAnnouncements: () => seeAllTapped = true,
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

  testWidgets('shows static placeholders for Fees and Results, not fabricated data', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeTab(
            studentId: 's1',
            childName: 'Zara Ahmed',
            childClass: 'Class 8A',
            accessToken: 'tok',
            api: makeClient(),
            onOpenTimetable: () {},
            onSeeAllAnnouncements: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('—'), findsOneWidget);
    expect(find.text('View latest results'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/home_tab_test.dart`
Expected: FAIL — `package:parent_app/src/screens/home_tab.dart` doesn't exist yet.

- [ ] **Step 3: Write the HomeTab widget**

Create `parent-app/lib/src/screens/home_tab.dart`:

```dart
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';

/// Home tab (bottom-nav index 0) — greeting, active-child summary, a 2x2 stat/quick-link grid,
/// and the most recent announcements. Fetches its own attendance + circulars data, the same
/// self-contained pattern `CalendarTab` and `CircularsTab` already use.
class HomeTab extends StatefulWidget {
  const HomeTab({
    super.key,
    required this.studentId,
    required this.childName,
    required this.childClass,
    required this.accessToken,
    required this.api,
    required this.onOpenTimetable,
    required this.onSeeAllAnnouncements,
  });

  final String studentId;
  final String childName;
  final String childClass;
  final String accessToken;
  final ApiClient api;
  final VoidCallback onOpenTimetable;
  final VoidCallback onSeeAllAnnouncements;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  AttendanceReport? _attendance;
  List<CircularSummary>? _circulars;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final month = DateTime.now().toIso8601String().substring(0, 7);
    try {
      final attendance = await widget.api.attendance(widget.accessToken, widget.studentId, month);
      final circulars = await widget.api.circulars(widget.accessToken);
      if (!mounted) return;
      setState(() {
        _attendance = attendance;
        _circulars = circulars;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    final attendance = _attendance;
    final circulars = _circulars;
    if (attendance == null || circulars == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final recentAnnouncements = [...circulars]..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    final topAnnouncements = recentAnnouncements.take(2).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
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
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.6,
          children: [
            _StatCard(
              key: const Key('homeAttendanceCard'),
              label: 'Attendance',
              value: '${attendance.summary.attendancePercentage}%',
              hint: 'This Month',
            ),
            const _StatCard(
              key: Key('homeFeesCard'),
              label: 'Fees',
              value: '—',
              hint: 'Outstanding',
            ),
            const _StatCard(
              key: Key('homeResultsCard'),
              label: 'Results',
              value: 'View latest results',
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
            Text('Recent Announcements', style: Theme.of(context).textTheme.titleSmall),
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
            child: ListTile(title: Text(c.title), subtitle: Text(c.description)),
          ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({super.key, required this.label, required this.value, this.hint, this.onTap});

  final String label;
  final String value;
  final String? hint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 4),
              Text(value, style: Theme.of(context).textTheme.titleMedium),
              if (hint != null) Text(hint!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/home_tab_test.dart`
Expected: PASS, both cases.

- [ ] **Step 5: Wire HomeTab into home_shell.dart**

In `parent-app/lib/src/screens/home_shell.dart`, add the import after the existing `circulars_tab.dart` import:

```dart
import 'circulars_tab.dart';
import 'home_tab.dart';
```

Then in `_buildBody()`, insert a new `_tabIndex == 0` branch immediately before the existing `if (_tabIndex == 1)` branch (the method currently goes straight from the `child == null` guard to the Calendar-tab check):

```dart
    if (_tabIndex == 0) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return HomeTab(
        // Keyed on the child id so switching the active child re-fetches this tab's attendance
        // stat instead of silently keeping the previous child's data on screen.
        key: ValueKey(child.id),
        studentId: child.id,
        childName: child.name,
        childClass: '${child.schoolClass} ${child.section}',
        accessToken: auth.accessToken!,
        api: api,
        onOpenTimetable: () => setState(() => _tabIndex = 1),
        onSeeAllAnnouncements: () => setState(() => _tabIndex = 2),
      );
    }

    if (_tabIndex == 1) {
```

(That last line, `if (_tabIndex == 1) {`, already exists in the file — this step inserts the new block directly above it, it does not duplicate or replace the existing Calendar-tab branch.)

- [ ] **Step 6: Run the full parent-app test suite**

Run: `cd parent-app && flutter test`
Expected: all suites pass, including the pre-existing `test/screens/home_shell_test.dart` (its mock clients don't stub `/students/s1/attendance` or `/circulars`, so the Home tab will show its error state in those tests — none of the three existing `home_shell_test.dart` cases assert anything about Home-tab content, they only check the child switcher, logout, and the Notifications tab, so this doesn't break them).

- [ ] **Step 7: Commit**

```bash
git add parent-app/lib/src/screens/home_tab.dart parent-app/test/screens/home_tab_test.dart parent-app/lib/src/screens/home_shell.dart
git commit -m "feat: build out the parent-app Home tab against real attendance/circulars data"
```

---

### Task 3: Timetable weekly grid

**Files:**
- Modify: `parent-app/lib/src/screens/calendar_tab.dart` (the `_TimetableTab`/`_TimetableTabState` classes, lines 41–97 of the current file)
- Modify: `parent-app/test/screens/calendar_tab_test.dart` (the "Timetable tab" test, lines 53–64 of the current file)

**Interfaces:**
- No change to `_TimetableTab`'s constructor or its place in `CalendarTab`'s `TabBarView` — purely an internal `build()` rewrite.

- [ ] **Step 1: Update the test to expect the weekly grid (write before touching the widget)**

In `parent-app/test/screens/calendar_tab_test.dart`, replace the existing `'Timetable tab shows the structured entry'` test:

```dart
  testWidgets('Timetable tab shows the structured entry', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: CalendarTab(studentId: 's1', accessToken: 'tok', api: makeClient())),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('English'), findsOneWidget);
    expect(find.textContaining('Ms. Sample'), findsOneWidget);
    expect(find.textContaining('08:00'), findsOneWidget);
  });
```

with:

```dart
  testWidgets('Timetable tab groups periods by day into 7 day-rows', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: CalendarTab(studentId: 's1', accessToken: 'tok', api: makeClient())),
      ),
    );
    await tester.pumpAndSettle();

    // makeClient()'s one timetable entry has dayOfWeek: 1 (Mon).
    expect(find.byKey(const Key('timetableDay1')), findsOneWidget);
    expect(find.textContaining('English'), findsOneWidget);
    expect(find.textContaining('Ms. Sample'), findsOneWidget);
    expect(find.textContaining('08:00'), findsOneWidget);

    // Every other day-of-week card renders with an empty state, not omitted.
    expect(find.text('No periods'), findsNWidgets(6));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/calendar_tab_test.dart`
Expected: FAIL — no `Key('timetableDay1')` exists yet, and there's no "No periods" text (the current implementation is a flat list, not 7 day-cards).

- [ ] **Step 3: Rewrite the Timetable tab**

In `parent-app/lib/src/screens/calendar_tab.dart`, replace the `_TimetableTabState` class's `build` method:

```dart
  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    if (_entries == null) return const Center(child: CircularProgressIndicator());
    if (_entries!.isEmpty) return const Center(child: Text('No timetable published yet.'));

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _entries!.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final e = _entries![i];
        return ListTile(
          leading: CircleAvatar(child: Text('P${e.period}')),
          title: Text(e.subject),
          subtitle: Text(
            [
              _dayNames[e.dayOfWeek],
              '${e.startTime}–${e.endTime}',
              if (e.teacher != null) e.teacher!,
              if (e.room != null) 'Room ${e.room}',
            ].join(' · '),
          ),
        );
      },
    );
  }
```

with:

```dart
  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    if (_entries == null) return const Center(child: CircularProgressIndicator());
    if (_entries!.isEmpty) return const Center(child: Text('No timetable published yet.'));

    final byDay = <int, List<TimetableEntry>>{for (var d = 0; d < 7; d++) d: []};
    for (final e in _entries!) {
      byDay[e.dayOfWeek]!.add(e);
    }
    for (final entries in byDay.values) {
      entries.sort((a, b) => a.period.compareTo(b.period));
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (var day = 0; day < 7; day++)
          Card(
            key: Key('timetableDay$day'),
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_dayNames[day], style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  if (byDay[day]!.isEmpty)
                    Text('No periods', style: Theme.of(context).textTheme.bodySmall)
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final entry in byDay[day]!)
                          Chip(
                            label: Text(
                              [
                                'P${entry.period}',
                                entry.subject,
                                '${entry.startTime}–${entry.endTime}',
                                if (entry.teacher != null) entry.teacher!,
                                if (entry.room != null) 'Room ${entry.room}',
                              ].join(' · '),
                            ),
                          ),
                      ],
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
```

(The class fields, `initState`, and `_load` above this `build` method are unchanged — only `build` itself is replaced.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/calendar_tab_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add parent-app/lib/src/screens/calendar_tab.dart parent-app/test/screens/calendar_tab_test.dart
git commit -m "feat: group the parent-app Timetable tab into a 7-day weekly grid"
```

---

### Task 4: Attendance tab — card-wrapped day rows

**Files:**
- Modify: `parent-app/lib/src/screens/calendar_tab.dart` (`_AttendanceTabState.build`, the trailing `for` loop)
- Modify: `parent-app/test/screens/calendar_tab_test.dart` (the "Attendance tab" test)

- [ ] **Step 1: Update the test (write before touching the widget)**

In `parent-app/test/screens/calendar_tab_test.dart`, in the `'Attendance tab shows the percentage and today\'s status'` test, add one line after the existing assertions:

```dart
    expect(find.textContaining('86%'), findsOneWidget);
    expect(find.textContaining('18'), findsWidgets);
    expect(find.byKey(const Key('attendanceDay2026-08-27')), findsOneWidget);
  });
```

(replacing the test's previous closing two lines, `expect(find.textContaining('18'), findsWidgets);` followed directly by `});`, with those same two lines plus the new `expect` in between.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/calendar_tab_test.dart`
Expected: FAIL — no widget keyed `attendanceDay2026-08-27` exists yet (the day rows are plain `ListTile`s with no key).

- [ ] **Step 3: Wrap each day row in a Card**

In `parent-app/lib/src/screens/calendar_tab.dart`, inside `_AttendanceTabState.build`, replace:

```dart
        const SizedBox(height: 12),
        for (final day in report.days.reversed)
          ListTile(dense: true, title: Text(day.date), trailing: Text(day.status)),
      ],
    );
```

with:

```dart
        const SizedBox(height: 12),
        for (final day in report.days.reversed)
          Card(
            key: Key('attendanceDay${day.date}'),
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(dense: true, title: Text(day.date), trailing: Text(day.status)),
          ),
      ],
    );
```

(The summary `Card` above this loop, and everything else in the method, is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/calendar_tab_test.dart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add parent-app/lib/src/screens/calendar_tab.dart parent-app/test/screens/calendar_tab_test.dart
git commit -m "feat: wrap parent-app Attendance day rows in cards"
```

---

### Task 5: Diary tab — card-wrapped entries

**Files:**
- Modify: `parent-app/lib/src/screens/calendar_tab.dart` (`_DiaryTabState.build`)
- Modify: `parent-app/test/screens/calendar_tab_test.dart` (the "Diary tab" test)

- [ ] **Step 1: Update the test (write before touching the widget)**

In `parent-app/test/screens/calendar_tab_test.dart`, in the `'Diary tab shows the structured entry, direction-aware'` test, add one line after the existing assertions:

```dart
    expect(find.textContaining('Urdu'), findsOneWidget);
    expect(find.text('کتاب لائیں'), findsOneWidget);
    expect(find.byKey(const Key('diaryEntryd1')), findsOneWidget);
  });
```

(replacing the test's previous closing three lines with those same three plus the new `expect` inserted before the closing `});`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/calendar_tab_test.dart`
Expected: FAIL — no widget keyed `diaryEntryd1` exists yet.

- [ ] **Step 3: Wrap each entry in a Card**

In `parent-app/lib/src/screens/calendar_tab.dart`, replace the whole `_DiaryTabState.build` method:

```dart
  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    if (_entries == null) return const Center(child: CircularProgressIndicator());
    if (_entries!.isEmpty) return const Center(child: Text('No diary entries yet.'));

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _entries!.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final e = _entries![i];
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  DirectionalText(e.subject, style: Theme.of(context).textTheme.titleSmall),
                  Text(
                    ' · ${e.date}${e.dueDate != null ? ' (due ${e.dueDate})' : ''}',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              DirectionalText(e.text),
              if (e.attachments.isNotEmpty)
                Wrap(
                  spacing: 8,
                  children: e.attachments
                      .map(
                        (a) => ActionChip(
                          label: Text(a.originalName),
                          onPressed: () => launchUrl(
                            widget.api.fileDownloadUrl(a.id, widget.accessToken),
                            mode: LaunchMode.externalApplication,
                          ),
                        ),
                      )
                      .toList(),
                ),
            ],
          ),
        );
      },
    );
  }
```

with:

```dart
  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    if (_entries == null) return const Center(child: CircularProgressIndicator());
    if (_entries!.isEmpty) return const Center(child: Text('No diary entries yet.'));

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _entries!.length,
      itemBuilder: (context, i) {
        final e = _entries![i];
        return Card(
          key: Key('diaryEntry${e.id}'),
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    DirectionalText(e.subject, style: Theme.of(context).textTheme.titleSmall),
                    Text(
                      ' · ${e.date}${e.dueDate != null ? ' (due ${e.dueDate})' : ''}',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                DirectionalText(e.text),
                if (e.attachments.isNotEmpty)
                  Wrap(
                    spacing: 8,
                    children: e.attachments
                        .map(
                          (a) => ActionChip(
                            label: Text(a.originalName),
                            onPressed: () => launchUrl(
                              widget.api.fileDownloadUrl(a.id, widget.accessToken),
                              mode: LaunchMode.externalApplication,
                            ),
                          ),
                        )
                        .toList(),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
```

(`ListView.separated`'s `Divider` between entries is dropped in favor of the `Card`'s own margin — two forms of separation stacked would look wrong once entries are card-shelled, matching the Timetable/Attendance tabs' card-only separation in this same file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/calendar_tab_test.dart`
Expected: PASS.

- [ ] **Step 5: Run the full parent-app test suite, analyzer, and format check**

Run: `cd parent-app && flutter test && flutter analyze && dart format --output=none --set-exit-if-changed lib test`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add parent-app/lib/src/screens/calendar_tab.dart parent-app/test/screens/calendar_tab_test.dart
git commit -m "feat: wrap parent-app Diary entries in cards"
```

---

## Manual verification (do this after Task 5, before calling the plan done)

- [ ] Start the backend (`cd backend && npm run start:dev`) and run the app (`cd parent-app && flutter run -d chrome`), log in as a seeded parent.
- [ ] Confirm the Home tab shows "Assalam-o-Alaikum" (no name), the active child's name/class, a real Attendance % card, static "—" Fees card, static "View latest results" Results card, and a tappable Timetable card that switches to the Calendar tab.
- [ ] Confirm "See All" on Home switches to the Notifications tab.
- [ ] Open Calendar → Timetable: confirm all 7 days render as cards, days with periods show chips, days without show "No periods".
- [ ] Open Calendar → Attendance and → Diary: confirm both render their entries as individual cards (not a flat divided list).
