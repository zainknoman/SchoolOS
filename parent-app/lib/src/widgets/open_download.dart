import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';

/// Opens a download in the system browser (BL-36). [link] is a short-lived download link from
/// [ApiClient.downloadLink] — never a URL carrying the access token. A failure to mint the link
/// (an expired session, no network) shows a snackbar instead of failing silently.
Future<void> openDownload(BuildContext context, Future<Uri> link) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  try {
    await launchUrl(await link, mode: LaunchMode.externalApplication);
  } on ApiException catch (e) {
    messenger?.showSnackBar(SnackBar(content: Text(e.message)));
  } on Exception {
    messenger?.showSnackBar(
      const SnackBar(content: Text('Could not open this file. Please try again.')),
    );
  }
}
