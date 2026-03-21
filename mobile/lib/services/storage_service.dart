import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/product.dart';

class StorageService {
  static const _wishlistKey = 'wishlist';
  static const _historyKey = 'searchHistory';

  /// Load wishlist from SharedPreferences
  Future<List<WishlistItem>> loadWishlist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_wishlistKey);
      if (jsonString == null || jsonString.isEmpty) return [];
      final List<dynamic> data = jsonDecode(jsonString) as List<dynamic>;
      return data
          .map((e) => WishlistItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Save wishlist to SharedPreferences
  Future<void> saveWishlist(List<WishlistItem> wishlist) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = jsonEncode(wishlist.map((e) => e.toJson()).toList());
      await prefs.setString(_wishlistKey, jsonString);
    } catch (_) {}
  }

  /// Load search history from SharedPreferences
  Future<List<Map<String, dynamic>>> loadSearchHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_historyKey);
      if (jsonString == null || jsonString.isEmpty) return [];
      final List<dynamic> data = jsonDecode(jsonString) as List<dynamic>;
      return data.cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  /// Save search history to SharedPreferences
  Future<void> saveSearchHistory(List<Map<String, dynamic>> history) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = jsonEncode(history);
      await prefs.setString(_historyKey, jsonString);
    } catch (_) {}
  }
}
