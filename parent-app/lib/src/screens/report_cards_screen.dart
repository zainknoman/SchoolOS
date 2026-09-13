import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Report Cards')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.children.length > 1)
            DropdownButtonFormField<String>(
              key: const Key('reportCardsChildDropdown'),
              initialValue: _selectedChildId,
              decoration: const InputDecoration(labelText: 'Child'),
              items: widget.children
                  .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() => _selectedChildId = value);
                _load();
              },
            ),
          const SizedBox(height: 12),
          if (_grades.isNotEmpty)
            for (final grade in _grades)
              Card(
                key: Key('subjectGrade${grade.subjectId}'),
                child: ListTile(
                  leading: const Icon(Icons.grade_outlined),
                  title: Text(grade.subjectName),
                  trailing: Text('${_formatPercent(grade.finalPercent)}%'),
                ),
              ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          if (_reportCards == null && _error == null)
            const Center(child: CircularProgressIndicator())
          else if (_reportCards != null && _reportCards!.isEmpty)
            const Text('No report cards uploaded yet.')
          else if (_reportCards != null)
            for (final card in _reportCards!)
              Card(
                key: Key('reportCard${card.id}'),
                child: ListTile(
                  leading: const Icon(Icons.description_outlined),
                  title: Text('Report card — ${card.createdAt.substring(0, 10)}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.download_outlined),
                    tooltip: 'Download report card',
                    onPressed: () => launchUrl(
                      widget.api.reportCardPdfUrl(card.id, widget.accessToken),
                      mode: LaunchMode.externalApplication,
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
