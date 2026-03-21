import 'package:flutter/material.dart';
import '../config/theme.dart';

class SearchBarWidget extends StatefulWidget {
  final String query;
  final ValueChanged<String> onQueryChanged;
  final Future<void> Function(String?) onSearch;
  final List<Map<String, dynamic>> searchHistory;
  final VoidCallback onClearHistory;
  final ValueChanged<String> onHistoryItemClick;

  const SearchBarWidget({
    super.key,
    required this.query,
    required this.onQueryChanged,
    required this.onSearch,
    required this.searchHistory,
    required this.onClearHistory,
    required this.onHistoryItemClick,
  });

  @override
  State<SearchBarWidget> createState() => _SearchBarWidgetState();
}

class _SearchBarWidgetState extends State<SearchBarWidget> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _showDropdown = false;

  @override
  void initState() {
    super.initState();
    _controller.text = widget.query;
    _focusNode.addListener(() {
      if (_focusNode.hasFocus && widget.searchHistory.isNotEmpty) {
        setState(() => _showDropdown = true);
      }
      if (!_focusNode.hasFocus) {
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) setState(() => _showDropdown = false);
        });
      }
    });
  }

  @override
  void didUpdateWidget(SearchBarWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.query != _controller.text) {
      _controller.text = widget.query;
      _controller.selection = TextSelection.fromPosition(
        TextPosition(offset: _controller.text.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  String _formatTimeAgo(String? timestamp) {
    if (timestamp == null) return '';
    try {
      final date = DateTime.parse(timestamp);
      final now = DateTime.now();
      final diff = now.difference(date).inSeconds;
      if (diff < 60) return 'acum';
      if (diff < 3600) return '${diff ~/ 60} min';
      if (diff < 86400) return '${diff ~/ 3600} ore';
      return '${diff ~/ 86400} zile';
    } catch (_) {
      return '';
    }
  }

  static const _quickSearchPills = [
    {'label': 'Laptop', 'term': 'laptop'},
    {'label': 'iPhone', 'term': 'iPhone'},
    {'label': 'Samsung', 'term': 'Samsung'},
    {'label': 'Televizor', 'term': 'televizor'},
    {'label': 'Casti', 'term': 'casti'},
    {'label': 'Tableta', 'term': 'tableta'},
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 32, 16, 24),
      color: AppColors.background,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Gaseste cel mai bun pret',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 32,
              fontWeight: FontWeight.w700,
              letterSpacing: -1,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Comparam automat din 4 magazine pentru tine',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 24),

          // Search input row
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Cauta produs...',
                    prefixIcon: const Icon(Icons.search,
                        color: AppColors.textMuted, size: 20),
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.borderLight),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.borderLight),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                          color: AppColors.primary, width: 1),
                    ),
                  ),
                  onChanged: widget.onQueryChanged,
                  onSubmitted: (_) {
                    setState(() => _showDropdown = false);
                    widget.onSearch(null);
                  },
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () {
                  setState(() => _showDropdown = false);
                  _focusNode.unfocus();
                  widget.onSearch(null);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Cauta',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),

          // History dropdown
          if (_showDropdown && widget.searchHistory.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderColor),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.access_time,
                                size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 6),
                            const Text(
                              'Cautari recente',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        GestureDetector(
                          onTap: () {
                            widget.onClearHistory();
                            setState(() => _showDropdown = false);
                          },
                          child: const Text(
                            'Sterge tot',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(
                      height: 1, color: AppColors.borderColor),
                  ...widget.searchHistory.map((item) => InkWell(
                        onTap: () {
                          widget.onHistoryItemClick(
                              item['query']?.toString() ?? '');
                          setState(() => _showDropdown = false);
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          child: Row(
                            children: [
                              const Icon(Icons.search,
                                  size: 14,
                                  color: AppColors.textMuted),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  item['query']?.toString() ?? '',
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                              Text(
                                _formatTimeAgo(
                                    item['timestamp']?.toString()),
                                style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )),
                ],
              ),
            ),

          const SizedBox(height: 16),

          // Quick search pills
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              const Text(
                'Popular:',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              ..._quickSearchPills.map((pill) => GestureDetector(
                    onTap: () {
                      widget.onQueryChanged(pill['term']!);
                      _controller.text = pill['term']!;
                      widget.onSearch(pill['term']);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border:
                            Border.all(color: AppColors.borderLight),
                      ),
                      child: Text(
                        pill['label']!,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  )),
            ],
          ),
        ],
      ),
    );
  }
}
