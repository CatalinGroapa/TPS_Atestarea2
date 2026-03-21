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
                    final newFilters = Map<String, dynamic>.from(filters);
                    newFilters['maxPrice'] =
                        value.isNotEmpty ? double.tryParse(value) : null;
                    onChanged(newFilters);
                  },
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Rating dropdown
            _FilterChip(
              label: 'Rating',
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
                    value: (filters['minRating'] ?? 0.0).toString(),
                    dropdownColor: AppColors.background,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500),
                    icon: const Icon(Icons.keyboard_arrow_down,
                        size: 18, color: AppColors.textMuted),
                    items: const [
                      DropdownMenuItem(
                          value: '0.0', child: Text('Oricare')),
                      DropdownMenuItem(value: '3.0', child: Text('3+')),
                      DropdownMenuItem(value: '4.0', child: Text('4+')),
                      DropdownMenuItem(
                          value: '4.5', child: Text('4.5+')),
                    ],
                    onChanged: (value) {
                      final newFilters =
                          Map<String, dynamic>.from(filters);
                      newFilters['minRating'] =
                          double.tryParse(value ?? '0') ?? 0.0;
                      onChanged(newFilters);
                    },
                  ),
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
                    value: filters['sortBy']?.toString() ?? 'score',
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
                      DropdownMenuItem(
                          value: 'rating', child: Text('Rating')),
                    ],
                    onChanged: (value) {
                      final newFilters =
                          Map<String, dynamic>.from(filters);
                      newFilters['sortBy'] = value ?? 'score';
                      onChanged(newFilters);
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
                padding: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: filters['inStock'] == true
                      ? AppColors.primary
                      : AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: filters['inStock'] == true
                        ? AppColors.primary
                        : AppColors.borderColor,
                  ),
                ),
                child: Row(
                  children: [
                    Transform.scale(
                      scale: 0.7,
                      child: Switch(
                        value: filters['inStock'] == true,
                        onChanged: (value) {
                          final newFilters =
                              Map<String, dynamic>.from(filters);
                          newFilters['inStock'] = value;
                          onChanged(newFilters);
                        },
                        activeTrackColor: Colors.white.withValues(alpha: 0.3),
                        activeThumbColor: Colors.white,
                        inactiveThumbColor: AppColors.textMuted,
                        inactiveTrackColor: AppColors.borderColor,
                      ),
                    ),
                    Text(
                      'In stoc',
                      style: TextStyle(
                        color: filters['inStock'] == true
                            ? Colors.white
                            : const Color(0xFF333333),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 8),
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
