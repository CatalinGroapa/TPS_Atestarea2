import 'dart:io';

class ApiConfig {
  static String get baseUrl {
    // Android emulator uses 10.0.2.2 for localhost
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    }
    // iOS simulator uses localhost
    return 'http://localhost:3000';
  }
}
