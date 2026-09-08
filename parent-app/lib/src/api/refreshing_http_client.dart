import 'package:http/http.dart' as http;

/// Wraps an [http.Client] so any 401 from our own backend triggers one silent refresh-and-retry
/// before the caller ever sees it — mirrors staff-console's fetch interceptor. Wrapping at the
/// http.Client layer (via [http.BaseClient.send], which every convenience method like `get`/`post`
/// funnels through) means none of ApiClient's ~25 existing methods need to change.
class RefreshingHttpClient extends http.BaseClient {
  RefreshingHttpClient({required http.Client inner, required this.onUnauthorized}) : _inner = inner;

  final http.Client _inner;

  /// Called on a 401 from an already-authenticated request. Returns the new access token on
  /// success (expected to have already persisted/rotated the refresh token), or null if refresh
  /// itself failed (the caller is expected to have already logged out in that case).
  final Future<String?> Function() onUnauthorized;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final hadAuthHeader = request.headers.containsKey('Authorization');
    final response = await _inner.send(request);

    if (!hadAuthHeader || response.statusCode != 401) {
      return response;
    }

    final newAccessToken = await onUnauthorized();
    if (newAccessToken == null) {
      return response;
    }

    final retryRequest = await _cloneWithNewToken(request, newAccessToken);
    return _inner.send(retryRequest);
  }

  Future<http.BaseRequest> _cloneWithNewToken(http.BaseRequest original, String newAccessToken) async {
    if (original is! http.Request) {
      throw StateError(
        'RefreshingHttpClient only supports http.Request (produced by BaseClient.get/post/etc.), got ${original.runtimeType}',
      );
    }
    final clone = http.Request(original.method, original.url)
      ..headers.addAll(original.headers)
      ..bodyBytes = original.bodyBytes;
    clone.headers['Authorization'] = 'Bearer $newAccessToken';
    return clone;
  }

  @override
  void close() {
    _inner.close();
    super.close();
  }
}
