import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Leave Applications')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.children.length > 1)
            DropdownButtonFormField<String>(
              key: const Key('leaveChildDropdown'),
              initialValue: _selectedChildId,
              decoration: const InputDecoration(labelText: 'Child'),
              items: widget.children
                  .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() => _selectedChildId = value);
                _loadRequests();
              },
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  key: const Key('leaveStartDateButton'),
                  onPressed: () => _pickDate(isStart: true),
                  child: Text(_startDate == null ? 'Start date' : _isoDate(_startDate!)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  key: const Key('leaveEndDateButton'),
                  onPressed: () => _pickDate(isStart: false),
                  child: Text(_endDate == null ? 'End date' : _isoDate(_endDate!)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('leaveReasonField'),
            controller: _reasonController,
            decoration: const InputDecoration(labelText: 'Reason'),
            maxLines: 3,
          ),
          const SizedBox(height: 12),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          if (_success != null) Text(_success!, style: const TextStyle(color: Colors.green)),
          ElevatedButton(
            key: const Key('leaveSubmitButton'),
            onPressed: _isSubmitting ? null : _submit,
            child: Text(_isSubmitting ? 'Submitting…' : 'Submit request'),
          ),
          const SizedBox(height: 24),
          Text('Past requests', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          if (_requests == null)
            const Center(child: CircularProgressIndicator())
          else if (_requests!.isEmpty)
            const Text('No leave requests yet.')
          else
            for (final r in _requests!)
              Card(
                child: ListTile(
                  title: Text('${r.startDate} to ${r.endDate}'),
                  subtitle: Text(r.reason),
                  trailing: Text(r.status),
                ),
              ),
        ],
      ),
    );
  }
}
