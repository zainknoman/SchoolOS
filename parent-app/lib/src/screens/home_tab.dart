import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/text_direction.dart';
import '../theme/tones.dart';
import '../widgets/parent_header.dart';

const _monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// "2026-09-10" (or a full ISO timestamp) → "10 Sep". Falls back to the raw string if unparseable.
String formatShortDate(String iso) {
  final d = DateTime.tryParse(iso.length >= 10 ? iso.substring(0, 10) : iso);
  if (d == null) return iso;
  return '${d.day} ${_monthNames[d.month - 1]}';
}

String _relativeDay(String iso) {
  final published = DateTime.tryParse(iso)?.toLocal();
  if (published == null) return iso;
  final now = DateTime.now();
  final days = DateTime(
    now.year,
    now.month,
    now.day,
  ).difference(DateTime(published.year, published.month, published.day)).inDays;
  if (days == 0) return 'Today';
  if (days == 1) return 'Yesterday';
  return formatShortDate(published.toIso8601String());
}

String _groupThousands(int n) =>
    n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

String _titleCase(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1).toLowerCase();

/// Home tab (bottom-nav index 0), per the parent-app Home mockups: header (campus badge, greeting,
/// notification bell) → child-selector pills → the "three-question hierarchy" (Is my child at
/// school today? / Any fees due? / How did the last test go?) → announcements → today's timetable.
/// Fetches its own attendance/fees/timetable data (the same self-contained pattern `CalendarTab`
/// and `CircularsTab` use); circulars are passed down from `HomeShell`, which already fetches them
/// for the Circulars bottom-nav badge — avoids a redundant parent-scoped fetch every time the
/// active child changes.
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
    this.campusName,
    this.children = const [],
    this.activeChildId,
    this.onSelectChild,
    this.unreadNotifications = 0,
    this.onOpenNotifications,
    this.onOpenStudentInfo,
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

  /// The active child's campus — shown as the header's school name/badge. There's no school-name
  /// field on the parent API, so the campus is the closest real value to the mockup's school name.
  final String? campusName;
  final List<ChildSummary> children;
  final String? activeChildId;
  final ValueChanged<String>? onSelectChild;
  final int unreadNotifications;
  final VoidCallback? onOpenNotifications;

  /// Opens the Student information screen for the active child (the eye button beside the pills).
  final VoidCallback? onOpenStudentInfo;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  AttendanceReport? _attendance;
  String? _attendanceError;
  List<FeeVoucherSummary>? _vouchers;
  String? _feesError;
  List<TimetableEntry>? _timetable;
  String? _timetableError;

  @override
  void initState() {
    super.initState();
    _loadAttendance();
    _loadFees();
    _loadTimetable();
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

  Future<void> _loadTimetable() async {
    try {
      final entries = await widget.api.timetable(widget.accessToken, widget.studentId);
      if (mounted) setState(() => _timetable = entries);
    } on ApiException catch (e) {
      if (mounted) setState(() => _timetableError = e.message);
    }
  }

  String get _firstName => widget.childName.trim().split(RegExp(r'\s+')).first;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = theme.colorScheme.primary;
    final topAnnouncements = ([
      ...widget.circulars,
    ]..sort((a, b) => b.publishedAt.compareTo(a.publishedAt))).take(2).toList();

    // A SingleChildScrollView + Column (rather than ListView) so every child is built eagerly —
    // a ListView's SliverList estimates offscreen extents from already-laid-out siblings and can
    // stop building children that are well within the default 250px cache extent.
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _header(context, accent),
          if (widget.children.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ChildPills(
                    key: const Key('childSwitcher'),
                    children: widget.children,
                    activeChildId: widget.activeChildId,
                    onSelect: widget.onSelectChild ?? (_) {},
                  ),
                ),
                if (widget.onOpenStudentInfo != null)
                  IconButton(
                    key: const Key('viewStudentInfo'),
                    tooltip: 'Student information',
                    visualDensity: VisualDensity.compact,
                    icon: Icon(Icons.visibility_outlined, size: 20, color: accent),
                    onPressed: widget.onOpenStudentInfo,
                  ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          _attendanceCard(context),
          const SizedBox(height: 14),
          _feesCard(context, accent),
          const SizedBox(height: 14),
          _resultsCard(context),
          const SizedBox(height: 14),
          _announcementsCard(context, accent, topAnnouncements),
          const SizedBox(height: 14),
          _timetableCard(context),
        ],
      ),
    );
  }

  Widget _header(BuildContext context, Color accent) {
    final theme = Theme.of(context);
    final campus = widget.campusName;
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(10)),
          child: Text(
            campus != null ? initialsOf(campus) : 'S',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (campus != null)
                Text(
                  campus,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
              Text(
                'Assalam-o-Alaikum',
                style: theme.textTheme.bodySmall?.copyWith(color: Tones.of(context).muted),
              ),
            ],
          ),
        ),
        if (widget.onOpenNotifications != null)
          NotificationBell(
            unreadCount: widget.unreadNotifications,
            onPressed: widget.onOpenNotifications!,
          ),
      ],
    );
  }

  Widget _questionCard(
    BuildContext context, {
    required Key key,
    required IconData icon,
    required Color tone,
    required String question,
    required String answer,
    Color? answerColor,
    Widget? trailing,
    VoidCallback? onTap,
    bool muted = false,
  }) {
    final theme = Theme.of(context);
    return Opacity(
      opacity: muted ? 0.5 : 1,
      child: Card(
        key: key,
        margin: EdgeInsets.zero,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Tones.tint(tone),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 20, color: tone),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        question,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: Tones.of(context).muted,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        answer,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: answerColor,
                        ),
                      ),
                    ],
                  ),
                ),
                ?trailing,
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _attendanceCard(BuildContext context) {
    final tones = Tones.of(context);
    final report = _attendance;
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final todayEntry = report?.days
        .where((d) => d.date == today)
        .cast<AttendanceDay?>()
        .firstOrNull;

    String answer;
    Color? color;
    if (report != null) {
      answer = todayEntry != null ? _titleCase(todayEntry.status) : 'Not marked yet';
      color = todayEntry != null ? tones.forStatus(todayEntry.status) : null;
    } else {
      answer = _attendanceError != null ? '—' : '…';
    }

    return _questionCard(
      context,
      key: const Key('homeAttendanceCard'),
      icon: Icons.check,
      tone: color ?? tones.present,
      question: 'Is $_firstName at school today?',
      answer: answer,
      answerColor: color,
      trailing: report != null
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${report.summary.attendancePercentage}%',
                  style: Theme.of(context).textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                Text(
                  'this month',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(color: tones.muted),
                ),
              ],
            )
          : (_attendanceError != null
                ? Text('Unavailable', style: Theme.of(context).textTheme.labelSmall)
                : null),
    );
  }

  Widget _feesCard(BuildContext context, Color accent) {
    final tones = Tones.of(context);
    final vouchers = _vouchers;
    String answer;
    Color? color;
    Widget? trailing;
    if (vouchers != null) {
      final unpaid = vouchers.where((v) => v.amountDue > 0).toList()
        ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
      final due = unpaid.fold<int>(0, (sum, v) => sum + v.amountDue);
      if (due > 0) {
        answer =
            'PKR ${_groupThousands((due / 100).round())} due ${formatShortDate(unpaid.first.dueDate)}';
        color = tones.late;
        trailing = Text(
          'Pay →',
          style: TextStyle(color: accent, fontSize: 12, fontWeight: FontWeight.w700),
        );
      } else {
        answer = 'All paid up';
        color = tones.present;
      }
    } else {
      answer = _feesError != null ? '—' : '…';
      if (_feesError != null) {
        trailing = Text('Unavailable', style: Theme.of(context).textTheme.labelSmall);
      }
    }

    return _questionCard(
      context,
      key: const Key('homeFeesCard'),
      icon: Icons.receipt_long_outlined,
      tone: color ?? tones.late,
      question: 'Any fees due?',
      answer: answer,
      answerColor: color,
      trailing: trailing,
      onTap: widget.onOpenFees,
    );
  }

  /// Report cards (the Results feature this card links to) have no per-test summary endpoint the
  /// Home tab can call yet — muted keeps the card visible as the third question of the hierarchy,
  /// per the roadmap's "hide/gray" instruction, rather than fabricating a mark.
  Widget _resultsCard(BuildContext context) {
    return _questionCard(
      context,
      key: const Key('homeResultsCard'),
      icon: Icons.fact_check_outlined,
      tone: Theme.of(context).colorScheme.primary,
      question: 'How did the last test go?',
      answer: 'Coming soon',
      muted: true,
    );
  }

  Widget _announcementsCard(BuildContext context, Color accent, List<CircularSummary> items) {
    final theme = Theme.of(context);
    final muted = Tones.of(context).muted;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Announcements',
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                InkWell(
                  key: const Key('homeSeeAllAnnouncements'),
                  onTap: widget.onSeeAllAnnouncements,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                    child: Text(
                      'See all',
                      style: TextStyle(color: accent, fontSize: 11.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (items.isEmpty) const Text('No announcements yet.'),
            for (var i = 0; i < items.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.only(top: 5),
                      decoration: BoxDecoration(
                        color: i == 0 ? accent : muted,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          DirectionalText(
                            items[i].title,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            _relativeDay(items[i].publishedAt),
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: muted,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _timetableCard(BuildContext context) {
    final theme = Theme.of(context);
    final muted = Tones.of(context).muted;
    final dow = DateTime.now().weekday % 7; // 0 = Sunday, matching TimetableEntry.dayOfWeek
    final today = (_timetable ?? const <TimetableEntry>[]).where((e) => e.dayOfWeek == dow).toList()
      ..sort((a, b) => a.period.compareTo(b.period));

    Widget body;
    if (_timetableError != null) {
      body = const Text('Unavailable');
    } else if (_timetable == null) {
      body = const Text('…');
    } else if (today.isEmpty) {
      body = Text('No periods today.', style: TextStyle(color: muted));
    } else {
      body = Column(
        children: [
          for (final e in today.take(3))
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  SizedBox(
                    width: 48,
                    child: Text(
                      e.startTime,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: muted,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      e.subject,
                      style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
        ],
      );
    }

    return Card(
      key: const Key('homeTimetableCard'),
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: widget.onOpenTimetable,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Today's timetable — $_firstName",
                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              body,
            ],
          ),
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
