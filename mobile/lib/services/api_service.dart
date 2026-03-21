import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/product.dart';

class ApiService {
  /// POST /interpret-query
  Future<Map<String, dynamic>> interpretQuery(String query) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/interpret-query'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'query': query}),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {
      'searchTerms': [query],
      'intent': query,
      'language': 'ro',
      'fallback': true,
    };
  }

  /// GET /search?q=...&ai=1
  Future<List<Product>> searchProducts(String query) async {
    try {
      final response = await http.get(
        Uri.parse(
            '${ApiConfig.baseUrl}/search?q=${Uri.encodeComponent(query)}&ai=1'),
      ).timeout(const Duration(seconds: 60));

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body) as List<dynamic>;
        return data
            .map((json) => Product.fromJson(json as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      // ignore - will return empty
    }
    return [];
  }
}
