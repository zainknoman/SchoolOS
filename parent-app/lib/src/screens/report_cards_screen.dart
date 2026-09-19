import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';

/// Pushed from the "More" tab — lists report cards for the selected child; tapping one opens its
/// PDF via url_launcher, the same pattern fees_tab/circulars_tab already use for receipts and
/// circular attachments.
class ReportCardsScreen extends StatefulWidget {
  const ReportCardsScreen({
    super.key,
    required this.accessToken,
    required this.api,
    required this.children,
    this.initialChildId,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;
  final String? initialChildId;

  @override
  State<ReportCardsScreen> createState() => _ReportCardsScreenState();
}

// The API always rounds finalPercent to at most one decimal place, but a whole-number grade
// still arrives as e.g. 27.0 — format without a trailing ".0" so "27%" reads naturally.
String _formatPercent(double value) {
  if (value == value.roundToDouble()) return value.toInt().toString();
  return value.toStringAsFixed(1);
}

class _ReportCardsScreenState extends State<ReportCardsScreen> {
  late String _selectedChildId = widget.children.any((c) => c.id == widget.initialChildId)
      ? widget.initialChildId!
      : widget.children.first.id;
  List<ReportCard>? _reportCards;
  List<SubjectGrade> _grades = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _reportCards = null;
      _grades = [];
      _error = null;
    });
    try {
      final cards = await widget.api.reportCards(widget.accessToken, _selectedChildId);
      if (mounted) setState(() => _reportCards = cards);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
    await _loadGrades();
  }

  // Best-effort, same as AdminHomeView.vue's "non-critical, swallow and continue" precedent for a
  // secondary data source — a failure loading structured grades must never block the existing PDF
  // report-card list. NOTE: there is no term-selection UI here and no "current term" concept in
  // the backend yet (Term has no isActive flag), so this passes an empty termId placeholder; until
  // a term picker/resolution exists this will return an empty grades list against the real API.
  Future<void> _loadGrades() async {
    try {
      final grades = await widget.api.studentGrades(widget.accessToken, _selectedChildId, '');
      if (mounted) setState(() => _grades = grades);
    } catch (_) {
      // Convenience only — see comment above.
    }
  }

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    return Scaffold(
      appBar: pageAppBar(context, 'Report Cards'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        children: [
          if (widget.children.length > 1) ...[
            const FieldLabel('Child'),
            DropdownButtonFormField<String>(
              key: const Key('reportCardsChildDropdown'),
              initialValue: _selectedChildId,
              isDense: true,
              decoration: fieldDecoration(),
              items: widget.children
                  .map(
                    (c) => DropdownMenuItem(
                      value: c.id,
                      child: Text('${c.name} — ${c.schoolClass} ${c.section}'),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() => _selectedChildId = value);
                _load();
              },
            ),
            const SizedBox(height: 16),
          ],
          if (_grades.isNotEmpty) ...[
            const SectionLabel('Grades'),
            GroupedCard(
              children: [
                for (final grade in _grades)
                  GroupedRow(
                    key: Key('subjectGrade${grade.subjectId}'),
                    child: Row(
                      children: [
                        const IconBadge(Icons.grade_outlined),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            grade.subjectName,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                          ),
                        ),
                        Text(
                          '${_formatPercent(grade.finalPercent)}%',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
          ],
          const SectionLabel('Report card PDFs'),
          if (_error != null) Text(_error!, style: TextStyle(color: tones.absent)),
          if (_reportCards == null && _error == null)
            const Center(child: CircularProgressIndicator())
          else if (_reportCards != null && _reportCards!.isEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 2),
              child: Text('No report cards uploaded yet.', style: TextStyle(color: tones.muted)),
            )
          else if (_reportCards != null)
            GroupedCard(
              children: [
                for (final card in _reportCards!)
                  GroupedRow(
                    key: Key('reportCard${card.id}'),
                    child: Row(
                      children: [
                        const IconBadge(Icons.description_outlined, neutral: true),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Report card — ${card.createdAt.substring(0, 10)}',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                          ),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          icon: Icon(Icons.download_outlined, size: 18, color: tones.muted),
                          tooltip: 'Download report card',
                          onPressed: () => launchUrl(
                            widget.api.reportCardPdfUrl(card.id, widget.accessToken),
                            mode: LaunchMode.externalApplication,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
