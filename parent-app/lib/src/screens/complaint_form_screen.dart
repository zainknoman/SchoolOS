import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';

/// A file the parent chose to attach (bytes are uploaded after the complaint is created).
class PickedAttachment {
  const PickedAttachment({required this.name, required this.bytes});
  final String name;
  final List<int> bytes;
}

typedef AttachmentPicker = Future<PickedAttachment?> Function();

Future<PickedAttachment?> _pickWithFilePicker() async {
  final file = await FilePicker.pickFile();
  if (file == null) return null;
  return PickedAttachment(name: file.name, bytes: await file.readAsBytes());
}

/// BL-30: a parent raises a complaint about their child — category, title, description and an
/// optional file (a photo or a document). Pops `true` once it is sent.
class ComplaintFormScreen extends StatefulWidget {
  const ComplaintFormScreen({
    super.key,
    required this.accessToken,
    required this.api,
    required this.studentId,
    this.pickAttachment = _pickWithFilePicker,
  });

  final String accessToken;
  final ApiClient api;
  final String studentId;

  /// Injectable so tests do not need the platform file picker.
  final AttachmentPicker pickAttachment;

  @override
  State<ComplaintFormScreen> createState() => _ComplaintFormScreenState();
}

class _ComplaintFormScreenState extends State<ComplaintFormScreen> {
  final _subject = TextEditingController();
  final _description = TextEditingController();
  String _category = 'OTHER';
  PickedAttachment? _attachment;
  String? _error;
  bool _sending = false;

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final picked = await widget.pickAttachment();
    if (picked != null && mounted) setState(() => _attachment = picked);
  }

  Future<void> _send() async {
    if (_subject.text.trim().isEmpty || _description.text.trim().isEmpty) {
      setState(() => _error = 'Please give your complaint a title and a description.');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final created = await widget.api.createComplaint(
        widget.accessToken,
        studentId: widget.studentId,
        category: _category,
        subject: _subject.text.trim(),
        description: _description.text.trim(),
      );
      final file = _attachment;
      if (file != null) {
        try {
          await widget.api.addComplaintAttachment(
            widget.accessToken,
            created.id,
            bytes: file.bytes,
            filename: file.name,
          );
        } on ApiException catch (e) {
          // The complaint itself was sent; tell the parent the file was not.
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Complaint sent, but the file was not attached: ${e.message}')),
            );
          }
        }
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    return Scaffold(
      appBar: pageAppBar(context, 'New complaint'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        children: [
          const FieldLabel('Category'),
          DropdownButtonFormField<String>(
            key: const Key('complaintCategory'),
            initialValue: _category,
            isDense: true,
            decoration: fieldDecoration(),
            items: [
              for (final e in complaintCategories.entries) DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) => setState(() => _category = v ?? 'OTHER'),
          ),
          const SizedBox(height: 14),
          const FieldLabel('Title'),
          TextField(key: const Key('complaintSubject'), controller: _subject, decoration: fieldDecoration()),
          const SizedBox(height: 14),
          const FieldLabel('What happened?'),
          TextField(
            key: const Key('complaintDescription'),
            controller: _description,
            minLines: 4,
            maxLines: 8,
            decoration: fieldDecoration(),
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            key: const Key('complaintAttach'),
            onPressed: _sending ? null : _pick,
            icon: const Icon(Icons.attach_file),
            label: Text(_attachment == null ? 'Attach a photo or file (optional)' : _attachment!.name),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: tones.absent)),
          ],
          const SizedBox(height: 18),
          ElevatedButton(
            key: const Key('complaintSend'),
            onPressed: _sending ? null : _send,
            child: Text(_sending ? 'Sending…' : 'Send complaint'),
          ),
        ],
      ),
    );
  }
}
