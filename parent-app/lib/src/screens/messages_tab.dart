import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/text_direction.dart';

enum _MessagesView { list, compose, thread }

String recipientLabel(String recipientType) {
  switch (recipientType) {
    case 'CLASS_TEACHER':
      return 'Class Teacher';
    case 'SCHOOL_ADMIN':
      return 'Admin';
    case 'ACCOUNTS':
      return 'Accounts';
    case 'PRINCIPAL':
      return 'Principal';
    default:
      return recipientType;
  }
}

/// Messages bottom-nav tab: a conversation list, a new-conversation compose flow (child picker
/// shown only when messaging the Class Teacher, since Admin/Accounts/Principal are school-wide),
/// and a thread view with reply.
class MessagesTab extends StatefulWidget {
  const MessagesTab({super.key, required this.accessToken, required this.api, required this.children});

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  @override
  State<MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<MessagesTab> {
  _MessagesView _view = _MessagesView.list;
  List<ConversationSummary>? _conversations;
  String? _error;
  String? _openConversationId;
  ConversationDetail? _openConversation;

  @override
  void initState() {
    super.initState();
    _loadList();
  }

  Future<void> _loadList() async {
    try {
      final conversations = await widget.api.conversations(widget.accessToken);
      if (mounted) setState(() => _conversations = conversations);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _openThread(String id) async {
    setState(() {
      _view = _MessagesView.thread;
      _openConversationId = id;
      _openConversation = null;
    });
    await _refreshThread();
    try {
      await widget.api.markConversationRead(widget.accessToken, id);
      await _loadList();
    } on ApiException catch (_) {
      // Marking read is a convenience — the thread itself already loaded successfully.
    }
  }

  Future<void> _refreshThread() async {
    if (_openConversationId == null) return;
    try {
      final detail = await widget.api.conversation(widget.accessToken, _openConversationId!);
      if (mounted) setState(() => _openConversation = detail);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (_view) {
      case _MessagesView.compose:
        return _ComposeView(
          accessToken: widget.accessToken,
          api: widget.api,
          children: widget.children,
          onCancel: () => setState(() => _view = _MessagesView.list),
          onSent: () {
            setState(() => _view = _MessagesView.list);
            _loadList();
          },
        );
      case _MessagesView.thread:
        return _ThreadView(
          accessToken: widget.accessToken,
          api: widget.api,
          conversationId: _openConversationId!,
          detail: _openConversation,
          onBack: () => setState(() => _view = _MessagesView.list),
          onSent: _refreshThread,
        );
      case _MessagesView.list:
        return _buildList();
    }
  }

  Widget _buildList() {
    if (_error != null) return Center(child: Text(_error!));
    final conversations = _conversations;
    if (conversations == null) return const Center(child: CircularProgressIndicator());

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        key: const Key('newConversation'),
        onPressed: () => setState(() => _view = _MessagesView.compose),
        child: const Icon(Icons.add),
      ),
      body: conversations.isEmpty
          ? const Center(child: Text('No messages yet.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: conversations.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final c = conversations[i];
                return ListTile(
                  onTap: () => _openThread(c.id),
                  leading: Icon(c.unread ? Icons.circle : Icons.circle_outlined, size: 12),
                  title: Text(
                    c.otherPartyName,
                    style: TextStyle(fontWeight: c.unread ? FontWeight.bold : FontWeight.normal),
                  ),
                  subtitle: Text(recipientLabel(c.recipientType)),
                );
              },
            ),
    );
  }
}

class _ComposeView extends StatefulWidget {
  const _ComposeView({
    required this.accessToken,
    required this.api,
    required this.children,
    required this.onCancel,
    required this.onSent,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;
  final VoidCallback onCancel;
  final VoidCallback onSent;

  @override
  State<_ComposeView> createState() => _ComposeViewState();
}

class _ComposeViewState extends State<_ComposeView> {
  String _recipientType = 'CLASS_TEACHER';
  String? _studentId;
  final _bodyController = TextEditingController();
  bool _isSending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _studentId = widget.children.isNotEmpty ? widget.children.first.id : null;
  }

  @override
  void dispose() {
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_bodyController.text.trim().isEmpty) return;
    if (_recipientType == 'CLASS_TEACHER' && _studentId == null) return;
    setState(() {
      _isSending = true;
      _error = null;
    });
    try {
      await widget.api.startConversation(
        widget.accessToken,
        recipientType: _recipientType,
        studentId: _recipientType == 'CLASS_TEACHER' ? _studentId : null,
        body: _bodyController.text.trim(),
      );
      widget.onSent();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 16, 8),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.close), onPressed: widget.onCancel),
              const SizedBox(width: 4),
              const Text('New message', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  key: const Key('recipientTypeField'),
                  initialValue: _recipientType,
                  items: const [
                    DropdownMenuItem(value: 'CLASS_TEACHER', child: Text('Class Teacher')),
                    DropdownMenuItem(value: 'SCHOOL_ADMIN', child: Text('Admin')),
                    DropdownMenuItem(value: 'ACCOUNTS', child: Text('Accounts')),
                    DropdownMenuItem(value: 'PRINCIPAL', child: Text('Principal')),
                  ],
                  onChanged: (value) => setState(() => _recipientType = value!),
                  decoration: const InputDecoration(labelText: 'Send to'),
                ),
                if (_recipientType == 'CLASS_TEACHER') ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: const Key('studentField'),
                    initialValue: _studentId,
                    items: widget.children
                        .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                        .toList(),
                    onChanged: (value) => setState(() => _studentId = value),
                    decoration: const InputDecoration(labelText: 'About which child?'),
                  ),
                ],
                const SizedBox(height: 12),
                TextField(
                  key: const Key('bodyField'),
                  controller: _bodyController,
                  minLines: 3,
                  maxLines: 6,
                  enabled: !_isSending,
                  decoration: const InputDecoration(
                    labelText: 'Message',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 12),
                ElevatedButton(
                  key: const Key('sendButton'),
                  onPressed: _isSending ? null : _send,
                  child: Text(_isSending ? 'Sending…' : 'Send'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ThreadView extends StatefulWidget {
  const _ThreadView({
    required this.accessToken,
    required this.api,
    required this.conversationId,
    required this.detail,
    required this.onBack,
    required this.onSent,
  });

  final String accessToken;
  final ApiClient api;
  final String conversationId;
  final ConversationDetail? detail;
  final VoidCallback onBack;
  final Future<void> Function() onSent;

  @override
  State<_ThreadView> createState() => _ThreadViewState();
}

class _ThreadViewState extends State<_ThreadView> {
  final _replyController = TextEditingController();
  bool _isSending = false;
  String? _error;

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _reply() async {
    if (_replyController.text.trim().isEmpty) return;
    setState(() {
      _isSending = true;
      _error = null;
    });
    try {
      await widget.api.sendMessage(widget.accessToken, widget.conversationId, _replyController.text.trim());
      _replyController.clear();
      await widget.onSent();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = widget.detail;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 16, 8),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: widget.onBack),
              const SizedBox(width: 4),
              const Text('Conversation', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        Expanded(
          child: detail == null
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: detail.messages.length,
                  itemBuilder: (context, i) {
                    final m = detail.messages[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: DirectionalText(m.body),
                    );
                  },
                ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('replyField'),
                  controller: _replyController,
                  enabled: !_isSending,
                  decoration: const InputDecoration(hintText: 'Type a reply…'),
                ),
              ),
              IconButton(
                key: const Key('sendReplyButton'),
                icon: const Icon(Icons.send),
                onPressed: _isSending ? null : _reply,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
