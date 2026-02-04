import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { calculateRoRWithPeriod, smoothRoR, formatTimeMMSS } from '@/utils/roastCalculations';
import type { Roast } from '@/types/api';
import type { AlogProfile } from '@/api/roasts';

interface ComparisonChartProps {
  roasts: Array<{
    roast: Roast;
    profile?: AlogProfile;
    color: string;
    label: string;
    visible: boolean;
  }>;
  showBT: boolean;
  showET: boolean;
  showDeltaBT: boolean;
  showDeltaET: boolean;
  rorPeriod: 30 | 60;
}

interface ChartDataPoint {
  time: number;
  timeLabel: string;
  [key: string]: number | string | null;
}

export function ComparisonChart({
  roasts,
  showBT,
  showET,
  showDeltaBT,
  showDeltaET,
  rorPeriod,
}: ComparisonChartProps) {
  const chartData = useMemo(() => {
    const visibleRoasts = roasts.filter((r) => r.visible);
    if (visibleRoasts.length === 0) return { data: [], lines: [], events: [], gasAirMarkers: [] };

    // Process each roast's telemetry
    const roastData = visibleRoasts.map(({ roast, profile, color, label }, idx) => {
      const timex = profile?.timex ?? roast?.telemetry?.timex ?? [];
      const temp1 = profile?.temp1 ?? roast?.telemetry?.temp1 ?? [];
      const temp2 = profile?.temp2 ?? roast?.telemetry?.temp2 ?? [];

      if (timex.length === 0 || temp2.length === 0) return null;

      // Charge = start of roast segment for comparison. Backend computed.*_time are relative to charge.
      const timeindex = (profile?.timeindex ?? (profile as Record<string, unknown>)?.timeIndex) as number[] | undefined;
      const chargeIdx = timeindex?.[0] != null ? Math.min(Math.max(0, Math.round(Number(timeindex[0]))), timex.length - 1) : 0;
      const chargeTime = timex[chargeIdx] ?? timex[0] ?? 0;
      // DROP_time: from profile.computed (relative) or roast; fallback last time - charge
      const computedProfile = profile?.computed;
      const dropTimeRel = computedProfile?.DROP_time ?? roast?.drop_time ?? (timex[timex.length - 1] != null ? (timex[timex.length - 1] - chargeTime) : 0);
      const durationFromCharge = dropTimeRel;

      // Normalize time: 0 = charge, only segment charge→drop
      const normalizedTimex = timex.map((t) => t - chargeTime);

      // RoR: same as RoastDetailPage — calculateRoRWithPeriod(temp2, timex, rorPeriod) with original timex
      const deltaBT = smoothRoR(
        calculateRoRWithPeriod(temp2, timex, rorPeriod),
        3
      );
      const deltaET = temp1.length > 1
        ? smoothRoR(calculateRoRWithPeriod(temp1, timex, rorPeriod), 3)
        : [];

      // Events: prefer profile.computed / roast columns; always derive from timeindex when available
      const events: Array<{ time: number; name: string; temp: number }> = [];
      const chargeBT = computedProfile?.CHARGE_BT ?? roast?.charge_temp ?? temp2[chargeIdx];
      events.push({ time: 0, name: 'CHARGE', temp: chargeBT ?? temp2[chargeIdx] ?? 0 });

      const ti = timeindex && timeindex.length >= 7 ? timeindex : null;
      const safeIdx = (slot: number): number | null => {
        if (!ti || slot < 0 || slot >= ti.length) return null;
        const v = ti[slot];
        if (v == null || Number(v) < 0) return null;
        const idx = Math.round(Number(v));
        return idx < timex.length ? idx : null;
      };

      // TP: min BT in first ~2 min (like backend)
      let tpTime = computedProfile?.TP_time ?? roast?.TP_time;
      let tpBT = computedProfile?.TP_BT ?? roast?.TP_temp;
      if ((tpTime == null || tpBT == null) && chargeIdx < timex.length) {
        const searchEnd = Math.min(chargeIdx + 120, timex.length - 1);
        let minIdx = chargeIdx;
        for (let i = chargeIdx + 1; i <= searchEnd; i++) {
          if (temp2[i] != null && (temp2[minIdx] == null || Number(temp2[i]) < Number(temp2[minIdx]))) minIdx = i;
        }
        if (minIdx > chargeIdx && temp2[minIdx] != null) {
          tpTime = timex[minIdx] - chargeTime;
          tpBT = Number(temp2[minIdx]);
        }
      }
      if (tpTime != null && tpBT != null) events.push({ time: tpTime, name: 'TP', temp: tpBT });

      // DE, FC, DROP from computed/roast or from timeindex
      let dryTime = computedProfile?.DRY_time ?? roast?.DRY_time;
      let dryBT = computedProfile?.DRY_BT ?? roast?.DRY_temp;
      const dryIdx = safeIdx(1);
      if ((dryTime == null || dryBT == null) && dryIdx != null) {
        dryTime = timex[dryIdx] - chargeTime;
        dryBT = Number(temp2[dryIdx] ?? 0);
      }
      if (dryTime != null && dryBT != null) events.push({ time: dryTime, name: 'DE', temp: dryBT });

      let fcsTime = computedProfile?.FCs_time ?? roast?.FCs_time;
      let fcsBT = computedProfile?.FCs_BT ?? roast?.FCs_temp;
      const fcsIdx = safeIdx(2);
      if ((fcsTime == null || fcsBT == null) && fcsIdx != null) {
        fcsTime = timex[fcsIdx] - chargeTime;
        fcsBT = Number(temp2[fcsIdx] ?? 0);
      }
      if (fcsTime != null && fcsBT != null) events.push({ time: fcsTime, name: 'FC', temp: fcsBT });

      let dropBT = computedProfile?.DROP_BT ?? roast?.drop_temp;
      const dropIdx = safeIdx(6);
      if ((dropTimeRel == null || dropBT == null) && dropIdx != null) {
        dropBT = Number(temp2[dropIdx] ?? 0);
      }
      if (dropTimeRel != null && dropBT != null) events.push({ time: dropTimeRel, name: 'DROP', temp: dropBT });

      // Gas/air markers: (1) from profile specialevents (type 0=Air, 3=Gas), (2) fallback from telemetry arrays
      const gasAirMarkers: Array<{ time: number; label: string; type: 'gas' | 'air'; bt: number }> = [];
      const prof = profile as Record<string, unknown> | undefined;
      const specialevents = (profile?.specialevents ?? prof?.specialevents ?? (prof as any)?.specialEvents ?? []) as number[];
      const specialeventstype = (profile?.specialeventstype ?? prof?.specialeventstype ?? (prof as any)?.specialeventstype ?? []) as number[];
      const specialeventsvalue = (profile?.specialeventsvalue ?? prof?.specialeventsvalue ?? (prof as any)?.specialeventsvalue ?? []) as number[];
      const specialeventsStrings = (profile?.specialeventsStrings ?? prof?.specialeventsStrings ?? (prof as any)?.specialeventsStrings ?? []) as string[];
      for (let i = 0; i < specialevents.length; i++) {
        const typ = specialeventstype[i];
        if (typ === 0 || typ === 3) {
          const evIdx = Math.round(Number(specialevents[i]));
          if (evIdx >= 0 && evIdx < timex.length) {
            const t = timex[evIdx] - chargeTime;
            if (t >= 0 && t <= durationFromCharge) {
              const value = specialeventsvalue[i] ?? 0;
              const str = specialeventsStrings[i];
              const label = typ === 3 ? (str || `G${Math.round(Number(value) * 10)}`) : (str || `A${Math.round(Number(value) * 10)}`);
              const bt = temp2[evIdx] ?? 0;
              gasAirMarkers.push({ time: t, label, type: typ === 3 ? 'gas' : 'air', bt });
            }
          }
        }
      }
      // Fallback: gas/air arrays from telemetry — mark step changes
      const gasArr = profile?.gas ?? roast?.telemetry?.gas ?? [];
      const airArr = profile?.air ?? roast?.telemetry?.air ?? [];
      if (gasAirMarkers.length === 0 && (gasArr.length || airArr.length)) {
        for (let i = 1; i < timex.length; i++) {
          const t = timex[i] - chargeTime;
          if (t < 0 || t > durationFromCharge) continue;
          if (gasArr[i] !== undefined && gasArr[i] !== gasArr[i - 1]) {
            gasAirMarkers.push({ time: t, label: `G${Math.round(Number(gasArr[i]) * 10)}`, type: 'gas', bt: temp2[i] ?? 0 });
          }
          if (airArr[i] !== undefined && airArr[i] !== airArr[i - 1]) {
            gasAirMarkers.push({ time: t, label: `A${Math.round(Number(airArr[i]) * 10)}`, type: 'air', bt: temp2[i] ?? 0 });
          }
        }
      }

      return {
        idx,
        label,
        color,
        timex: normalizedTimex,
        temp1,
        temp2,
        deltaBT,
        deltaET,
        totalDuration: durationFromCharge,
        events,
        gasAirMarkers,
      };
    }).filter(Boolean);

    if (roastData.length === 0) return { data: [], lines: [], events: [], gasAirMarkers: [] };

    // Comparison range: 0 to max duration (each roast shown from charge to drop only)
    const maxDuration = Math.max(...roastData.map((r) => r!.totalDuration), 1);
    const unifiedData: ChartDataPoint[] = [];

    for (let t = 0; t <= maxDuration; t += 5) {
      const point: ChartDataPoint = {
        time: t,
        timeLabel: formatTimeMMSS(t),
      };

      roastData.forEach((rd) => {
        if (!rd || t > rd.totalDuration) return;

        // Find nearest index
        let nearestIdx = 0;
        let nearestDiff = Math.abs(rd.timex[0] - t);
        for (let i = 1; i < rd.timex.length; i++) {
          const diff = Math.abs(rd.timex[i] - t);
          if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestIdx = i;
          }
        }

        if (nearestDiff <= 10) {
          if (showBT && rd.temp2[nearestIdx] != null) {
            point[`BT_${rd.idx}`] = rd.temp2[nearestIdx];
          }
          if (showET && rd.temp1[nearestIdx] != null) {
            point[`ET_${rd.idx}`] = rd.temp1[nearestIdx];
          }
          if (showDeltaBT && rd.deltaBT[nearestIdx] != null) {
            point[`dBT_${rd.idx}`] = rd.deltaBT[nearestIdx];
          }
          if (showDeltaET && rd.deltaET[nearestIdx] != null) {
            point[`dET_${rd.idx}`] = rd.deltaET[nearestIdx];
          }
        }
      });

      unifiedData.push(point);
    }

    // Downsample to every 10 seconds for performance
    const downsampled = unifiedData.filter((_, i) => i % 2 === 0);

    // Build line configurations
    const lines: Array<{
      dataKey: string;
      stroke: string;
      name: string;
      yAxisId: string;
      strokeDasharray?: string;
    }> = [];

    roastData.forEach((rd) => {
      if (!rd) return;
      if (showBT) {
        lines.push({
          dataKey: `BT_${rd.idx}`,
          stroke: rd.color,
          name: `${rd.label} - BT`,
          yAxisId: 'temp',
        });
      }
      if (showET) {
        lines.push({
          dataKey: `ET_${rd.idx}`,
          stroke: rd.color,
          name: `${rd.label} - ET`,
          yAxisId: 'temp',
          strokeDasharray: '5 5',
        });
      }
      if (showDeltaBT) {
        lines.push({
          dataKey: `dBT_${rd.idx}`,
          stroke: rd.color,
          name: `${rd.label} - ΔBT`,
          yAxisId: 'ror',
          strokeDasharray: '2 2',
        });
      }
      if (showDeltaET) {
        lines.push({
          dataKey: `dET_${rd.idx}`,
          stroke: rd.color,
          name: `${rd.label} - ΔET`,
          yAxisId: 'ror',
          strokeDasharray: '8 4 2 4',
        });
      }
    });

    // Collect all events (with color per roast)
    const allEvents = roastData.flatMap((rd) =>
      rd ? rd.events.map((e) => ({ ...e, color: rd.color, label: rd.label })) : []
    );
    // Collect gas/air markers (per roast: time, label, type, color)
    const gasAirMarkersList = roastData.flatMap((rd) =>
      rd && rd.gasAirMarkers?.length
        ? rd.gasAirMarkers.map((m) => ({ ...m, color: rd.color }))
        : []
    );

    return { data: downsampled, lines, events: allEvents, gasAirMarkers: gasAirMarkersList };
  }, [roasts, showBT, showET, showDeltaBT, showDeltaET, rorPeriod]);

  const visibleRoasts = roasts.filter((r) => r.visible);

  // X-axis: one tick per minute (0, 1, 2, ...) to avoid overlapping digits
  const xTicks = useMemo(() => {
    if (chartData.data.length === 0) return [0];
    const maxTime = Math.max(...chartData.data.map((d) => d.time as number));
    const maxMin = Math.ceil(maxTime / 60) || 1;
    const ticks: number[] = [];
    for (let m = 0; m <= maxMin; m++) ticks.push(m * 60);
    return ticks;
  }, [chartData.data]);

  if (chartData.data.length === 0 || visibleRoasts.length === 0) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center text-gray-500">
        {visibleRoasts.length === 0
          ? 'Нет видимых обжарок для отображения'
          : 'Нет данных для отображения графика'}
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const timeLabel = chartData.data.find((d) => d.time === label)?.timeLabel || formatTimeMMSS(label);
      return (
        <div className="bg-white border border-gray-200 rounded shadow-lg p-3">
          <p className="font-medium mb-2">Время: {timeLabel}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.stroke }} className="text-sm">
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
              {entry.dataKey.startsWith('dBT') || entry.dataKey.startsWith('dET') ? '°/мин' : '°C'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const formatXAxis = (value: number) => `${Math.round(value / 60)}`;

  return (
    <div className="h-[500px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData.data}
          margin={{ top: 20, right: 60, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="time"
            type="number"
            domain={[0, (chartData.data.length ? Math.max(...chartData.data.map((d) => d.time as number)) : 0) || 1]}
            tickFormatter={formatXAxis}
            ticks={xTicks}
            label={{ value: 'Время (мин)', position: 'bottom', offset: 10 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="temp"
            domain={[0, 'auto']}
            label={{ value: 'Температура (°C)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="ror"
            orientation="right"
            domain={[0, 25]}
            ticks={[0, 5, 10, 15, 20, 25]}
            allowDataOverflow={true}
            tick={{ fontSize: 11 }}
            width={40}
            label={{ value: '°/min', angle: 90, position: 'insideRight', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={60}
            wrapperStyle={{ paddingBottom: '20px' }}
          />

          {/* Event markers: vertical lines + labels (CHARGE, TP, DE, FC, DROP) */}
          {chartData.events.map((event, i) => (
            <ReferenceLine
              key={`event-line-${event.label}-${event.time}-${i}`}
              x={event.time}
              stroke={event.color}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              yAxisId="temp"
              label={{
                value: event.name,
                position: 'top',
                fill: event.color,
                fontSize: 11,
                fontWeight: 500,
              }}
            />
          ))}
          {/* Event dots on the curve */}
          {chartData.events.map((event, i) => (
            <ReferenceDot
              key={`event-dot-${event.label}-${event.time}-${i}`}
              x={event.time}
              y={event.temp}
              r={4}
              fill={event.color}
              stroke="white"
              strokeWidth={1}
              yAxisId="temp"
            />
          ))}
          {/* Gas/air markers: vertical line + dot on curve (like RoastDetailPage) */}
          {chartData.gasAirMarkers?.map((m, i) => (
            <ReferenceLine
              key={`gasair-line-${m.time}-${m.label}-${i}`}
              x={m.time}
              stroke={m.type === 'gas' ? '#f59e0b' : '#3b82f6'}
              strokeDasharray="2 2"
              strokeOpacity={0.5}
              yAxisId="temp"
              label={{
                value: m.label,
                position: 'top',
                fill: m.type === 'gas' ? '#f59e0b' : '#3b82f6',
                fontSize: 9,
              }}
            />
          ))}
          {chartData.gasAirMarkers?.map((m, i) => {
            const bt = 'bt' in m ? (m as { bt: number }).bt : undefined;
            if (bt == null) return null;
            return (
              <ReferenceDot
                key={`gasair-dot-${m.time}-${m.label}-${i}`}
                x={m.time}
                y={bt}
                yAxisId="temp"
                r={0}
                shape={(props: { cx: number; cy: number }) => (
                  <g transform={`translate(${props.cx},${props.cy})`}>
                    <polygon
                      points="0,-8 8,0 0,8 -8,0"
                      fill={m.type === 'gas' ? '#f59e0b' : '#3b82f6'}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                    <text x={0} y={4} textAnchor="middle" fill="#fff" fontSize={6} fontWeight="bold">
                      {m.label}
                    </text>
                  </g>
                )}
              />
            );
          })}

          {/* Data lines */}
          {chartData.lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeWidth={line.strokeDasharray ? 1.5 : 2}
              strokeDasharray={line.strokeDasharray}
              dot={false}
              name={line.name}
              yAxisId={line.yAxisId}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
