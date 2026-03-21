import 'package:flutter/material.dart';
import '../config/theme.dart';

class FiltersToolbar extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(
          bottom: BorderSide(color: AppColors.borderColor),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            // Budget max
            _FilterChip(
              label: 'Buget max',
              child: SizedBox(
                width: 80,
                height: 36,
                child: TextField(
                  keyboardType: TextInputType.number,
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'MDL',
                    hintStyle:
                        const TextStyle(color: AppColors.textMuted, fontSize: 13),
                    filled: true,
                    fillColor: AppColors.background,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide:
                          const BorderSide(color: AppColors.borderColor),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide:
                          const BorderSide(color: AppColors.borderColor),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide:
                          const BorderSide(color: AppColors.primary),
                    ),
                  ),
                  onChanged: (value) {
                    final newFilters = Map<String, dynamic>.from(filters);
                    newFilters['maxPrice'] =
                        value.isNotEmpty ? double.tryParse(value) : null;
                    onChanged(newFilters);
                  },
                ),
              ),
            ),
            _separator(),

            // Rating dropdown
            _FilterChip(
              label: 'Rating',
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.borderColor),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: (filters['minRating'] ?? 0.0).toString(),
                    dropdownColor: AppColors.surface,
                    style: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 13),
                    items: const [
                      DropdownMenuItem(value: '0.0', child: Text('Oricare')),
                      DropdownMenuItem(value: '3.0', child: Text('3+ \u2B50')),
                      DropdownMenuItem(value: '4.0', child: Text('4+ \u2B50')),
                      DropdownMenuItem(
                          value: '4.5', child: Text('4.5+ \u2B50')),
                    ],
                    onChanged: (value) {
                      final newFilters = Map<String, dynamic>.from(filters);
                      newFilters['minRating'] =
                          double.tryParse(value ?? '0') ?? 0.0;
                      onChanged(newFilters);
                    },
                  ),
                ),
              ),
            ),
            _separator(),

            // Sort dropdown
            _FilterChip(
              label: 'Sortare',
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.borderColor),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: filters['sortBy']?.toString() ?? 'score',
                    dropdownColor: AppColors.surface,
                    style: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 13),
                    items: const [
                      DropdownMenuItem(
                          value: 'score', child: Text('Recomandat')),
                      DropdownMenuItem(
                          value: 'price-asc', child: Text('Pret \u2191')),
                      DropdownMenuItem(
                          value: 'price-desc', child: Text('Pret \u2193')),
                      DropdownMenuItem(
                          value: 'rating', child: Text('Rating')),
                    ],
                    onChanged: (value) {
                      final newFilters = Map<String, dynamic>.from(filters);
                      newFilters['sortBy'] = value ?? 'score';
                      onChanged(newFilters);
                    },
                  ),
                ),
              ),
            ),
            _separator(),

            // In stock toggle
            Row(
              children: [
                Transform.scale(
                  scale: 0.8,
                  child: Switch(
                    value: filters['inStock'] == true,
                    onChanged: (value) {
                      final newFilters = Map<String, dynamic>.from(filters);
                      newFilters['inStock'] = value;
                      onChanged(newFilters);
                    },
                    activeTrackColor: AppColors.primary,
                    activeThumbColor: Colors.white,
                    inactiveThumbColor: AppColors.textMuted,
                    inactiveTrackColor: AppColors.background,
                  ),
                ),
                const Text(
                  'Doar in stoc',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _separator() {
    return Container(
      width: 1,
      height: 24,
      margin: const EdgeInsets.symmetric(horizontal: 8),
      color: AppColors.borderColor,
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
          ),
        ),
        const SizedBox(height: 4),
        child,
      ],
    );
  }
}
