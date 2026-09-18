import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../cache/cached_load.dart';
import '../cache/data_cache.dart';
import '../cache/last_updated_banner.dart';
import '../theme/text_direction.dart';
import '../theme/tones.dart';
import '../widgets/parent_header.dart';
import 'home_tab.dart' show formatShortDate;

const _dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const _fullDayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const _fullMonthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// Chip order for the day selector: Mon → Sat, then Sunday last (matches the mockup's Mon–Sun strip;
/// `TimetableEntry.dayOfWeek` is 0 = Sunday).
const _chipDays = [1, 2, 3, 4, 5, 6, 0];

/// Small bordered chevron button used by the Attendance and Diary month selectors.
Widget _monthArrowButton(BuildContext context, IconData icon, Key key, VoidCallback? onTap) {
  final theme = Theme.of(context);
  return InkWell(
    key: key,
    borderRadius: BorderRadius.circular(8),
    onTap: onTap,
    child: Opacity(
      opacity: onTap == null ? 0.35 : 1,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Icon(icon, size: 16),
      ),
    ),
  );
}

String _monthKey(DateTime m) => '${m.year}-${m.month.toString().padLeft(2, '0')}';

String _titleCase(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1).toLowerCase();

int _minutesSinceMidnight(String hhmm) {
  final parts = hhmm.split(':');
  return int.parse(parts[0]) * 60 + int.parse(parts[1]);
}

/// One row of a day's period list — either a real period or an auto-detected break between two
/// periods (a gap bigger than a normal 10-minute passing period).
class _PeriodRow {
  const _PeriodRow.period(TimetableEntry this.entry)
    : isBreak = false,
      startTime = '',
      endTime = '';
  const _PeriodRow.breakRow({required this.startTime, required this.endTime})
    : isBreak = true,
      entry = null;

  final TimetableEntry? entry;
  final bool isBreak;
  final String startTime;
  final String endTime;
}

List<_PeriodRow> _buildRows(List<TimetableEntry> dayEntries) {
  final sorted = [...dayEntries]..sort((a, b) => a.period.compareTo(b.period));
  final rows = <_PeriodRow>[];
  for (var i = 0; i < sorted.length; i++) {
    rows.add(_PeriodRow.period(sorted[i]));
    if (i < sorted.length - 1) {
      final gap =
          _minutesSinceMidnight(sorted[i + 1].startTime) - _minutesSinceMidnight(sorted[i].endTime);
      if (gap > 10) {
        rows.add(
          _PeriodRow.breakRow(startTime: sorted[i].endTime, endTime: sorted[i + 1].startTime),
        );
      }
    }
  }
  return rows;
}

/// Calendar → Timetable / Attendance / Diary tabs, per the MVP plan and the Calendar mockups: a
/// shared header ("Calendar" + the selected child + notification bell) above a 3-way segmented
/// sub-tab.
class CalendarTab extends StatelessWidget {
  const CalendarTab({
    super.key,
    required this.studentId,
    required this.accessToken,
    required this.api,
    this.initialSubTab = 0,
    this.childLabel,
    this.unreadNotifications = 0,
    this.onOpenNotifications,
  });

  final String studentId;
  final String accessToken;
  final ApiClient api;

  /// Which of the three sub-tabs (0 = Timetable, 1 = Attendance, 2 = Diary) should be shown
  /// first. Defaults to Timetable. Callers deep-linking into a specific sub-tab (e.g. a
  /// notification tap) pass a non-zero value here.
  final int initialSubTab;

