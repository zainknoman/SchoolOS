import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/auth_state.dart';
import 'calendar_tab.dart';
import 'circulars_tab.dart';
import 'fees_tab.dart';
import 'home_tab.dart';
import 'messages_tab.dart';
import 'more_tab.dart';
import 'notifications_sheet.dart';

/// Authenticated shell: multi-child switcher up top, bottom nav below (Home / Calendar /
/// Notifications / Messages / Fees / More — per the MVP plan). Every tab is a placeholder;
/// FEAT-006 onward fill these in against the same /api/v1 endpoints the staff console uses.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _tabIndex = widget.initialTab;
  List<ChildSummary> _children = [];
  String? _activeChildId;
  bool _isLoading = true;
  String? _loadError;
  List<CircularSummary> _circulars = [];
  int _unreadCirculars = 0;
  int _unreadNotifications = 0;

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
    _loadChildren();
    _loadCirculars();
    _loadNotificationCount();
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
          },
        ),
      ),
    );
    await _loadNotificationCount();
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
    } on ApiException catch (e) {
      setState(() {
        _loadError = e.message;
        _isLoading = false;
      });
    }
  }

  ChildSummary? get _activeChild =>
      _children.where((c) => c.id == _activeChildId).cast<ChildSummary?>().firstOrNull;

  void _onLogout() => context.read<AuthState>().logout();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: _buildChildSwitcher(),
        actions: [
          IconButton(
            key: const Key('notificationsButton'),
            icon: _unreadNotifications > 0
                ? Badge(label: Text('$_unreadNotifications'), child: const Icon(Icons.notifications_none))
                : const Icon(Icons.notifications_none),
            tooltip: 'Notifications',
            onPressed: _openNotifications,
          ),
          IconButton(
            key: const Key('logoutButton'),
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: _onLogout,
          ),
        ],
      ),
      body: _buildBody(),
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
          const NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          const NavigationDestination(icon: Icon(Icons.calendar_month_outlined), label: 'Calendar'),
          NavigationDestination(
            icon: _unreadCirculars > 0
                ? Badge(label: Text('$_unreadCirculars'), child: const Icon(Icons.notifications_none))
                : const Icon(Icons.notifications_none),
            label: 'Notifications',
          ),
          const NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Messages'),
          const NavigationDestination(icon: Icon(Icons.receipt_long_outlined), label: 'Fees'),
          const NavigationDestination(icon: Icon(Icons.more_horiz), label: 'More'),
        ],
      ),
    );
  }

  Widget _buildChildSwitcher() {
    if (_isLoading) return const Text('School OS');
    if (_loadError != null) return const Text('School OS');
    if (_children.isEmpty) return const Text('School OS');

    return DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        key: const Key('childSwitcher'),
        value: _activeChildId,
        items: _children
            .map(
              (c) => DropdownMenuItem(
                value: c.id,
                child: Text('${c.name} — ${c.schoolClass} ${c.section}'),
              ),
            )
            .toList(),
        onChanged: (id) => setState(() => _activeChildId = id),
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
        initialConversationId: _messagesInitialConversationId,
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
      );
    }

    final labels = ['Home', 'Calendar', 'Notifications', 'Messages', 'Fees', 'More'];
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
