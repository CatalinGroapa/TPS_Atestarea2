import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../config/theme.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final _loginEmailController = TextEditingController();
  final _loginPasswordController = TextEditingController();

  final _regNameController = TextEditingController();
  final _regEmailController = TextEditingController();
  final _regPasswordController = TextEditingController();
  final _regPasswordConfirmController = TextEditingController();

  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _regNameController.dispose();
    _regEmailController.dispose();
    _regPasswordController.dispose();
    _regPasswordConfirmController.dispose();
    super.dispose();
  }

  void _showMessage(String text, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text,
            style: const TextStyle(color: Colors.white)),
        backgroundColor: isError
            ? const Color(0xFF333333)
            : AppColors.primary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _navigateToHome(User user) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => HomeScreen(user: user)),
    );
  }

  Future<void> _handleLogin() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _loginEmailController.text.trim().toLowerCase(),
        password: _loginPasswordController.text,
      );
      _showMessage('Autentificare reusita!', isError: false);
      if (cred.user != null) _navigateToHome(cred.user!);
    } on FirebaseAuthException catch (e) {
      _showMessage('Login esuat: ${e.message}');
    } catch (e) {
      _showMessage('Login esuat: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleRegister() async {
    if (_loading) return;

    if (_regNameController.text.trim().length < 2) {
      _showMessage('Numele este prea scurt.');
      return;
    }
    if (_regPasswordController.text.length < 6) {
      _showMessage('Parola trebuie sa aiba minim 6 caractere.');
      return;
    }
    if (_regPasswordController.text != _regPasswordConfirmController.text) {
      _showMessage('Parolele nu coincid.');
      return;
    }

    setState(() => _loading = true);
    try {
      final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: _regEmailController.text.trim().toLowerCase(),
        password: _regPasswordController.text,
      );
      if (cred.user != null) {
        await cred.user!.updateDisplayName(_regNameController.text.trim());
      }
      _showMessage('Cont creat cu succes!', isError: false);
      if (cred.user != null) _navigateToHome(cred.user!);
    } on FirebaseAuthException catch (e) {
      _showMessage('Inregistrare esuata: ${e.message}');
    } catch (e) {
      _showMessage('Inregistrare esuata: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        setState(() => _loading = false);
        return;
      }
      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      final cred =
          await FirebaseAuth.instance.signInWithCredential(credential);
      _showMessage('Login Google reusit!', isError: false);
      if (cred.user != null) _navigateToHome(cred.user!);
    } catch (e) {
      _showMessage('Google login esuat: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SvgPicture.asset(
                  'assets/images/logo.svg',
                  height: 48,
                  colorFilter: const ColorFilter.mode(
                    AppColors.primary,
                    BlendMode.srcIn,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'PulsePrice',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 28,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Comparare inteligenta de preturi',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: AppColors.textSecondary, fontSize: 14),
                ),
                const SizedBox(height: 48),

                // Tabs
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    indicator: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    labelColor: Colors.white,
                    labelStyle: const TextStyle(fontWeight: FontWeight.w600),
                    unselectedLabelColor: AppColors.textSecondary,
                    dividerColor: Colors.transparent,
                    tabs: const [
                      Tab(text: 'Logare'),
                      Tab(text: 'Inregistrare'),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                SizedBox(
                  height: _tabController.index == 1 ? 380 : 260,
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildLoginForm(),
                      _buildRegisterForm(),
                    ],
                  ),
                ),

                const SizedBox(height: 32),

                Row(
                  children: [
                    const Expanded(
                        child: Divider(color: AppColors.borderColor)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        'sau',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 13),
                      ),
                    ),
                    const Expanded(
                        child: Divider(color: AppColors.borderColor)),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _loading ? null : _handleGoogleSignIn,
                    icon: Image.asset(
                      'assets/images/Google__G__logo.svg.png',
                      height: 18,
                      width: 18,
                    ),
                    label: const Text('Continua cu Google'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      side:
                          const BorderSide(color: AppColors.borderColor),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),

                if (_loading) ...[
                  const SizedBox(height: 32),
                  const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: AppColors.primary,
                      strokeWidth: 2,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Column(
      children: [
        const Align(
          alignment: Alignment.centerLeft,
          child: Text('Email',
              style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500)),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _loginEmailController,
          keyboardType: TextInputType.emailAddress,
          style: const TextStyle(color: AppColors.textPrimary),
          decoration: const InputDecoration(
            hintText: 'exemplu@email.com',
          ),
        ),
        const SizedBox(height: 16),
        const Align(
          alignment: Alignment.centerLeft,
          child: Text('Parola',
              style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500)),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _loginPasswordController,
          obscureText: true,
          style: const TextStyle(color: AppColors.textPrimary),
          decoration: const InputDecoration(
            hintText: 'Parola',
          ),
          onSubmitted: (_) => _handleLogin(),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _handleLogin,
            child: const Text('Intra in cont'),
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    return SingleChildScrollView(
      child: Column(
        children: [
          const Align(
            alignment: Alignment.centerLeft,
            child: Text('Nume',
                style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500)),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _regNameController,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
              hintText: 'Nume complet',
            ),
          ),
          const SizedBox(height: 12),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text('Email',
                style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500)),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _regEmailController,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
              hintText: 'exemplu@email.com',
            ),
          ),
          const SizedBox(height: 12),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text('Parola',
                style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500)),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _regPasswordController,
            obscureText: true,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
              hintText: 'Minim 6 caractere',
            ),
          ),
          const SizedBox(height: 12),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text('Confirma parola',
                style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500)),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _regPasswordConfirmController,
            obscureText: true,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
              hintText: 'Repeta parola',
            ),
            onSubmitted: (_) => _handleRegister(),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _handleRegister,
              child: const Text('Creeaza cont'),
            ),
          ),
        ],
      ),
    );
  }
}
