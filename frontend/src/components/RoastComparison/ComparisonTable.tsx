import { useMemo } from 'react';
import { formatDateTimeTable, formatWeight, formatPercent, roastDisplayId } from '@/utils/formatters';
import { formatTimeMMSS, calculateWeightLoss } from '@/utils/roastCalculations';
import type { Roast } from '@/types/api';
import type { AlogProfile } from '@/api/roasts';

interface ComparisonTableProps {
  roasts: Array<{
    roast: Roast;
    profile?: AlogProfile;
    visible: boolean;
  }>;
}

interface FieldGroup {
  title: string;
  fields: Array<{
    label: string;
    getValue: (roast: Roast, profile?: AlogProfile) => React.ReactNode;
  }>;
}

export function ComparisonTable({ roasts }: ComparisonTableProps) {
  const fieldGroups: FieldGroup[] = useMemo(() => {
    return [
      {
        title: 'Основная информация',
        fields: [
          {
            label: 'ID',
            getValue: (r) => roastDisplayId(r),
          },
          {
            label: 'Дата обжарки',
            getValue: (r) => formatDateTimeTable(r.roasted_at ?? r.roast_date ?? ''),
          },
          {
            label: 'Название',
            getValue: (r) => r.title ?? r.label ?? '—',
          },
          {
            label: 'Кофе / Бленд',
            getValue: (r) =>
              r.coffee_hr_id ?? r.blend_spec?.label ?? r.blend_hr_id ?? '—',
          },
          {
            label: 'Машина',
            getValue: (r) => r.machine ?? '—',
          },
          {
            label: 'Оператор',
            getValue: (r) => r.operator ?? '—',
          },
        ],
      },
      {
        title: 'Веса',
        fields: [
          {
            label: 'Начальный вес',
            getValue: (r) => formatWeight(Number(r.green_weight_kg) || 0),
          },
          {
            label: 'Конечный вес',
            getValue: (r) =>
              r.roasted_weight_kg != null ? formatWeight(r.roasted_weight_kg) : '—',
          },
          {
            label: 'Ужарка',
            getValue: (r, p) => {
              const computed = p?.computed;
              let loss: number | null = null;
              
              if (computed?.weight_loss != null && computed.weight_loss !== 100) {
                loss = computed.weight_loss;
              } else {
                loss = r.weight_loss != null
                  ? r.weight_loss <= 1
                    ? r.weight_loss * 100
                    : r.weight_loss
                  : calculateWeightLoss(r.green_weight_kg, r.roasted_weight_kg);
              }
              
              return loss != null ? formatPercent(loss) : '—';
            },
          },
          {
            label: 'Дефекты',
            getValue: (r) => formatWeight(r.defects_weight || 0),
          },
        ],
      },
      {
        title: 'Времена событий',
        fields: [
          {
            label: 'Разворот (TP)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const time = computed?.TP_time ?? r.TP_time;
              return time != null ? formatTimeMMSS(time) : '—';
            },
          },
          {
            label: 'Конец сушки (DRY)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const time = computed?.DRY_time ?? r.DRY_time;
              return time != null ? formatTimeMMSS(time) : '—';
            },
          },
          {
            label: 'Первый крэк (FCs)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const time = computed?.FCs_time ?? r.FCs_time;
              return time != null ? formatTimeMMSS(time) : '—';
            },
          },
          {
            label: 'Выгрузка (DROP)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const time = computed?.DROP_time ?? r.drop_time;
              return time != null ? formatTimeMMSS(time) : '—';
            },
          },
          {
            label: 'Время развития (DEV)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const time = computed?.finishphasetime ?? r.DEV_time;
              return time != null ? formatTimeMMSS(time) : '—';
            },
          },
          {
            label: '% развития (DEV%)',
            getValue: (r) =>
              r.DEV_ratio != null ? formatPercent(r.DEV_ratio) : '—',
          },
        ],
      },
      {
        title: 'Температуры событий',
        fields: [
          {
            label: 'Температура загрузки',
            getValue: (r, p) => {
              const computed = p?.computed;
              const temp = computed?.CHARGE_BT ?? r.charge_temp;
              const unit = p?.mode || r.temp_unit || 'C';
              return temp != null ? `${temp.toFixed(1)}°${unit}` : '—';
            },
          },
          {
            label: 'Разворот (TP)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const temp = computed?.TP_BT ?? r.TP_temp;
              const unit = p?.mode || r.temp_unit || 'C';
              return temp != null ? `${temp.toFixed(1)}°${unit}` : '—';
            },
          },
          {
            label: 'Конец сушки (DRY)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const temp = computed?.DRY_BT ?? r.DRY_temp;
              const unit = p?.mode || r.temp_unit || 'C';
              return temp != null ? `${temp.toFixed(0)}°${unit}` : '—';
            },
          },
          {
            label: 'Первый крэк (FCs)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const temp = computed?.FCs_BT ?? r.FCs_temp;
              const unit = p?.mode || r.temp_unit || 'C';
              return temp != null ? `${temp.toFixed(1)}°${unit}` : '—';
            },
          },
          {
            label: 'Выгрузка (DROP)',
            getValue: (r, p) => {
              const computed = p?.computed;
              const temp = computed?.DROP_BT ?? r.drop_temp;
              const unit = p?.mode || r.temp_unit || 'C';
              return temp != null ? `${temp.toFixed(1)}°${unit}` : '—';
            },
          },
        ],
      },
      {
        title: 'Качество',
        fields: [
          {
            label: 'Цвет зерна',
            getValue: (r, p) => {
              const color = p?.whole_color ?? r.whole_color;
              return color != null && color !== 0 ? String(color) : '—';
            },
          },
          {
            label: 'Цвет помола',
            getValue: (r, p) => {
              const color = p?.ground_color ?? r.ground_color;
              return color != null && color !== 0 ? String(color) : '—';
            },
          },
          {
            label: 'Оценка',
            getValue: (r) => (r.cupping_score != null && r.cupping_score > 0 ? String(r.cupping_score) : '—'),
          },
          {
            label: 'Контроль качества',
            getValue: (r) => (r.in_quality_control ? 'Да' : 'Нет'),
          },
        ],
      },
      {
        title: 'Дополнительно',
        fields: [
          {
            label: 'Склад',
            getValue: (r) => r.location_hr_id ?? '—',
          },
          {
            label: 'Заметки',
            getValue: (r) => r.notes ?? '—',
          },
        ],
      },
    ];
  }, []);

  const visibleRoasts = roasts.filter((r) => r.visible);

  if (visibleRoasts.length === 0) {
    return <div className="text-gray-500 text-center py-8">Нет видимых обжарок для сравнения</div>;
  }

  return (
    <div className="space-y-6">
      {fieldGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 w-48">Поле</th>
                  {visibleRoasts.map(({ roast }) => (
                    <th
                      key={roast.id}
                      className="px-4 py-3 text-left font-medium text-gray-700 min-w-[150px]"
                    >
                      {roastDisplayId(roast)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.fields.map((field, fieldIdx) => {
                  // Check if values differ
                  const values = visibleRoasts.map(({ roast, profile }) =>
                    field.getValue(roast, profile)
                  );
                  const allSame = values.every((v) => v === values[0]);

                  return (
                    <tr
                      key={fieldIdx}
                      className={`hover:bg-gray-50 ${!allSame ? 'bg-yellow-50/30' : ''}`}
                    >
                      <td className="px-4 py-2 text-gray-600 font-medium">{field.label}</td>
                      {visibleRoasts.map(({ roast, profile }) => (
                        <td key={roast.id} className="px-4 py-2 text-gray-900">
                          {field.getValue(roast, profile)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
