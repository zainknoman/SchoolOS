import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';

/// Pushed from the "More" tab — a read-only list of complaints for the selected child. Staff
/// create/manage complaints; this screen has no compose UI, per this sprint's scope.
class ComplaintsScreen extends StatefulWidget {
  const ComplaintsScreen({
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
  State<ComplaintsScreen> createState() => _ComplaintsScreenState();
}

class _ComplaintsScreenState extends State<ComplaintsScreen> {
  late String _selectedChildId = widget.children.any((c) => c.id == widget.initialChildId)
      ? widget.initialChildId!
      : widget.children.first.id;
  List<Complaint>? _complaints;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _complaints = null;
      _error = null;
    });
    try {
      final complaints = await widget.api.complaints(widget.accessToken, _selectedChildId);
      if (mounted) setState(() => _complaints = complaints);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    final accent = Theme.of(context).colorScheme.primary;
    return Scaffold(
      appBar: pageAppBar(context, 'Complaints'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        children: [
          if (widget.children.length > 1) ...[
            const FieldLabel('Child'),
            DropdownButtonFormField<String>(
              key: const Key('complaintsChildDropdown'),
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
            const SizedBox(height: 14),
          ],
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Tones.tint(accent),
              border: Border.all(color: accent.withValues(alpha: 0.25)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              "Complaints on record — raised by school staff. Contact your child's teacher to discuss any of these.",
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: accent),
            ),
          ),
          const SizedBox(height: 14),
          if (_error != null) Text(_error!, style: TextStyle(color: tones.absent)),
          if (_complaints == null && _error == null)
            const Center(child: CircularProgressIndicator())
          else if (_complaints != null && _complaints!.isEmpty)
            Text('No complaints on record.', style: TextStyle(color: tones.muted))
          else if (_complaints != null)
            GroupedCard(
              children: [
                for (final c in _complaints!)
                  GroupedRow(
                    key: Key('complaint${c.id}'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                c.subject,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                              ),
                            ),
                            StatusPill(label: c.status, color: StatusPill.colorFor(context, c.status)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(c.description, style: TextStyle(fontSize: 12, color: tones.muted)),
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
