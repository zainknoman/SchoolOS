import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'leave_screen.dart';

/// "More" bottom-nav tab (index 5) — a menu of screens that don't warrant their own tab. Leave
/// Applications is the first entry; later additions (settings, profile, …) are out of scope here.
class MoreTab extends StatelessWidget {
  const MoreTab({super.key, required this.accessToken, required this.api, required this.children});

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: ListTile(
            key: const Key('moreLeaveApplications'),
            leading: const Icon(Icons.event_busy_outlined),
            title: const Text('Leave Applications'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => LeaveScreen(accessToken: accessToken, api: api, children: children),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
