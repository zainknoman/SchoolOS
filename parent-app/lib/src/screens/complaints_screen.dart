import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';
import 'complaint_detail_screen.dart';
import 'complaint_form_screen.dart';

/// Pushed from the "More" tab — the selected child's complaints: the ones this parent raised and
/// those the school recorded (BL-30). Tap one for replies, the resolution and files; "New
/// complaint" raises one about the selected child.
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

  Future<void> _compose() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ComplaintFormScreen(
          accessToken: widget.accessToken,
          api: widget.api,
          studentId: _selectedChildId,
        ),
      ),
    );
    if (created == true) await _load();
  }

  Future<void> _open(Complaint c) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ComplaintDetailScreen(accessToken: widget.accessToken, api: widget.api, complaintId: c.id),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    final accent = Theme.of(context).colorScheme.primary;
    return Scaffold(
      appBar: pageAppBar(context, 'Complaints'),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('newComplaintButton'),
        onPressed: _compose,
        icon: const Icon(Icons.add),
        label: const Text('New complaint'),
      ),
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
              'Raise a concern with the school here. You will see its status, the school\'s replies and the outcome.',
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
                    onTap: () => _open(c),
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
                            StatusPill(
                              label: c.status.replaceAll('_', ' '),
                              color: StatusPill.colorFor(context, c.status),
                            ),
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
