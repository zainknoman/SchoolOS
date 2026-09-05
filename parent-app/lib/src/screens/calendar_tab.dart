import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../cache/cached_load.dart';
import '../cache/data_cache.dart';
import '../cache/last_updated_banner.dart';
import '../theme/text_direction.dart';

const _dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const _dayColWidth = 72.0;
const _periodColWidth = 104.0;
const _breakColWidth = 84.0;

/// One column of the weekly timetable grid — either a real period (from the data) or an
/// auto-detected break between two periods. `period` is null for a break column.
class _TimetableColumn {
  const _TimetableColumn.period({
    required int this.period,
    required this.startTime,
    required this.endTime,
  }) : isBreak = false;
  const _TimetableColumn.breakColumn({
    required this.startTime,
    required this.endTime,
  }) : isBreak = true,
       period = null;

  final int? period;
  final String startTime;
  final String endTime;
  final bool isBreak;

  String get label => isBreak ? 'BREAK' : 'P$period';
  double get width => isBreak ? _breakColWidth : _periodColWidth;
}

int _minutesSinceMidnight(String hhmm) {
  final parts = hhmm.split(':');
  return int.parse(parts[0]) * 60 + int.parse(parts[1]);
}

/// Derives the grid's columns from whatever periods actually appear in the week's entries —
/// not a fixed period count — and inserts a BREAK column wherever two consecutive periods'
/// times leave a gap bigger than a normal passing period (10 minutes).
List<_TimetableColumn> _buildColumns(List<TimetableEntry> entries) {
  final periodTimes = <int, (String, String)>{};
  for (final e in entries) {
    periodTimes.putIfAbsent(e.period, () => (e.startTime, e.endTime));
  }
  final sortedPeriods = periodTimes.keys.toList()..sort();

  final columns = <_TimetableColumn>[];
  for (var i = 0; i < sortedPeriods.length; i++) {
    final period = sortedPeriods[i];
    final (start, end) = periodTimes[period]!;
    columns.add(
      _TimetableColumn.period(period: period, startTime: start, endTime: end),
    );

    if (i < sortedPeriods.length - 1) {
      final (nextStart, _) = periodTimes[sortedPeriods[i + 1]]!;
      final gapMinutes =
          _minutesSinceMidnight(nextStart) - _minutesSinceMidnight(end);
      if (gapMinutes > 10) {
        columns.add(
          _TimetableColumn.breakColumn(startTime: end, endTime: nextStart),
        );
      }
    }
  }
  return columns;
}

/// Calendar → Timetable / Attendance / Diary tabs, per the MVP plan.
class CalendarTab extends StatelessWidget {
  const CalendarTab({
    super.key,
    required this.studentId,
    required this.accessToken,
    required this.api,
    this.initialSubTab = 0,
  });

  final String studentId;
  final String accessToken;
  final ApiClient api;

