import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { roastsApi, type AlogProfile } from '@/api/roasts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ComparisonChart } from '@/components/RoastComparison/ComparisonChart';
import { ComparisonTable } from '@/components/RoastComparison/ComparisonTable';
import { RoastSelector } from '@/components/RoastComparison/RoastSelector';
import { ArrowLeft, Download } from 'lucide-react';
import { roastDisplayId } from '@/utils/formatters';
import type { Roast } from '@/types/api';

// Color palette for up to 10 roasts
const ROAST_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#ca8a04', // yellow
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#be185d', // pink
  '#059669', // emerald
  '#7c2d12', // brown
];

export const CompareRoastsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get roast IDs from URL
  const idsFromUrl = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  const [selectedIds, setSelectedIds] = useState<string[]>(idsFromUrl);

  // Update URL when selection changes
  const updateUrl = (newIds: string[]) => {
    if (newIds.length > 0) {
      setSearchParams({ ids: newIds.join(',') });
    } else {
      setSearchParams({});
    }
  };

  const handleSelect = (id: string) => {
    if (selectedIds.length >= 10) return;
    const newIds = [...selectedIds, id];
    setSelectedIds(newIds);
    updateUrl(newIds);
    // Add to visibility state (default visible)
    setRoastVisibility((prev) => ({
      ...prev,
      [id]: true,
    }));
  };

  const handleRemove = (id: string) => {
    const newIds = selectedIds.filter((i) => i !== id);
    setSelectedIds(newIds);
    updateUrl(newIds);
    // Remove from visibility state
    setRoastVisibility((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Chart visibility controls
  const [showBT, setShowBT] = useState(true);
  const [showET, setShowET] = useState(true);
  const [showDeltaBT, setShowDeltaBT] = useState(true);
  const [showDeltaET, setShowDeltaET] = useState(false);
  const [rorPeriod, setRorPeriod] = useState<30 | 60>(30);

  // Fetch roast data for all selected IDs
  const roastQueries = useQuery({
    queryKey: ['roasts', 'compare', selectedIds],
    queryFn: async () => {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const roastData = await roastsApi.getRoast(id);
          let profileData: AlogProfile | undefined;
          try {
            profileData = await roastsApi.getProfileData(id);
          } catch {
            // Profile might not exist, that's OK
          }
          return {
            roast: roastData.data,
            profile: profileData,
          };
        })
      );
      return results;
    },
    enabled: selectedIds.length > 0,
  });

  // Visibility state for each roast
  const [roastVisibility, setRoastVisibility] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    idsFromUrl.forEach((id) => {
      initial[id] = true;
    });
    return initial;
  });

  const toggleRoastVisibility = (roastId: string) => {
    setRoastVisibility((prev) => ({
      ...prev,
      [roastId]: !prev[roastId],
    }));
  };

  const roastsWithData = useMemo(() => {
    if (!roastQueries.data) return [];

    return roastQueries.data.map(({ roast, profile }, idx) => ({
      roast,
      profile,
      color: ROAST_COLORS[idx % ROAST_COLORS.length],
      label: `${roastDisplayId(roast)} ${roast.title || roast.label || ''}`.trim() || roast.title || roast.label || roast.id,
      visible: roastVisibility[roast.id] !== false, // Default to true if not set
    }));
  }, [roastQueries.data, roastVisibility]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/roasts')} aria-label="Назад">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Сравнение обжарок</h1>
            <p className="text-sm text-gray-500 mt-1">
              Сравните до 10 обжарок одновременно по всем параметрам
            </p>
          </div>
        </div>
      </div>

      {/* Roast Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Выбор обжарок</CardTitle>
        </CardHeader>
        <CardContent>
          <RoastSelector
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onRemove={handleRemove}
            maxSelections={10}
          />
        </CardContent>
      </Card>

      {selectedIds.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              Выберите обжарки для сравнения. Используйте поиск выше, чтобы найти обжарки.
            </p>
          </CardContent>
        </Card>
      )}

      {roastQueries.isLoading && selectedIds.length > 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Загрузка данных обжарок...</p>
          </CardContent>
        </Card>
      )}

      {roastQueries.isError && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-600">
              Ошибка загрузки данных обжарок: {roastQueries.error instanceof Error ? roastQueries.error.message : 'Неизвестная ошибка'}
            </p>
          </CardContent>
        </Card>
      )}

      {roastsWithData.length > 0 && (
        <>
          {/* Roast visibility checkboxes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Видимость обжарок</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {roastsWithData.map(({ roast, color, label, visible }) => (
                  <label
                    key={roast.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleRoastVisibility(roast.id)}
                      className="rounded border-gray-300 text-brand focus:ring-brand"
                    />
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: visible ? color : '#9ca3af' }}
                    >
                      <span
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: color }}
                      />
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chart - only show if at least one roast has telemetry */}
          {roastsWithData.some(
            ({ roast, profile, visible }) =>
              visible &&
              ((profile?.timex?.length ?? 0) > 0 || (roast?.telemetry?.timex?.length ?? 0) > 0)
          ) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">График температур</CardTitle>
                  <div className="flex items-center gap-4">
                  {/* Chart controls */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBT}
                        onChange={(e) => setShowBT(e.target.checked)}
                        className="rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <span className="text-gray-700">BT</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showET}
                        onChange={(e) => setShowET(e.target.checked)}
                        className="rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <span className="text-gray-700">ET</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDeltaBT}
                        onChange={(e) => setShowDeltaBT(e.target.checked)}
                        className="rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <span className="text-gray-700">ΔBT</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDeltaET}
                        onChange={(e) => setShowDeltaET(e.target.checked)}
                        className="rounded border-gray-300 text-brand focus:ring-brand"
                      />
                      <span className="text-gray-700">ΔET</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                    <span className="text-sm text-gray-600">RoR:</span>
                    <button
                      onClick={() => setRorPeriod(30)}
                      className={`px-2 py-1 text-xs rounded ${
                        rorPeriod === 30
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      30s
                    </button>
                    <button
                      onClick={() => setRorPeriod(60)}
                      className={`px-2 py-1 text-xs rounded ${
                        rorPeriod === 60
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      60s
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ComparisonChart
                roasts={roastsWithData}
                showBT={showBT}
                showET={showET}
                showDeltaBT={showDeltaBT}
                showDeltaET={showDeltaET}
                rorPeriod={rorPeriod}
              />
            </CardContent>
          </Card>
          )}

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Таблица сравнения</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonTable roasts={roastsWithData} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
