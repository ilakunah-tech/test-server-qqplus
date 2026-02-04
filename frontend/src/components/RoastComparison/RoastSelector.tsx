import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { roastsApi } from '@/api/roasts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Search } from 'lucide-react';
import { roastDisplayId } from '@/utils/formatters';
import type { Roast } from '@/types/api';

interface RoastSelectorProps {
  selectedIds: string[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  maxSelections?: number;
}

export function RoastSelector({
  selectedIds,
  onSelect,
  onRemove,
  maxSelections = 10,
}: RoastSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: roastsData } = useQuery({
    queryKey: ['roasts', 'compare-selector'],
    queryFn: () => roastsApi.getRoasts(500, 0),
  });

  const allRoasts = roastsData?.data?.items ?? [];
  const filteredRoasts = searchQuery.trim()
    ? allRoasts.filter(
        (r) =>
          r.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(r.roast_seq ?? '').includes(searchQuery) ||
          String(r.batch_number).includes(searchQuery) ||
          r.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const selectedRoasts = allRoasts.filter((r) => selectedIds.includes(r.id));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Выбранные обжарки ({selectedIds.length}/{maxSelections})
        </label>
        {selectedRoasts.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Выберите обжарки для сравнения</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedRoasts.map((roast) => (
              <div
                key={roast.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-light rounded-md border border-brand"
              >
                <span className="text-sm font-medium text-gray-900">
                  {roastDisplayId(roast)} {roast.title || roast.label || ''}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(roast.id)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Удалить"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedIds.length < maxSelections && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Поиск обжарок
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Поиск по ID, названию, номеру..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-input"
            />
          </div>
          {searchQuery.trim() && filteredRoasts.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-md bg-white shadow-lg max-h-60 overflow-y-auto">
              {filteredRoasts
                .filter((r) => !selectedIds.includes(r.id))
                .slice(0, 20)
                .map((roast) => (
                  <button
                    key={roast.id}
                    type="button"
                    onClick={() => {
                      if (selectedIds.length < maxSelections) {
                        onSelect(roast.id);
                        setSearchQuery('');
                      }
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium text-gray-900">
                      {roastDisplayId(roast)} {roast.title || roast.label || ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {roast.roasted_at
                        ? new Date(roast.roasted_at).toLocaleDateString('ru-RU')
                        : ''}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {selectedIds.length >= maxSelections && (
        <p className="text-sm text-amber-600">
          Достигнут максимум обжарок для сравнения ({maxSelections})
        </p>
      )}
    </div>
  );
}
