import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';

/// Pushed from the "More" tab (not a bottom-nav tab itself) — a submit form (child picker only
/// when there's more than one child) plus a status list of past requests for the selected child.
class LeaveScreen extends StatefulWidget {
  const LeaveScreen({
    super.key,
    required this.accessToken,
    required this.api,
    required this.children,
    this.initialChildId,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  /// The child currently selected in HomeShell's top switcher, if any (null when LeaveScreen is
  /// reached from a context with no active-child concept). Falls back to children.first when null
  /// or when it doesn't match any child actually passed in.
  final String? initialChildId;

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  late String _selectedChildId = widget.children.any((c) => c.id == widget.initialChildId)
      ? widget.initialChildId!
      : widget.children.first.id;
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;
  String? _success;
  List<LeaveRequestSummary>? _requests;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    try {
      final requests = await widget.api.leaveRequests(widget.accessToken, _selectedChildId);
      if (mounted) setState(() => _requests = requests);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _pickDate({required bool isStart}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
      initialDate: now,
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
      } else {
        _endDate = picked;
      }
    });
  }

  String _isoDate(DateTime d) => d.toIso8601String().substring(0, 10);

  Future<void> _submit() async {
    final start = _startDate;
    final end = _endDate;
    if (start == null || end == null || _reasonController.text.trim().isEmpty) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    try {
      await widget.api.submitLeaveRequest(
        widget.accessToken,
        studentId: _selectedChildId,
        startDate: _isoDate(start),
        endDate: _isoDate(end),
        reason: _reasonController.text.trim(),
      );
      _reasonController.clear();
      setState(() {
        _startDate = null;
        _endDate = null;
        _success = 'Leave request submitted.';
      });
      await _loadRequests();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    return Scaffold(
      appBar: pageAppBar(context, 'Leave Applications'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.children.length > 1) ...[
                    const FieldLabel('Child'),
                    DropdownButtonFormField<String>(
                      key: const Key('leaveChildDropdown'),
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
                        _loadRequests();
                      },
                    ),
                    const SizedBox(height: 14),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: _DateButton(
                          key: const Key('leaveStartDateButton'),
                          label: 'Start date',
                          value: _startDate == null ? 'Select' : _isoDate(_startDate!),
                          onPressed: () => _pickDate(isStart: true),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _DateButton(
                          key: const Key('leaveEndDateButton'),
                          label: 'End date',
                          value: _endDate == null ? 'Select' : _isoDate(_endDate!),
                          onPressed: () => _pickDate(isStart: false),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const FieldLabel('Reason'),
                  TextField(
                    key: const Key('leaveReasonField'),
                    controller: _reasonController,
                    decoration: fieldDecoration(),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 14),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(_error!, style: TextStyle(color: tones.absent)),
                    ),
                  if (_success != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(_success!, style: TextStyle(color: tones.present)),
                    ),
                  FilledButton(
                    key: const Key('leaveSubmitButton'),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _isSubmitting ? null : _submit,
                    child: Text(_isSubmitting ? 'Submitting…' : 'Submit request'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          const SectionLabel('Past requests'),
          if (_requests == null)
            const Center(child: CircularProgressIndicator())
          else if (_requests!.isEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 2),
              child: Text('No leave requests yet.', style: TextStyle(color: tones.muted)),
            )
          else
            GroupedCard(
              children: [
                for (final r in _requests!)
                  GroupedRow(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${r.startDate} to ${r.endDate}',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                              ),
                              Text(r.reason, style: TextStyle(fontSize: 11.5, color: tones.muted)),
                              if (r.decisionNote != null)
                                Text(
                                  'School: ${r.decisionNote}',
                                  key: Key('leaveDecisionNote${r.id}'),
                                  style: const TextStyle(fontSize: 11.5, fontStyle: FontStyle.italic),
                                ),
                            ],
                          ),
                        ),
                        StatusPill(label: r.status, color: StatusPill.colorFor(context, r.status)),
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

class _DateButton extends StatelessWidget {
  const _DateButton({super.key, required this.label, required this.value, required this.onPressed});

  final String label;
  final String value;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(fontSize: 10, color: Tones.of(context).muted, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
