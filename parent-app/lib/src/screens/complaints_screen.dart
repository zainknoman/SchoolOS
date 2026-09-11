import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Complaints')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.children.length > 1)
            DropdownButtonFormField<String>(
              key: const Key('complaintsChildDropdown'),
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
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          if (_complaints == null && _error == null)
            const Center(child: CircularProgressIndicator())
          else if (_complaints != null && _complaints!.isEmpty)
            const Text('No complaints on record.')
          else if (_complaints != null)
            for (final c in _complaints!)
              Card(
                key: Key('complaint${c.id}'),
                child: ListTile(
                  title: Text(c.subject),
                  subtitle: Text(c.description),
                  trailing: Text(c.status),
                ),
              ),
        ],
      ),
    );
  }
}
