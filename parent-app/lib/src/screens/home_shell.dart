import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/auth_state.dart';
import '../notifications/device_token_registrar.dart';
import '../notifications/notification_target.dart';
import '../theme/accent_controller.dart';
import '../widgets/parent_ui.dart';
import 'calendar_tab.dart';
import 'circulars_tab.dart';
import 'fees_tab.dart';
import 'home_tab.dart';
import 'messages_tab.dart';
import 'more_tab.dart';
import 'notifications_sheet.dart';
import 'student_info_screen.dart';
import '../../l10n/app_localizations.dart';

/// Authenticated shell: bottom nav (Home / Calendar / Circulars / Messages / Fees / More) with
/// the active child shared across tabs. Home and Calendar draw their own headers (child pills /
/// title + notification bell) per the parent-app mockups; the remaining tabs share [TabHeader]
/// (title, child picker, bell, logout). The per-guardian accent colour is derived from
/// the active child's `relationship` and pushed to `AccentController`.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  late int _tabIndex = widget.initialTab;
  List<ChildSummary> _children = [];
  String? _activeChildId;
  bool _isLoading = true;
  String? _loadError;
  List<CircularSummary> _circulars = [];
  int _unreadCirculars = 0;
  int _unreadNotifications = 0;
  StreamSubscription<NotificationTarget>? _pushTapSubscription;

  /// Which CalendarTab sub-tab (0 = Timetable, 1 = Attendance, 2 = Diary) should be shown next
  /// time the Calendar tab is built. Set to 2 (Diary) when the user taps a `type: 'diary'`
  /// notification so they land on the actual content the notification was about, rather than
  /// always landing on Timetable. Reset to 0 whenever the user manually navigates to Calendar
  /// via the bottom nav, so a stale "open on Diary" doesn't stick around on later manual visits.
  int _calendarInitialSubTab = 0;

  /// Which conversation MessagesTab should open straight to, set when the user taps a
  /// `type: 'message'` notification's entityRef. Reset to null on manual bottom-nav navigation
  /// to Messages, same reasoning as _calendarInitialSubTab above.
  String? _messagesInitialConversationId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadChildren();
    _loadCirculars();
    _loadNotificationCount();
    _registerDeviceToken();
    _listenForPushTaps();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pushTapSubscription?.cancel();
    super.dispose();
  }

  /// Interim stopgap (ships independently of full FCM, per the roadmap's Sprint F note): a
  /// backgrounded app that gets resumed re-fetches the counts a real push would have kept fresh,
  /// so a parent who missed a push (or on a build where push isn't configured yet) still sees an
  /// accurate badge within moments of reopening the app rather than only on a cold start.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadNotificationCount();
      _loadCirculars();
    }
  }

  Future<void> _registerDeviceToken() async {
    final auth = context.read<AuthState>();
    final token = auth.accessToken;
    if (token == null) return;
    await context.read<DeviceTokenRegistrar>().registerIfPossible(token);
  }

  void _listenForPushTaps() {
    final registrar = context.read<DeviceTokenRegistrar>();
    _pushTapSubscription = registrar.tokenProvider.onNotificationTapped.listen((target) {
      if (!mounted) return;
      _navigateForNotificationType(target.type, target.entityRef);
    });
  }

  /// Shared by both the in-app NotificationsSheet (a tapped row) and a tapped push notification
  /// (_listenForPushTaps) — one navigation mapping for "a notification of this type was opened",
  /// regardless of which surface it came from.
  void _navigateForNotificationType(String type, String? entityRef) {
    setState(() {
      if (type == 'diary') {
        _tabIndex = 1;
        _calendarInitialSubTab = 2;
      }
      if (type == 'circular') _tabIndex = 2;
      if (type == 'message') {
        _tabIndex = 3;
        _messagesInitialConversationId = entityRef;
      }
    });
  }

  Future<void> _loadCirculars() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;
    try {
      final circulars = await api.circulars(token);
      if (mounted) {
        setState(() {
          _circulars = circulars;
          _unreadCirculars = circulars.where((c) => c.readAt == null).length;
        });
      }
    } on ApiException {
      // The Home tab's announcements and the Notifications badge are conveniences, not the
      // critical path — the Notifications tab itself will surface the real error if opened.
    }
  }

  Future<void> _loadNotificationCount() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;
    try {
      final notifications = await api.notifications(token);
      if (mounted) {
        setState(() => _unreadNotifications = notifications.where((n) => n.readAt == null).length);
      }
    } on ApiException {
      // Convenience badge only — a failed fetch just shows zero, doesn't block the rest of the shell.
    }
  }

  Future<void> _openNotifications() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => SizedBox(
        height: MediaQuery.of(context).size.height * 0.6,
        child: NotificationsSheet(
          accessToken: token,
          api: api,
          onOpenType: (type, entityRef) {
            Navigator.of(context).pop();
            _navigateForNotificationType(type, entityRef);
          },
        ),
      ),
    );
    await _loadNotificationCount();
  }

  void _openStudentInfo() {
    final token = context.read<AuthState>().accessToken;
    if (token == null || _children.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => StudentInfoScreen(
          accessToken: token,
          api: context.read<ApiClient>(),
          children: _children,
          initialChildId: _activeChildId,
        ),
      ),
    );
  }

  Future<void> _loadChildren() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;

    try {
      final children = await api.meChildren(token);
      setState(() {
        _children = children;
        _activeChildId = children.isNotEmpty ? children.first.id : null;
        _isLoading = false;
      });
      _applyAccent();
    } on ApiException catch (e) {
      setState(() {
        _loadError = e.message;
        _isLoading = false;
      });
    }
  }

  ChildSummary? get _activeChild =>
      _children.where((c) => c.id == _activeChildId).cast<ChildSummary?>().firstOrNull;

  /// Sets the app accent from the active child's guardian relationship (blue unless "mother").
  void _applyAccent() {
    final relationship = _activeChild?.relationship;
    context.read<AccentController>().setAccent(GuardianAccent.fromRelationship(relationship));
  }

  void _selectChild(String id) {
    setState(() => _activeChildId = id);
    _applyAccent();
  }

  void _onLogout() {
    // Back to the default blue so the login screen doesn't keep the previous guardian's accent.
    context.read<AccentController>().reset();
    context.read<AuthState>().logout();
  }

  @override
  Widget build(BuildContext context) {
    // Home (0) and Calendar (1) render their own headers; the other tabs share [TabHeader].
    const titles = {2: 'Circulars', 4: 'Fees', 5: 'More'};
    final headerTitle = titles[_tabIndex];
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            if (headerTitle != null)
              TabHeader(
                title: headerTitle,
                children: _children,
                activeChildId: _activeChildId,
                onSelectChild: _selectChild,
                unreadNotifications: _unreadNotifications,
                onOpenNotifications: _openNotifications,
                onLogout: _onLogout,
              ),
            Expanded(child: _buildBody()),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() {
          _tabIndex = i;
          // Manual bottom-nav navigation to Calendar/Messages should behave as before (Timetable
          // first / the list first) unless the previous action was specifically a notification tap.
          if (i == 1) _calendarInitialSubTab = 0;
          if (i == 3) _messagesInitialConversationId = null;
        }),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), label: AppLocalizations.of(context)!.navHome),
          NavigationDestination(
            icon: const Icon(Icons.calendar_month_outlined),
            label: AppLocalizations.of(context)!.navCalendar,
          ),
          NavigationDestination(
            icon: _unreadCirculars > 0
                ? Badge(label: Text('$_unreadCirculars'), child: const Icon(Icons.notifications_none))
                : const Icon(Icons.notifications_none),
            label: AppLocalizations.of(context)!.navCirculars,
          ),
          NavigationDestination(
            icon: const Icon(Icons.chat_bubble_outline),
            label: AppLocalizations.of(context)!.navMessages,
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            label: AppLocalizations.of(context)!.navFees,
          ),
          NavigationDestination(icon: const Icon(Icons.more_horiz), label: AppLocalizations.of(context)!.navMore),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_loadError != null) return Center(child: Text(_loadError!));
    if (_children.isEmpty) {
      return const Center(child: Text('No children are linked to this account yet.'));
    }

    final child = _activeChild;
    if (child == null) {
      return const Center(child: Text('No children are linked to this account yet.'));
    }

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
        circulars: _circulars,
        onOpenTimetable: () => setState(() => _tabIndex = 1),
        onSeeAllAnnouncements: () => setState(() => _tabIndex = 2),
        onOpenFees: () => setState(() => _tabIndex = 4),
        campusName: child.campus,
        children: _children,
        activeChildId: _activeChildId,
        onSelectChild: _selectChild,
        unreadNotifications: _unreadNotifications,
        onOpenNotifications: _openNotifications,
        onOpenStudentInfo: _openStudentInfo,
      );
    }

    if (_tabIndex == 1) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return CalendarTab(
        // Keyed on the child id AND the requested initial sub-tab: DefaultTabController caches
        // its controller state per-element, so without a key change tied to
        // _calendarInitialSubTab, Flutter would reuse the existing CalendarTab element on a
        // second open and silently ignore the new initialIndex (e.g. tapping a diary
        // notification a second time wouldn't re-open on Diary). This also still recreates the
        // tab (and its three sub-tabs) when the active child changes, as before.
        key: ValueKey('${child.id}_$_calendarInitialSubTab'),
        studentId: child.id,
        accessToken: auth.accessToken!,
        api: api,
        initialSubTab: _calendarInitialSubTab,
        childLabel: '${child.name.trim().split(RegExp(r'\s+')).first} · ${child.schoolClass} ${child.section}',
        unreadNotifications: _unreadNotifications,
        onOpenNotifications: _openNotifications,
      );
    }

    if (_tabIndex == 2) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return CircularsTab(
        accessToken: auth.accessToken!,
        api: api,
        onUnreadChanged: (count) => setState(() => _unreadCirculars = count),
      );
    }

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
        header: TabHeader(
          title: 'Messages',
          children: _children,
          activeChildId: _activeChildId,
          onSelectChild: _selectChild,
          unreadNotifications: _unreadNotifications,
          onOpenNotifications: _openNotifications,
          onLogout: _onLogout,
        ),
      );
    }

    if (_tabIndex == 4) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return FeesTab(
        key: ValueKey(child.id),
        studentId: child.id,
        accessToken: auth.accessToken!,
        api: api,
      );
    }

    if (_tabIndex == 5) {
      return MoreTab(
        accessToken: context.read<AuthState>().accessToken!,
        api: context.read<ApiClient>(),
        children: _children,
        activeChildId: _activeChildId,
      );
    }

    final labels = ['Home', 'Calendar', 'Circulars', 'Messages', 'Fees', 'More'];
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          '${labels[_tabIndex]} for ${child.name}\n\n'
          'Messages/fees land here in future sprints — this screen confirms login, multi-child '
          'switching, and role-gated routing are wired end to end.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}