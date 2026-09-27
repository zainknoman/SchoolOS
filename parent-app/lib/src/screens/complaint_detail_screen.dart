import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/tones.dart';
import '../widgets/parent_ui.dart';
import '../widgets/open_download.dart';

/// BL-30: one complaint as the parent sees it — status, the school's replies, the resolution and
/// attached files (never the school's internal notes). A parent may add a comment to their own.
class ComplaintDetailScreen extends StatefulWidget {
  const ComplaintDetailScreen({super.key, required this.accessToken, required this.api, required this.complaintId});

  final String accessToken;
  final ApiClient api;
  final String complaintId;

  @override
  State<ComplaintDetailScreen> createState() => _ComplaintDetailScreenState();
}

class _ComplaintDetailScreenState extends State<ComplaintDetailScreen> {
  Complaint? _complaint;
  String? _error;
  final _comment = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final c = await widget.api.complaint(widget.accessToken, widget.complaintId);
      if (mounted) setState(() => _complaint = c);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _send() async {
    final text = _comment.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      final c = await widget.api.addComplaintComment(widget.accessToken, widget.complaintId, text);
      _comment.clear();
      if (mounted) setState(() => _complaint = c);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tones = Tones.of(context);
    final c = _complaint;
    return Scaffold(
      appBar: pageAppBar(context, 'Complaint'),
      body: c == null
          ? Center(child: _error != null ? Text(_error!) : const CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(c.subject, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    ),
                    StatusPill(label: c.status.replaceAll('_', ' '), color: StatusPill.colorFor(context, c.status)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${complaintCategories[c.category] ?? c.category} · ${c.createdAt.substring(0, 10)}',
                  style: TextStyle(fontSize: 12, color: tones.muted),
                ),
                const SizedBox(height: 12),
                Text(c.description),
                if (c.attachments.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  for (final a in c.attachments)
                    TextButton.icon(
                      key: Key('attachment_${a.id}'),
                      onPressed: () => openDownload(
                        context,
                        widget.api.fileDownloadUrl(a.fileId, widget.accessToken),
                      ),
                      icon: const Icon(Icons.attach_file, size: 18),
                      label: Text(a.originalName),
                    ),
                ],
                if (c.resolution != null) ...[
                  const SizedBox(height: 18),
                  const SectionLabel('Outcome'),
                  Text(c.resolution!, key: const Key('complaintResolution')),
                ],
                const SizedBox(height: 18),
                const SectionLabel('Replies'),
                if (c.responses.isEmpty)
                  Text('No replies yet.', style: TextStyle(color: tones.muted))
                else
                  for (final r in c.responses)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${r.fromSchool ? 'School' : 'You'} · ${r.createdAt.substring(0, 10)}',
                            style: TextStyle(fontSize: 12, color: tones.muted),
                          ),
                          Text(r.body),
                        ],
                      ),
                    ),
                if (c.raisedByMe) ...[
                  const SizedBox(height: 12),
                  TextField(
                    key: const Key('complaintComment'),
                    controller: _comment,
                    minLines: 2,
                    maxLines: 5,
                    decoration: fieldDecoration(hint: 'Add a comment'),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    key: const Key('complaintCommentSend'),
                    onPressed: _sending ? null : _send,
                    child: const Text('Send'),
                  ),
                ],
                if (_error != null) Text(_error!, style: TextStyle(color: tones.absent)),
              ],
            ),
    );
  }
}
