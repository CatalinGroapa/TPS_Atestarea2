import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../config/theme.dart';

class FiltersToolbar extends StatefulWidget {
  final Map<String, dynamic> filters;
  final ValueChanged<Map<String, dynamic>> onChanged;
  final String resultsCount;

  const FiltersToolbar({
    super.key,
    required this.filters,
    required this.onChanged,
    this.resultsCount = '',
  });

  @override
  State<FiltersToolbar> createState() => _FiltersToolbarState();
}

class _FiltersToolbarState extends State<FiltersToolbar> {
  late final TextEditingController _minController;
  late final TextEditingController _maxController;
  late final FocusNode _minFocusNode;
  late final FocusNode _maxFocusNode;

  @override
  void initState() {
    super.initState();
    _minController = TextEditingController(
      text: _formatNumber(widget.filters['minPrice']),
    );
    _maxController = TextEditingController(
      text: _formatNumber(widget.filters['maxPrice']),
    );
    _minFocusNode = FocusNode();
    _maxFocusNode = FocusNode();
  }

  @override
  void didUpdateWidget(covariant FiltersToolbar oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (!_minFocusNode.hasFocus) {
      final newText = _formatNumber(widget.filters['minPrice']);
      if (_minController.text != newText) {
        _minController.text = newText;
      }
    }

    if (!_maxFocusNode.hasFocus) {
      final newText = _formatNumber(widget.filters['maxPrice']);
      if (_maxController.text != newText) {
        _maxController.text = newText;
      }
    }
  }

  @override
  void dispose() {
    _minController.dispose();
    _maxController.dispose();
    _minFocusNode.dispose();
    _maxFocusNode.dispose();
    super.dispose();
  }

  String _formatNumber(dynamic value) {
    if (value == null) return '';
    if (value is num) return value.toInt().toString();
    final parsed = double.tryParse(value.toString());
    if (parsed == null) return '';
    return parsed.toInt().toString();
  }

  void _emitFilterPrice({
    required String key,
    required String value,
  }) {
    final newFilters = Map<String, dynamic>.from(widget.filters);
    final clean = value.trim();
    newFilters[key] = clean.isNotEmpty ? double.tryParse(clean) : null;
    widget.onChanged(newFilters);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppColors.background,
        border: Border(
          bottom: BorderSide(color: AppColors.borderColor),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            // Budget min
            _FilterChip(
              label: 'Buget min',
              child: SizedBox(
                width: 80,
                height: 36,
                child: TextField(
                  controller: _minController,
                  focusNode: _minFocusNode,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly
                  ],
                  keyboardType: TextInputType.number,
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'MDL',
                    hintStyle: const TextStyle(
                        color: AppColors.textMuted, fontSize: 13),
                    filled: true,
                    fillColor: AppColors.surface,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: AppColors.borderColor),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: AppColors.borderColor),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: AppColors.primary),
                    ),
                  ),
                  onChanged: (value) {
                    _emitFilterPrice(key: 'minPrice', value: value);
                  },
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Budget max
            _FilterChip(
              label: 'Buget max',
              child: SizedBox(
                width: 80,
                height: 36,
                child: TextField(
                  controller: _maxController,
                  focusNode: _maxFocusNode,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly
                  ],
                  keyboardType: TextInputType.number,
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'MDL',
                    hintStyle: const TextStyle(
                        color: AppColors.textMuted, fontSize: 13),
                    filled: true,
                    fillColor: AppColors.surface,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: AppColors.borderColor),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: AppColors.borderColor),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: AppColors.primary),
                    ),
                  ),
                  onChanged: (value) {
                    _emitFilterPrice(key: 'maxPrice', value: value);
                  },
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Sort dropdown
            _FilterChip(
              label: 'Sortare',
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.borderColor),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: widget.filters['sortBy']?.toString() ?? 'score',
                    dropdownColor: AppColors.background,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500),
                    icon: const Icon(Icons.keyboard_arrow_down,
                        size: 18, color: AppColors.textMuted),
                    items: const [
                      DropdownMenuItem(
                          value: 'score', child: Text('Recomandat')),
                      DropdownMenuItem(
                          value: 'price-asc',
                          child: Text('Pret \u2191')),
                      DropdownMenuItem(
                          value: 'price-desc',
                          child: Text('Pret \u2193')),
                    ],
                    onChanged: (value) {
                      final newFilters =
                          Map<String, dynamic>.from(widget.filters);
                      newFilters['sortBy'] = value ?? 'score';
                      widget.onChanged(newFilters);
                    },
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),

            // In stock toggle
            _FilterChip(
              label: 'Disponibil',
              child: Container(
                height: 36,
                width: 66,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: widget.filters['inStock'] == true
                      ? AppColors.primary
                      : AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: widget.filters['inStock'] == true
                        ? AppColors.primary
                        : AppColors.borderColor,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Transform.scale(
                      scale: 0.75,
                      child: Switch(
                        value: widget.filters['inStock'] == true,
                        onChanged: (value) {
                          final newFilters =
                              Map<String, dynamic>.from(widget.filters);
                          newFilters['inStock'] = value;
                          widget.onChanged(newFilters);
                        },
                        activeTrackColor: Colors.white.withValues(alpha: 0.3),
                        activeThumbColor: Colors.white,
                        inactiveThumbColor: AppColors.textMuted,
                        inactiveTrackColor: AppColors.borderColor,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final Widget child;

  const _FilterChip({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 4),
        child,
      ],
    );
  }
}
