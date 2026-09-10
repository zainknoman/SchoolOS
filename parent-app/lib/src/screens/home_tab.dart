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