  /// Which of the three sub-tabs (0 = Timetable, 1 = Attendance, 2 = Diary) should be shown
  /// first. Defaults to Timetable. Callers deep-linking into a specific sub-tab (e.g. a
  /// notification tap) pass a non-zero value here.
  final int initialSubTab;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      initialIndex: initialSubTab,
      child: Column(
        children: [
          const TabBar(
            tabs: [
              Tab(text: 'Timetable'),
              Tab(text: 'Attendance'),
              Tab(text: 'Diary'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _TimetableTab(
                  studentId: studentId,
                  accessToken: accessToken,
                  api: api,
                ),
                _AttendanceTab(
                  studentId: studentId,
                  accessToken: accessToken,
                  api: api,
                ),
                _DiaryTab(
                  studentId: studentId,
                  accessToken: accessToken,
                  api: api,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TimetableTab extends StatefulWidget {
  const _TimetableTab({
    required this.studentId,
    required this.accessToken,
    required this.api,
  });
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

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    if (_entries == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_entries!.isEmpty) {
      return const Center(child: Text('No timetable published yet.'));
    }

    final byDayPeriod = <int, Map<int, TimetableEntry>>{};
    for (final e in _entries!) {
      byDayPeriod.putIfAbsent(e.dayOfWeek, () => {})[e.period] = e;
    }
    final columns = _buildColumns(_entries!);
    final borderColor = Theme.of(context).colorScheme.outlineVariant;
    final gridWidth =
        _dayColWidth + columns.fold(0.0, (sum, c) => sum + c.width);

    Widget cell(
      String text,
      double width, {
      bool bold = false,
      bool muted = false,
      bool alignLeft = false,
      int maxLines = 1,
      String? sub,
    }) {
      return Container(
        width: width,
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        alignment: alignLeft ? Alignment.centerLeft : Alignment.center,
        decoration: BoxDecoration(
          border: Border(right: BorderSide(color: borderColor)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: alignLeft
              ? CrossAxisAlignment.start
              : CrossAxisAlignment.center,
          children: [
            Text(
              text,
              textAlign: alignLeft ? TextAlign.left : TextAlign.center,
              maxLines: maxLines,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: bold ? FontWeight.bold : FontWeight.normal,
                color: muted ? Theme.of(context).colorScheme.outline : null,
              ),
            ),
            if (sub != null)
              Text(
                sub,
                textAlign: TextAlign.center,
                maxLines: 1,
                softWrap: false,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: Theme.of(context).colorScheme.outline),
              ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'WEEKLY TIMETABLE',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Container(
              key: const Key('timetableGrid'),
              decoration: BoxDecoration(border: Border.all(color: borderColor)),
              child: Column(
                children: [
                  Row(
                    children: [
                      cell('DAY', _dayColWidth, bold: true),
                      for (final col in columns)
                        cell(
                          col.label,
                          col.width,
                          bold: true,
                          sub: '${col.startTime}-${col.endTime}',
                        ),
                    ],
                  ),
                  Divider(height: 1, thickness: 1, color: borderColor),
                  for (var day = 0; day < 7; day++) ...[
                    if (day > 0) Divider(height: 1, color: borderColor),
                    Row(
                      key: Key('timetableRow$day'),
                      children: [
                        cell(
                          _dayNames[day],
                          _dayColWidth,
                          bold: true,
                          alignLeft: true,
                        ),
                        if (byDayPeriod[day] == null ||
                            byDayPeriod[day]!.isEmpty)
                          cell('HOLIDAY', gridWidth - _dayColWidth, muted: true)
                        else
                          for (final col in columns)
                            col.isBreak
                                ? cell('BREAK', col.width, muted: true)
                                : cell(
                                    byDayPeriod[day]![col.period]?.subject ??
                                        '',
                                    col.width,
                                    maxLines: 2,
                                  ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendanceTab extends StatefulWidget {
  const _AttendanceTab({
    required this.studentId,
    required this.accessToken,
    required this.api,
  });
  final String studentId;
  final String accessToken;
  final ApiClient api;

  @override
  State<_AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<_AttendanceTab> {
  AttendanceReport? _report;
  String? _error;
  DateTime? _lastUpdated;
  bool _stale = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final month = DateTime.now().toIso8601String().substring(0, 7);
    final cache = await DataCache.open();
    await loadWithCache<AttendanceReport>(
      cache: cache,
      cacheKey: 'cache:attendance:${widget.studentId}:$month',
      fetch: () =>
          widget.api.attendance(widget.accessToken, widget.studentId, month),
      toJson: (report) => report.toJson(),
      fromJson: (json) =>
          AttendanceReport.fromJson(json as Map<String, dynamic>),
      onData: (data, lastUpdated, {required stale}) {
        if (mounted) {
          setState(() {
            _report = data;
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

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    final report = _report;
    if (report == null) return const Center(child: CircularProgressIndicator());

    final today = DateTime.now().toIso8601String().substring(0, 10);
    final todayEntry = report.days
        .where((d) => d.date == today)
        .cast<AttendanceDay?>()
        .firstOrNull;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Today: ${todayEntry?.status ?? 'Not marked yet'}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  '${report.summary.attendancePercentage}% attendance this month',
                ),
                Text(
                  'Present ${report.summary.present} · Absent ${report.summary.absent} · '
                  'Late ${report.summary.late} · Leave ${report.summary.leave} · '
                  'Holiday ${report.summary.holiday}',
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        for (final day in report.days.reversed)
          Card(
            key: Key('attendanceDay${day.date}'),
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              dense: true,
              title: Text(day.date),
              trailing: Text(day.status),
            ),
          ),
      ],
    );
  }
}

class _DiaryTab extends StatefulWidget {
  const _DiaryTab({
    required this.studentId,
    required this.accessToken,
    required this.api,
  });
  final String studentId;
  final String accessToken;
  final ApiClient api;

  @override
  State<_DiaryTab> createState() => _DiaryTabState();
}

class _DiaryTabState extends State<_DiaryTab> {
  List<DiaryEntry>? _entries;
  String? _error;
  DateTime? _lastUpdated;
  bool _stale = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final month = DateTime.now().toIso8601String().substring(0, 7);
    final cache = await DataCache.open();
    await loadWithCache<List<DiaryEntry>>(
      cache: cache,
      cacheKey: 'cache:diary:${widget.studentId}:$month',
      fetch: () =>
          widget.api.diary(widget.accessToken, widget.studentId, month),
      toJson: (entries) => entries.map((e) => e.toJson()).toList(),
      fromJson: (json) => (json as List<dynamic>)
          .map((e) => DiaryEntry.fromJson(e as Map<String, dynamic>))
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

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    if (_entries == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_entries!.isEmpty) {
      return const Center(child: Text('No diary entries yet.'));
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: LastUpdatedBanner(lastUpdated: _lastUpdated!, stale: _stale),
          ),
        ),
        Expanded(
          child: ListView.builder(
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
                          DirectionalText(
                            e.subject,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
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
                                    widget.api.fileDownloadUrl(
                                      a.id,
                                      widget.accessToken,
                                    ),
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
          ),
        ),
      ],
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