  /// "Hania · 6-A" under the "Calendar" title; omitted when null.
  final String? childLabel;
  final int unreadNotifications;
  final VoidCallback? onOpenNotifications;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tones = Tones.of(context);
    final accent = theme.colorScheme.primary;
    return DefaultTabController(
      length: 3,
      initialIndex: initialSubTab,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Calendar',
                        style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      if (childLabel != null)
                        Text(
                          childLabel!,
                          style: theme.textTheme.bodySmall?.copyWith(color: tones.muted),
                        ),
                    ],
                  ),
                ),
                if (onOpenNotifications != null)
                  NotificationBell(
                    unreadCount: unreadNotifications,
                    onPressed: onOpenNotifications!,
                  ),
              ],
            ),
          ),
          Container(
            margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Tones.tint(tones.muted),
              borderRadius: BorderRadius.circular(10),
            ),
            child: TabBar(
              dividerColor: Colors.transparent,
              indicatorSize: TabBarIndicatorSize.tab,
              indicator: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(8)),
              labelColor: Colors.white,
              unselectedLabelColor: theme.colorScheme.onSurface,
              labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
              splashBorderRadius: BorderRadius.circular(8),
              tabs: const [
                Tab(height: 34, text: 'Timetable'),
                Tab(height: 34, text: 'Attendance'),
                Tab(height: 34, text: 'Diary'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _TimetableTab(studentId: studentId, accessToken: accessToken, api: api),
                _AttendanceTab(studentId: studentId, accessToken: accessToken, api: api),
                _DiaryTab(studentId: studentId, accessToken: accessToken, api: api),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TimetableTab extends StatefulWidget {
  const _TimetableTab({required this.studentId, required this.accessToken, required this.api});
  final String studentId;
  final String accessToken;
  final ApiClient api;

  @override
  State<_TimetableTab> createState() => _TimetableTabState();
}

class _TimetableTabState extends State<_TimetableTab> {
  List<TimetableEntry>? _entries;
  String? _error;
  DateTime? _lastUpdated;
  bool _stale = false;
  int _selectedDay = DateTime.now().weekday % 7;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final cache = await DataCache.open();
    await loadWithCache<List<TimetableEntry>>(
      cache: cache,
      cacheKey: 'cache:timetable:${widget.studentId}',
      fetch: () => widget.api.timetable(widget.accessToken, widget.studentId),
      toJson: (entries) => entries.map((e) => e.toJson()).toList(),
      fromJson: (json) => (json as List<dynamic>)
          .map((e) => TimetableEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
      onData: (data, lastUpdated, {required stale}) {
        if (mounted) {
          setState(() {
            _entries = data;
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

  /// The calendar date of weekday [dow] in the current Mon–Sun week.
  DateTime _dateForDay(int dow) {
    final now = DateTime.now();
    final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
    return monday.add(Duration(days: (dow + 6) % 7));
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    if (_entries == null) return const Center(child: CircularProgressIndicator());
    if (_entries!.isEmpty) return const Center(child: Text('No timetable published yet.'));

    final theme = Theme.of(context);
    final tones = Tones.of(context);
    final accent = theme.colorScheme.primary;
    final daysWithPeriods = {for (final e in _entries!) e.dayOfWeek};
    final rows = _buildRows(_entries!.where((e) => e.dayOfWeek == _selectedDay).toList());
    final selectedDate = _dateForDay(_selectedDay);

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 16),
      children: [
        SizedBox(
          height: 56,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            children: [
              for (final d in _chipDays)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 8),
                  child: _dayChip(
                    context,
                    d,
                    selected: d == _selectedDay,
                    hasPeriods: daysWithPeriods.contains(d),
                    accent: accent,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
              const SizedBox(height: 8),
              Text(
                '${_fullDayNames[_selectedDay]}, ${selectedDate.day} ${_fullMonthNames[selectedDate.month - 1]}'
                    .toUpperCase(),
                style: theme.textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: tones.muted,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 10),
              if (rows.isEmpty)
                Card(
                  key: const Key('timetableNoPeriods'),
                  margin: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(
                      '${_fullDayNames[_selectedDay]} has no periods · marked as a holiday',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: tones.muted, fontSize: 12),
                    ),
                  ),
                )
              else
                Card(
                  key: const Key('timetablePeriods'),
                  margin: EdgeInsets.zero,
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      for (var i = 0; i < rows.length; i++) ...[
                        if (i > 0) Divider(height: 1, color: theme.colorScheme.outlineVariant),
                        _periodRow(context, rows[i], accent),
                      ],
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _dayChip(
    BuildContext context,
    int dow, {
    required bool selected,
    required bool hasPeriods,
    required Color accent,
  }) {
    final theme = Theme.of(context);
    final muted = Tones.of(context).muted;
    final date = _dateForDay(dow);
    final fg = selected ? Colors.white : theme.colorScheme.onSurface;
    return Opacity(
      opacity: hasPeriods || selected ? 1 : 0.6,
      child: InkWell(
        key: Key('timetableDay$dow'),
        borderRadius: BorderRadius.circular(12),
        onTap: () => setState(() => _selectedDay = dow),
        child: Container(
          width: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? accent : (hasPeriods ? theme.colorScheme.surface : Tones.tint(muted)),
            borderRadius: BorderRadius.circular(12),
            border: selected ? null : Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _dayNames[dow].toUpperCase(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white70 : muted,
                ),
              ),
              Text(
                '${date.day}',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: fg),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _periodRow(BuildContext context, _PeriodRow row, Color accent) {
    final theme = Theme.of(context);
    final tones = Tones.of(context);
    final mono = theme.textTheme.labelMedium?.copyWith(color: tones.muted, fontFamily: 'monospace');

    if (row.isBreak) {
      return Container(
        color: Tones.tint(tones.muted).withValues(alpha: 0.05),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Tones.tint(tones.muted),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.local_cafe_outlined, size: 15, color: tones.muted),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Break',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                      color: tones.muted,
                    ),
                  ),
                  Text('${row.startTime} – ${row.endTime}', style: mono),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final e = row.entry!;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Tones.tint(accent),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              'P${e.period}',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: accent),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  e.subject,
                  style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text('${e.startTime} – ${e.endTime}', style: mono),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceTab extends StatefulWidget {
  const _AttendanceTab({required this.studentId, required this.accessToken, required this.api});
  final String studentId;
  final String accessToken;
  final ApiClient api;

  @override
  State<_AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<_AttendanceTab> {
  AttendanceReport? _report;
  List<Holiday> _holidays = [];
  String? _error;
  DateTime? _lastUpdated;
  bool _stale = false;
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  bool get _isCurrentMonth {
    final now = DateTime.now();
    return _month.year == now.year && _month.month == now.month;
  }

  @override
  void initState() {
    super.initState();
    _load();
    _loadHolidays();
  }

  Future<void> _load() async {
    final month = _monthKey(_month);
    final cache = await DataCache.open();
    await loadWithCache<AttendanceReport>(
      cache: cache,
      cacheKey: 'cache:attendance:${widget.studentId}:$month',
      fetch: () => widget.api.attendance(widget.accessToken, widget.studentId, month),
      toJson: (report) => report.toJson(),
      fromJson: (json) => AttendanceReport.fromJson(json as Map<String, dynamic>),
      onData: (data, lastUpdated, {required stale}) {
        // A slow response for a month the user has already navigated away from must not overwrite
        // the month now on screen.
        if (mounted && month == _monthKey(_month)) {
          setState(() {
            _report = data;
            _lastUpdated = lastUpdated;
            _stale = stale;
            _error = null;
          });
        }
      },
      onError: (message) {
        if (mounted && month == _monthKey(_month)) setState(() => _error = message);
      },
    );
  }

  Future<void> _loadHolidays() async {
    try {
      final holidays = await widget.api.holidays(widget.accessToken);
      if (mounted) setState(() => _holidays = holidays);
    } catch (_) {
      // Non-critical overlay — the attendance report already renders without it.
    }
  }

  void _shiftMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
      _report = null;
      _error = null;
    });
    _load();
  }

  Holiday? _holidayFor(String isoDate) {
    for (final h in _holidays) {
      if (h.covers(isoDate)) return h;
    }
    return null;
  }

  /// Holidays overlapping the month on screen (ISO date strings compare correctly lexicographically).
  List<Holiday> get _monthHolidays {
    final first = '${_monthKey(_month)}-01';
    final last = '${_monthKey(_month)}-31';
    return _holidays
        .where((h) => h.startDate.compareTo(last) <= 0 && h.endDate.compareTo(first) >= 0)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    final report = _report;
    final theme = Theme.of(context);
    final tones = Tones.of(context);

    final monthSelector = Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _monthArrow(
          context,
          Icons.chevron_left,
          const Key('attendancePrevMonth'),
          () => _shiftMonth(-1),
        ),
        Text(
          '${_fullMonthNames[_month.month - 1]} ${_month.year}',
          style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        _monthArrow(
          context,
          Icons.chevron_right,
          const Key('attendanceNextMonth'),
          _isCurrentMonth ? null : () => _shiftMonth(1),
        ),
      ],
    );

    if (report == null) {
      return Column(
        children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 14, 20, 0), child: monthSelector),
          const Expanded(child: Center(child: CircularProgressIndicator())),
        ],
      );
    }

    final today = DateTime.now().toIso8601String().substring(0, 10);
    final todayEntry = report.days.where((d) => d.date == today).cast<AttendanceDay?>().firstOrNull;
    final pct = report.summary.attendancePercentage;
    final band = pct >= 90 ? tones.present : (pct >= 75 ? tones.late : tones.absent);
    final holidays = _monthHolidays;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
      children: [
        monthSelector,
        const SizedBox(height: 4),
        LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
        const SizedBox(height: 10),
        Card(
          key: const Key('attendanceHero'),
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ATTENDANCE THIS MONTH',
                            style: theme.textTheme.labelSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: tones.muted,
                              letterSpacing: 0.5,
                            ),
                          ),
                          Text(
                            '$pct%',
                            style: TextStyle(
                              fontSize: 34,
                              fontWeight: FontWeight.w800,
                              color: band,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_isCurrentMonth)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            todayEntry != null ? _titleCase(todayEntry.status) : 'Not marked yet',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            'Today',
                            style: theme.textTheme.labelSmall?.copyWith(color: tones.muted),
                          ),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(9999),
                  child: LinearProgressIndicator(
                    value: (pct.clamp(0, 100)) / 100,
                    minHeight: 8,
                    color: band,
                    backgroundColor: Tones.tint(band),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 14,
                  runSpacing: 6,
                  children: [
                    _legend(context, tones.present, report.summary.present, 'Present'),
                    _legend(context, tones.absent, report.summary.absent, 'Absent'),
                    _legend(context, tones.late, report.summary.late, 'Late'),
                    _legend(context, tones.leave, report.summary.leave, 'Leave'),
                    _legend(context, tones.muted, report.summary.holiday, 'Holiday'),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (holidays.isNotEmpty) ...[
          const SizedBox(height: 14),
          Card(
            key: const Key('holidaysCard'),
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < holidays.length; i++)
                    Padding(
                      padding: EdgeInsets.only(top: i == 0 ? 0 : 10),
                      child: Row(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: Tones.tint(tones.holiday),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.event_outlined, size: 15, color: tones.holiday),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  holidays[i].title,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  '${formatShortDate(holidays[i].startDate)} – ${formatShortDate(holidays[i].endDate)}',
                                  style: theme.textTheme.labelSmall?.copyWith(color: tones.muted),
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
          ),
        ],
        const SizedBox(height: 14),
        Card(
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Text(
                  'Daily record',
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              for (final day in report.days.reversed) ...[
                Divider(height: 1, color: theme.colorScheme.outlineVariant),
                _dayRow(context, day),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _monthArrow(BuildContext context, IconData icon, Key key, VoidCallback? onTap) {
    final theme = Theme.of(context);
    return InkWell(
      key: key,
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.35 : 1,
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Icon(icon, size: 16),
        ),
      ),
    );
  }

  Widget _legend(BuildContext context, Color color, int count, String label) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          '$count',
          style: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w700,
            fontFamily: 'monospace',
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: theme.textTheme.labelSmall?.copyWith(color: Tones.of(context).muted)),
      ],
    );
  }

  Widget _dayRow(BuildContext context, AttendanceDay day) {
    final theme = Theme.of(context);
    final tones = Tones.of(context);
    final parsed = DateTime.tryParse(day.date);
    final label = parsed != null
        ? '${_dayNames[parsed.weekday % 7]}, ${formatShortDate(day.date)}'
        : day.date;
    final holiday = _holidayFor(day.date);
    return Padding(
      key: Key('attendanceDay${day.date}'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                if (holiday != null)
                  Text(
                    'Holiday: ${holiday.title}',
                    style: theme.textTheme.labelSmall?.copyWith(color: tones.muted),
                  ),
              ],
            ),
          ),
          TonePill(label: _titleCase(day.status), color: tones.forStatus(day.status)),
        ],
      ),
    );
  }
}

class _DiaryTab extends StatefulWidget {
  const _DiaryTab({required this.studentId, required this.accessToken, required this.api});
  final String studentId;
  final String accessToken;
  final ApiClient api;

  @override
  State<_DiaryTab> createState() => _DiaryTabState();
}

String _isoDate(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Diary: a month calendar on top (a dot marks days with entries; like the timetable's day chips,
/// the selected day fills with the accent) and, below it, the diary cards for just that day.
class _DiaryTabState extends State<_DiaryTab> {
  List<DiaryEntry>? _entries;
  String? _error;
  DateTime? _lastUpdated;
  bool _stale = false;
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  late DateTime _selected = DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);

  bool get _isCurrentMonth {
    final now = DateTime.now();
    return _month.year == now.year && _month.month == now.month;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final month = _monthKey(_month);
    final cache = await DataCache.open();
    await loadWithCache<List<DiaryEntry>>(
      cache: cache,
      cacheKey: 'cache:diary:${widget.studentId}:$month',
      fetch: () => widget.api.diary(widget.accessToken, widget.studentId, month),
      toJson: (entries) => entries.map((e) => e.toJson()).toList(),
      fromJson: (json) => (json as List<dynamic>)
          .map((e) => DiaryEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
      onData: (data, lastUpdated, {required stale}) {
        // Ignore a slow response for a month the user has already navigated away from.
        if (mounted && month == _monthKey(_month)) {
          setState(() {
            _entries = data;
            _lastUpdated = lastUpdated;
            _stale = stale;
            _error = null;
          });
        }
      },
      onError: (message) {
        if (mounted && month == _monthKey(_month)) setState(() => _error = message);
      },
    );
  }

  void _shiftMonth(int delta) {
    final next = DateTime(_month.year, _month.month + delta);
    final now = DateTime.now();
    setState(() {
      _month = next;
      // Land on today when returning to the current month, otherwise on the 1st.
      _selected = (next.year == now.year && next.month == now.month)
          ? DateTime(now.year, now.month, now.day)
          : next;
      _entries = null;
      _error = null;
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tones = Tones.of(context);
    final entries = _entries ?? const <DiaryEntry>[];
    final datesWithEntries = {
      for (final e in entries) e.date.length < 10 ? e.date : e.date.substring(0, 10),
    };
    final selectedIso = _isoDate(_selected);
    final dayEntries = entries.where((e) => e.date.startsWith(selectedIso)).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _monthArrowButton(
              context,
              Icons.chevron_left,
              const Key('diaryPrevMonth'),
              () => _shiftMonth(-1),
            ),
            Text(
              '${_fullMonthNames[_month.month - 1]} ${_month.year}',
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            _monthArrowButton(
              context,
              Icons.chevron_right,
              const Key('diaryNextMonth'),
              _isCurrentMonth ? null : () => _shiftMonth(1),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _calendar(context, datesWithEntries),
        if (_error == null && _entries != null) ...[
          const SizedBox(height: 4),
          LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
        ],
        const SizedBox(height: 10),
        Text(
          '${_fullDayNames[_selected.weekday % 7]}, ${_selected.day} ${_fullMonthNames[_selected.month - 1]}'
              .toUpperCase(),
          style: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: tones.muted,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 10),
        if (_error != null)
          Center(child: Text(_error!))
        else if (_entries == null)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (dayEntries.isEmpty)
          Card(
            key: const Key('diaryNoEntries'),
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Text(
                'No diary entries for this day.',
                textAlign: TextAlign.center,
                style: TextStyle(color: tones.muted, fontSize: 12),
              ),
            ),
          )
        else
          for (final e in dayEntries) _entryCard(context, e),
      ],
    );
  }

  Widget _calendar(BuildContext context, Set<String> datesWithEntries) {
    final theme = Theme.of(context);
    final muted = Tones.of(context).muted;
    final accent = theme.colorScheme.primary;
    final first = DateTime(_month.year, _month.month);
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final leading = (first.weekday + 6) % 7; // Monday-first grid
    final cells = <DateTime?>[
      for (var i = 0; i < leading; i++) null,
      for (var d = 1; d <= daysInMonth; d++) DateTime(_month.year, _month.month, d),
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    final today = DateTime.now();

    return Card(
      key: const Key('diaryCalendar'),
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          children: [
            Row(
              children: [
                for (final d in const ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
                  Expanded(
                    child: Center(
                      child: Text(
                        d,
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: muted),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            for (var r = 0; r < cells.length ~/ 7; r++)
              Row(
                children: [
                  for (var c = 0; c < 7; c++)
                    Expanded(
                      child: _dayCell(context, cells[r * 7 + c], datesWithEntries, accent, today),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _dayCell(
    BuildContext context,
    DateTime? day,
    Set<String> datesWithEntries,
    Color accent,
    DateTime today,
  ) {
    if (day == null) return const SizedBox(height: 40);
    final iso = _isoDate(day);
    final selected = iso == _isoDate(_selected);
    final isToday = iso == _isoDate(today);
    final hasEntries = datesWithEntries.contains(iso);
    final fg = selected ? Colors.white : Theme.of(context).colorScheme.onSurface;
    return Padding(
      padding: const EdgeInsets.all(2),
      child: InkWell(
        key: Key('diaryDay$iso'),
        borderRadius: BorderRadius.circular(10),
        onTap: () => setState(() => _selected = day),
        child: Container(
          height: 36,
          decoration: BoxDecoration(
            color: selected ? accent : null,
            borderRadius: BorderRadius.circular(10),
            border: (isToday && !selected) ? Border.all(color: accent) : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${day.day}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: selected || isToday ? FontWeight.w800 : FontWeight.w600,
                  color: fg,
                ),
              ),
              SizedBox(
                height: 6,
                child: hasEntries
                    ? Container(
                        key: Key('diaryDot$iso'),
                        width: 5,
                        height: 5,
                        margin: const EdgeInsets.only(top: 1),
                        decoration: BoxDecoration(
                          color: selected ? Colors.white : accent,
                          shape: BoxShape.circle,
                        ),
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _entryCard(BuildContext context, DiaryEntry e) {
    final theme = Theme.of(context);
    final tones = Tones.of(context);
    return Card(
      key: Key('diaryEntry${e.id}'),
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(
                  child: DirectionalText(
                    e.subject,
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  formatShortDate(e.date),
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: tones.muted,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            DirectionalText(e.text),
            if (e.dueDate != null || e.attachments.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (e.dueDate != null)
                    TonePill(label: 'Due ${formatShortDate(e.dueDate!)}', color: tones.late),
                  for (final a in e.attachments) _attachmentChip(context, a),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _attachmentChip(BuildContext context, DiaryAttachment a) {
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => launchUrl(
        widget.api.fileDownloadUrl(a.id, widget.accessToken),
        mode: LaunchMode.externalApplication,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.attach_file, size: 13, color: Tones.of(context).muted),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                a.originalName,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
