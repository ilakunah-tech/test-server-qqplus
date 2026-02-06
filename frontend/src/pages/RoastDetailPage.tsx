import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roastsApi, type AlogProfile } from '@/api/roasts';
import { inventoryApi } from '@/api/inventory';
import { getBlends } from '@/api/blends';
import { getMyMachines } from '@/api/machines';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateTime, roastDisplayId } from '@/utils/formatters';
import {
  formatTimeMMSS,
  calculateRoRWithPeriod,
  smoothRoR,
  calculatePhases,
  calculateWeightLoss,
  downsample,
} from '@/utils/roastCalculations';
import { getRoastEvents } from '@/types/api';
import { authStore } from '@/store/authStore';
import { ArrowLeft, Upload, Download, Trash2, Star, Replace, StarOff, FileText, Calendar, Pencil, Target, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  ReferenceArea,
} from 'recharts';
import { EditRoastInfoDialog } from '@/components/Roasts/EditRoastInfoDialog';
import type { Roast, Coffee } from '@/types/api';
import type { Blend } from '@/api/blends';
import { useTranslation } from '@/hooks/useTranslation';

// ==================== HELPER COMPONENTS ====================

function SummaryRow({
  label,
  value,
  className = '',
  onClick,
}: { label: string; value: React.ReactNode; className?: string; onClick?: () => void }) {
  const content = <span className="text-gray-900 dark:text-gray-100 text-sm text-right font-medium">{value ?? '—'}</span>;
  return (
    <div className={`flex justify-between items-start py-2 border-b border-gray-100 dark:border-gray-600 last:border-0 gap-4 ${className}`}>
      <span className="text-gray-500 dark:text-gray-400 text-sm shrink-0">{label}</span>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="text-right font-medium text-sm text-gray-900 dark:text-gray-100 hover:text-brand dark:hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1"
          title="Нажмите для редактирования"
        >
          {value ?? '—'}
        </button>
      ) : (
        content
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-gray-600 dark:text-gray-400 text-sm">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 text-sm font-medium">{value ?? '—'}</span>
    </div>
  );
}

function LegendCheckbox({
  checked,
  onChange,
  color,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  color: string;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded border-gray-300"
      />
      <span className="flex items-center gap-1">
        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </span>
    </label>
  );
}

// ==================== REFERENCE DIALOGS ====================

function CreateReferenceDialog({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (body: { reference_name: string; reference_for_coffee_id?: string; reference_for_blend_id?: string; reference_machine: string }) => void;
  isSubmitting: boolean;
}) {
  const [refType, setRefType] = useState<'coffee' | 'blend'>('coffee');
  const [coffeeId, setCoffeeId] = useState('');
  const [blendId, setBlendId] = useState('');
  const [machine, setMachine] = useState('');
  const [referenceName, setReferenceName] = useState('');

  const { data: coffeesRes } = useQuery({
    queryKey: ['coffees'],
    queryFn: () => inventoryApi.getCoffees(1000, 0),
  });
  const { data: blendsRes } = useQuery({
    queryKey: ['blends'],
    queryFn: () => getBlends(100, 0),
  });
  const { data: myMachines = [] } = useQuery({
    queryKey: ['machines', 'my'],
    queryFn: getMyMachines,
  });
  const coffees: Coffee[] = coffeesRes?.data?.items ?? [];
  const blends: Blend[] = (blendsRes && 'items' in blendsRes ? blendsRes.items : []) as Blend[];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceName.trim() || !machine.trim()) {
      alert('Укажите название эталона и машину.');
      return;
    }
    if (refType === 'coffee' && !coffeeId) {
      alert('Выберите моносорт.');
      return;
    }
    if (refType === 'blend' && !blendId) {
      alert('Выберите бленд.');
      return;
    }
    onSubmit({
      reference_name: referenceName.trim(),
      reference_machine: machine.trim(),
      ...(refType === 'coffee' ? { reference_for_coffee_id: coffeeId } : { reference_for_blend_id: blendId }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Создать новый эталон</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Тип</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2">
                <input type="radio" checked={refType === 'coffee'} onChange={() => setRefType('coffee')} />
                Моносорт
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={refType === 'blend'} onChange={() => setRefType('blend')} />
                Бленд
              </label>
            </div>
          </div>
          {refType === 'coffee' && (
            <div>
              <Label>Моносорт</Label>
              <select
                className="w-full mt-1 border rounded px-3 py-2"
                value={coffeeId}
                onChange={(e) => setCoffeeId(e.target.value)}
              >
                <option value="">— Выберите —</option>
                {coffees.map((c) => (
                  <option key={c.id} value={c.id}>{c.label ?? c.name ?? c.hr_id}</option>
                ))}
              </select>
            </div>
          )}
          {refType === 'blend' && (
            <div>
              <Label>Бленд</Label>
              <select
                className="w-full mt-1 border rounded px-3 py-2"
                value={blendId}
                onChange={(e) => setBlendId(e.target.value)}
              >
                <option value="">— Выберите —</option>
                {blends.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>Машина</Label>
            {myMachines.length === 0 ? (
              <p className="text-sm text-amber-600 mt-1">
                Добавьте машины в <Link to="/settings" className="underline">Setting</Link>, затем создайте эталон.
              </p>
            ) : (
              <select
                className="w-full mt-1 border rounded px-3 py-2"
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
              >
                <option value="">— Выберите машину —</option>
                {myMachines.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <Label>Название эталона</Label>
            <Input value={referenceName} onChange={(e) => setReferenceName(e.target.value)} placeholder="Светлая обжарка" className="mt-1" required />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Сохранение…' : 'Создать'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReplaceReferenceDialog({
  currentRoast,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  currentRoast: Roast;
  onClose: () => void;
  onSubmit: (body: { replace_reference_roast_id: string; reference_name?: string }) => void;
  isSubmitting: boolean;
}) {
  const coffeeId = currentRoast.coffee_id ?? undefined;
  const blendId = currentRoast.blend_id ?? undefined;
  const machine = currentRoast.machine ?? '';
  const [replaceRoastId, setReplaceRoastId] = useState('');
  const [referenceName, setReferenceName] = useState('');

  const canFetch = (coffeeId || blendId) && machine;
  const { data: refsRes } = useQuery({
    queryKey: ['references', coffeeId ?? blendId, machine],
    queryFn: () => roastsApi.getReferences(coffeeId ? { coffee_id: coffeeId, machine } : { blend_id: blendId!, machine }),
    enabled: Boolean(canFetch),
  });
  const references: Roast[] = refsRes?.data?.items ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceRoastId) {
      alert('Выберите эталон для замены.');
      return;
    }
    onSubmit({ replace_reference_roast_id: replaceRoastId, reference_name: referenceName.trim() || undefined });
  };

  if (!canFetch) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-600 dark:text-gray-300 mb-4">У этой обжарки не указаны кофе/бленд или машина. Укажите их в данных обжарки или создайте эталон через «Создать эталон» с выбором кофе и машины.</p>
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Заменить эталон</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Заменить эталон</Label>
            <select
              className="w-full mt-1 border rounded px-3 py-2"
              value={replaceRoastId}
              onChange={(e) => setReplaceRoastId(e.target.value)}
            >
              <option value="">— Выберите эталон —</option>
              {references.map((r) => (
                <option key={r.id} value={r.id}>{r.reference_name ?? r.title ?? r.label ?? r.id}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Название эталона (для текущей обжарки)</Label>
            <Input value={referenceName} onChange={(e) => setReferenceName(e.target.value)} placeholder="Можно оставить пустым — подставится имя заменённого" className="mt-1" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Сохранение…' : 'Заменить'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditReferenceBeansNotesDialog({
  currentNotes,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  currentNotes?: string;
  onClose: () => void;
  onSubmit: (notes: string) => void;
  isSubmitting: boolean;
}) {
  const [notes, setNotes] = useState(currentNotes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(notes.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Заметки для Beans (эталонный профиль)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Эти заметки будут отображаться в поле Beans в диалоговом окне Roast Properties в Artisan, когда этот эталонный профиль выбран.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="beans-notes">Заметки</Label>
            <textarea
              id="beans-notes"
              className="w-full mt-1 border rounded px-3 py-2 min-h-[200px] font-mono text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Введите заметки, которые будут отображаться в поле Beans..."
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Сохранение…' : 'Сохранить'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export const RoastDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = authStore((s) => s.role);
  const canEditRoasts = role === 'user' || role === 'admin';
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Chart visibility state
  const [showBT, setShowBT] = useState(true);
  const [showET, setShowET] = useState(true);
  const [showDeltaBT, setShowDeltaBT] = useState(true);
  const [showDeltaET, setShowDeltaET] = useState(true);
  const [showGas, setShowGas] = useState(true);
  const [showAir, setShowAir] = useState(false);
  const [showDrum, setShowDrum] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [showPhaseZones, setShowPhaseZones] = useState(true);
  
  // RoR period: 30 or 60 seconds
  const [rorPeriod, setRorPeriod] = useState<30 | 60>(30);
  
  // Downsampling step for smoother display
  const DOWNSAMPLE_STEP = 5;

  // Fetch roast data
  const { data, isLoading, error } = useQuery({
    queryKey: ['roast', id],
    queryFn: () => roastsApi.getRoast(id!),
    enabled: Boolean(id),
  });

  // Fetch profile data (always try to get it for .alog data)
  const { data: profileData } = useQuery({
    queryKey: ['roast-profile', id],
    queryFn: () => roastsApi.getProfileData(id!),
    enabled: Boolean(id),
    retry: false,  // Don't retry if no profile
  });

  const uploadProfileMutation = useMutation({
    mutationFn: ({ roastId, file }: { roastId: string; file: File }) =>
      roastsApi.uploadProfile(roastId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roast', id] });
      queryClient.invalidateQueries({ queryKey: ['roast-profile', id] });
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
    },
  });

  const deleteRoastMutation = useMutation({
    mutationFn: roastsApi.deleteRoast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      navigate('/roasts');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка удаления');
    },
  });

  // Reference profile dialogs
  const [showCreateRefDialog, setShowCreateRefDialog] = useState(false);
  const [showReplaceRefDialog, setShowReplaceRefDialog] = useState(false);
  const [showEditBeansNotesDialog, setShowEditBeansNotesDialog] = useState(false);

  const createRefMutation = useMutation({
    mutationFn: ({ roastId, body }: { roastId: string; body: { reference_name: string; reference_for_coffee_id?: string; reference_for_blend_id?: string; reference_machine: string } }) =>
      roastsApi.createReference(roastId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roast', id] });
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      setShowCreateRefDialog(false);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка создания эталона');
    },
  });

  const replaceRefMutation = useMutation({
    mutationFn: ({ roastId, body }: { roastId: string; body: { replace_reference_roast_id: string; reference_name?: string } }) =>
      roastsApi.replaceReference(roastId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roast', id] });
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      setShowReplaceRefDialog(false);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка замены эталона');
    },
  });

  const removeRefMutation = useMutation({
    mutationFn: roastsApi.removeReference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roast', id] });
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка снятия эталона');
    },
  });

  const updateBeansNotesMutation = useMutation({
    mutationFn: ({ roastId, notes }: { roastId: string; notes: string }) =>
      roastsApi.updateRoast(roastId, { reference_beans_notes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roast', id] });
      queryClient.invalidateQueries({ queryKey: ['roasts', 'references'] });
      setShowEditBeansNotesDialog(false);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка сохранения заметок');
    },
  });

  const [showEditRoastInfoDialog, setShowEditRoastInfoDialog] = useState(false);
  const updateRoastInfoMutation = useMutation({
    mutationFn: ({ roastId, data }: { roastId: string; data: Parameters<typeof roastsApi.updateRoast>[1] }) =>
      roastsApi.updateRoast(roastId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roast', id] });
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      setShowEditRoastInfoDialog(false);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      alert(err.response?.data?.detail || 'Ошибка сохранения');
    },
  });

  const roast: Roast | undefined = data?.data;
  const profile: AlogProfile | undefined = profileData;

  // Get telemetry from profile (priority) or roast
  // IMPORTANT: Profile data has priority because timeindex refers to profile arrays
  const telemetry = useMemo(() => {
    // First try profile data from .alog file (has timeindex for precise event positioning)
    if (profile?.timex?.length) {
      return {
        timex: profile.timex,
        temp1: profile.temp1,
        temp2: profile.temp2,
        air: undefined,
        drum: undefined,
        gas: undefined,
      };
    }
    // Fallback to roast telemetry from DB
    if (roast?.telemetry?.timex?.length) {
      return roast.telemetry;
    }
    return null;
  }, [roast, profile]);

  // Get computed values from profile (more detailed than roast)
  const profileComputed = useMemo(() => profile?.computed ?? null, [profile]);

  // When profile has no/partial computed but we have telemetry, derive Charge and Drop from curve
  // NOTE: In Artisan .alog format: temp1 = ET, temp2 = BT
  const computedFromTelemetry = useMemo(() => {
    if (!telemetry?.timex?.length || !telemetry?.temp2?.length) return null;
    const n = telemetry.timex.length;
    const lastIdx = n - 1;
    const chargeBT = telemetry.temp2[0];  // temp2 = BT
    const dropTime = telemetry.timex[lastIdx];
    const dropBT = telemetry.temp2[lastIdx];  // temp2 = BT
    if (chargeBT == null && dropTime == null && dropBT == null) return null;
    return {
      CHARGE_BT: chargeBT ?? undefined,
      DROP_time: dropTime ?? undefined,
      DROP_BT: dropBT ?? undefined,
      totaltime: dropTime ?? undefined,
    };
  }, [telemetry]);

  // Prefer profile computed; fill missing from telemetry-derived or roast
  const computed = useMemo(() => {
    const base = profileComputed ?? {};
    const fromTelemetry = computedFromTelemetry ?? {};
    return {
      ...fromTelemetry,
      ...base,
    };
  }, [profileComputed, computedFromTelemetry]);

  // Get special events (Gas markers) from profile
  const specialEvents = useMemo(() => {
    if (!profile?.specialevents?.length || !profile?.timex?.length) return [];
    
    const events: Array<{
      idx: number;
      time: number;
      type: number;  // 0=Air, 1=Drum, 2=Damper, 3=Gas
      value: number;
      label: string;
    }> = [];
    
    for (let i = 0; i < profile.specialevents.length; i++) {
      const idx = profile.specialevents[i];
      const type = profile.specialeventstype?.[i] ?? 0;
      const value = profile.specialeventsvalue?.[i] ?? 0;
      const label = profile.specialeventsStrings?.[i] ?? '';
      const time = profile.timex[idx] ?? 0;
      
      events.push({ idx, time, type, value, label });
    }
    
    return events;
  }, [profile]);

  // Gas events for chart markers (type 3)
  const gasEvents = useMemo(() => {
    return specialEvents
      .filter(e => e.type === 3)
      .map(e => ({
        time: e.time,
        value: e.value,
        label: `G${Math.round(e.value * 10)}`,  // e.g. G35, G70, G100
      }));
  }, [specialEvents]);
  
  // Air/Fan events for chart markers (type 0)
  const airEvents = useMemo(() => {
    return specialEvents
      .filter(e => e.type === 0)
      .map(e => ({
        time: e.time,
        value: e.value,
        label: `A${Math.round(e.value * 10)}`,  // e.g. A50, A80
      }));
  }, [specialEvents]);
  
  // Drum/Speed events for chart markers (type 4 or sometimes 1)
  const drumEvents = useMemo(() => {
    return specialEvents
      .filter(e => e.type === 4 || e.type === 1)
      .map(e => ({
        time: e.time,
        value: e.value,
        label: `D${Math.round(e.value * 10)}`,  // e.g. D51
      }));
  }, [specialEvents]);

  // Calculate RoR with configurable period (30s or 60s)
  // NOTE: In Artisan .alog format: temp1 = ET, temp2 = BT
  const deltaBT = useMemo(
    () => (telemetry?.timex && telemetry?.temp2 
      ? smoothRoR(calculateRoRWithPeriod(telemetry.temp2, telemetry.timex, rorPeriod), 3) 
      : []),
    [telemetry, rorPeriod]
  );
  const deltaET = useMemo(
    () => (telemetry?.timex && telemetry?.temp1 
      ? smoothRoR(calculateRoRWithPeriod(telemetry.temp1, telemetry.timex, rorPeriod), 3) 
      : []),
    [telemetry, rorPeriod]
  );

  // Prepare chart data with downsampling for smoother display
  // NOTE: In Artisan .alog format: temp1 = ET, temp2 = BT
  const chartData = useMemo(() => {
    if (!telemetry?.timex?.length) return [];
    
    // Create full data array - use numeric time for proper referencing
    const fullData = telemetry.timex.map((time, idx) => ({
      time: Math.round(time),  // seconds as number for ReferenceArea/ReferenceDot
      timeMin: time / 60,
      timeFormatted: formatTimeMMSS(time),
      BT: telemetry.temp2?.[idx] ?? null,
      ET: telemetry.temp1?.[idx] ?? null,
      deltaBT: deltaBT[idx] ?? null,
      deltaET: deltaET[idx] ?? null,
      air: telemetry.air?.[idx] ?? null,
      drum: telemetry.drum?.[idx] ?? null,
      gas: telemetry.gas?.[idx] ?? null,
    }));
    
    // Downsample for smoother display (every Nth point)
    return downsample(fullData, DOWNSAMPLE_STEP);
  }, [telemetry, deltaBT, deltaET, DOWNSAMPLE_STEP]);
  
  // Phase zone boundaries from profile.timeindex (absolute times from profile.timex)
  // timeindex: [CHARGE, DRY, FCs, FCe, SCs, SCe, DROP, COOL]
  const phaseTimes = useMemo(() => {
    const ti = profile?.timeindex;
    const timex = profile?.timex;
    if (!ti || !timex || ti.length < 7) return null;
    
    const chargeIdx = ti[0] >= 0 ? ti[0] : 0;
    const dryIdx = ti[1] >= 0 ? ti[1] : -1;
    const fcsIdx = ti[2] >= 0 ? ti[2] : -1;
    const dropIdx = ti[6] >= 0 ? ti[6] : -1;
    
    return {
      charge: timex[chargeIdx] ?? 0,
      dry: dryIdx >= 0 ? timex[dryIdx] : null,
      fcs: fcsIdx >= 0 ? timex[fcsIdx] : null,
      drop: dropIdx >= 0 ? timex[dropIdx] : null,
    };
  }, [profile]);

  // Get roast events for markers (prefer computed from profile)
  const events = useMemo(() => {
    const unit = profile?.mode || roast?.temp_unit || 'C';
    const evts: Array<{ name: string; time: number; temp: number; label: string; color: string }> = [];
    
    // Use computed values from profile if available
    if (computed) {
      if (computed.CHARGE_BT != null) {
        evts.push({
          name: 'Charge',
          time: 0,
          temp: computed.CHARGE_BT,
          label: `Charge, ${computed.CHARGE_BT.toFixed(1)}°${unit}`,
          color: '#22c55e',
        });
      }
      if (computed.TP_time != null && computed.TP_BT != null) {
        evts.push({
          name: 'TP',
          time: computed.TP_time,
          temp: computed.TP_BT,
          label: `TP, ${computed.TP_BT.toFixed(1)}°${unit}`,
          color: '#3b82f6',
        });
      }
      if (computed.DRY_time != null && computed.DRY_BT != null) {
        evts.push({
          name: 'Dry',
          time: computed.DRY_time,
          temp: computed.DRY_BT,
          label: `Dry, ${computed.DRY_BT.toFixed(0)}°${unit}`,
          color: '#f59e0b',
        });
      }
      if (computed.FCs_time != null && computed.FCs_BT != null) {
        evts.push({
          name: 'FC',
          time: computed.FCs_time,
          temp: computed.FCs_BT,
          label: `FC, ${computed.FCs_BT.toFixed(1)}°${unit}`,
          color: '#ef4444',
        });
      }
      if (computed.DROP_time != null && computed.DROP_BT != null) {
        evts.push({
          name: 'Drop',
          time: computed.DROP_time,
          temp: computed.DROP_BT,
          label: `Drop, ${computed.DROP_BT.toFixed(1)}°${unit}`,
          color: '#059669',
        });
      }
    } else if (roast) {
      // Fallback to roast data
      return getRoastEvents(roast);
    }
    
    return evts;
  }, [roast, computed, profile]);

  // .alog weight is often [green_g, roasted_g, 'g'] — convert to kg when from profile
  const profileWeightKg =
    profile?.weight && Array.isArray(profile.weight) && profile.weight.length >= 2
      ? (profile.weight[2] === 'g'
          ? [(profile.weight[0] as number) / 1000, (profile.weight[1] as number) / 1000]
          : [profile.weight[0] as number, profile.weight[1] as number])
      : null;
  const greenWeight = roast?.green_weight_kg ?? profileWeightKg?.[0] ?? undefined;
  const roastedWeight =
    roast?.roasted_weight_kg ?? profileWeightKg?.[1] ?? (computed?.weightout ? computed.weightout / 1000 : undefined);

  // Calculate derived values (prefer computed from profile)
  // Priority: direct calculation from weights > computed > stored DB value
  // Sanity check: coffee weight loss is typically 10-25%, never > 50%
  const weightLoss = useMemo(() => {
    // 1. If both weights are available, always calculate directly — most reliable
    const calculated = calculateWeightLoss(greenWeight, roastedWeight);
    if (calculated != null && calculated > 0 && calculated < 50) {
      return calculated;
    }
    // 2. Try computed from .alog profile (Artisan stores as decimal 0..1 or percentage 0..100)
    if (computed?.weight_loss != null) {
      const wl = computed.weight_loss;
      // Artisan may store as decimal (e.g. 0.1447) or percentage (e.g. 14.47)
      const pct = wl > 0 && wl <= 1 ? wl * 100 : wl;
      if (pct > 0 && pct < 50) return pct;
    }
    // 3. Fall back to DB value (with sanity check)
    if (roast?.weight_loss != null && roast.weight_loss > 0 && roast.weight_loss < 50) {
      return roast.weight_loss;
    }
    return calculated;
  }, [roast, computed, greenWeight, roastedWeight]);

  const phases = useMemo(() => {
    // Use computed phase times from profile if available
    if (computed?.dryphasetime != null && computed?.midphasetime != null && computed?.finishphasetime != null) {
      const total = computed.totaltime || (computed.dryphasetime + computed.midphasetime + computed.finishphasetime);
      return {
        dryTime: computed.dryphasetime,
        dryPercent: total > 0 ? (computed.dryphasetime / total) * 100 : null,
        mailardTime: computed.midphasetime,
        mailardPercent: total > 0 ? (computed.midphasetime / total) * 100 : null,
        devTime: computed.finishphasetime,
        devPercent: total > 0 ? (computed.finishphasetime / total) * 100 : null,
      };
    }
    return calculatePhases(
      computed?.DRY_time ?? roast?.DRY_time,
      computed?.FCs_time ?? roast?.FCs_time,
      computed?.DROP_time ?? roast?.drop_time
    );
  }, [roast, computed]);

  const tempUnit = profile?.mode || roast?.temp_unit || 'C';
  const hasAlogFile = Boolean(roast?.alog_file_path);
  const roastDate =
    roast?.roasted_at ??
    roast?.roast_date ??
    (profile?.roastisodate ? `${profile.roastisodate}T${profile.roasttime || '00:00:00'}` : undefined);

  // Handlers
  const handleFileUpload = (file: File) => {
    if (id) uploadProfileMutation.mutate({ roastId: id, file });
  };

  const handleDownloadProfile = () => {
    if (!id || !roast) return;
    setDownloadError(null);
    roastsApi
      .downloadProfile(id)
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${roast.id}.alog`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        setDownloadError(err?.message ?? 'Download failed');
      });
  };

  // ==================== RENDER ====================

  if (!id) {
    return (
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">ID обжарки отсутствует.</p>
        <Button variant="outline" onClick={() => navigate('/roasts')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к обжаркам
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="space-y-6"><p className="text-gray-600 dark:text-gray-400">Загрузка обжарки…</p></div>;
  }

  if (error || !roast) {
    return (
      <div className="space-y-6">
        <p className="text-red-600">Обжарка не найдена или не удалось загрузить.</p>
        <Button variant="outline" onClick={() => navigate('/roasts')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к обжаркам
        </Button>
      </div>
    );
  }

  const batchNumberDisplay = roastDisplayId({
    roast_seq: roast.roast_seq,
    batch_number: roast.batch_number || profile?.roastbatchnr,
  });
  const displayTitle = roast.label || roast.title || profile?.title || batchNumberDisplay || 'Обжарка';

  // Get additional info from profile
  const beans = profile?.beans || profile?.plus_coffee_label || roast.coffee_hr_id;
  const storeName = profile?.plus_store_label || roast.location_hr_id;
  const storeId = profile?.plus_store || roast.location_hr_id;
  const machineName = profile?.roastertype || roast.machine;
  const operatorName = profile?.operator || roast.operator;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/roasts')} aria-label="Назад">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {canEditRoasts ? (
                <button
                  type="button"
                  onClick={() => setShowEditRoastInfoDialog(true)}
                  className="hover:text-brand dark:hover:text-brand hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 rounded px-1 -mx-1 inline-flex items-center gap-1"
                  title="Нажмите для редактирования названия, веса, машины, оператора"
                >
                  {displayTitle}
                  <Pencil className="w-4 h-4 opacity-60" />
                </button>
              ) : (
                <span>{displayTitle}</span>
              )}
            </h1>
            {roastDate && (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{formatDateTime(roastDate)}</p>
            )}
            {/* .alog file status indicator */}
            <div className="mt-2 flex items-center gap-2">
              {hasAlogFile ? (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Профиль .alog загружен
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Профиль .alog не загружен
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {downloadError && <p className="text-sm text-red-600">{downloadError}</p>}
          <div className="flex gap-2">
            {hasAlogFile ? (
              <Button variant="outline" size="sm" onClick={handleDownloadProfile}>
                <Download className="w-4 h-4 mr-2" />
                Скачать профиль
              </Button>
            ) : canEditRoasts ? (
              <div>
                <input
                  type="file"
                  accept=".alog"
                  id="roast-detail-file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('roast-detail-file')?.click()}
                  disabled={uploadProfileMutation.isPending}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить профиль
                </Button>
              </div>
            ) : null}
            {canEditRoasts && roast?.is_reference ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditBeansNotesDialog(true)}
                  title="Редактировать заметки для Beans"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Заметки Beans
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!window.confirm('Убрать этот профиль из эталонов?')) return;
                    if (id) removeRefMutation.mutate(id);
                  }}
                  disabled={removeRefMutation.isPending}
                  title="Убрать из эталонов"
                >
                  <StarOff className="w-4 h-4 mr-2" />
                  Убрать из эталонов
                </Button>
              </>
            ) : canEditRoasts && !roast?.is_reference ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowCreateRefDialog(true)} title="Создать новый эталон">
                  <Star className="w-4 h-4 mr-2" />
                  Создать эталон
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowReplaceRefDialog(true)} title="Заменить существующий эталон">
                  <Replace className="w-4 h-4 mr-2" />
                  Заменить эталон
                </Button>
              </>
            ) : null}
            {canEditRoasts && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!window.confirm('Удалить эту обжарку? Склад будет восстановлен.')) return;
                  if (id) deleteRoastMutation.mutate(id);
                }}
                disabled={deleteRoastMutation.isPending}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/50"
                title="Удалить обжарку"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Диалоги эталонов */}
      {showCreateRefDialog && roast && id && (
        <CreateReferenceDialog
          onClose={() => setShowCreateRefDialog(false)}
          onSubmit={(body) => createRefMutation.mutate({ roastId: id!, body })}
          isSubmitting={createRefMutation.isPending}
        />
      )}
      {showReplaceRefDialog && roast && id && (
        <ReplaceReferenceDialog
          currentRoast={roast}
          onClose={() => setShowReplaceRefDialog(false)}
          onSubmit={(body) => replaceRefMutation.mutate({ roastId: id!, body })}
          isSubmitting={replaceRefMutation.isPending}
        />
      )}
      {showEditBeansNotesDialog && roast && id && (
        <EditReferenceBeansNotesDialog
          currentNotes={roast.reference_beans_notes}
          onClose={() => setShowEditBeansNotesDialog(false)}
          onSubmit={(notes) => updateBeansNotesMutation.mutate({ roastId: id!, notes })}
          isSubmitting={updateBeansNotesMutation.isPending}
        />
      )}
      {canEditRoasts && showEditRoastInfoDialog && roast && id && (
        <EditRoastInfoDialog
          roast={roast}
          onClose={() => setShowEditRoastInfoDialog(false)}
          onSubmit={async (data) => {
            await updateRoastInfoMutation.mutateAsync({ roastId: id!, data });
          }}
          isSubmitting={updateRoastInfoMutation.isPending}
        />
      )}

      {/* Блоки Сводка и Информация на одном уровне */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Block (Сводка) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Сводка</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
            <SummaryRow label="Батч:" value={batchNumberDisplay || '—'} />
            
            {roast.blend_spec ? (
              <>
                <SummaryRow
                  label="Бленд:"
                  value={`${roast.blend_hr_id || ''} ${roast.blend_spec.label || ''}`}
                />
                <div className="py-2 border-b border-gray-100 dark:border-gray-600">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Кофе:</span>
                  <div className="mt-1 space-y-1">
                    {roast.blend_spec.ingredients.map((ing, idx) => {
                      const weight = (ing.ratio * (greenWeight || 0)).toFixed(2);
                      const percent = (ing.ratio * 100).toFixed(0);
                      return (
                        <div key={idx} className="text-sm text-gray-900 dark:text-gray-100 pl-4">
                          <span className="text-violet-600 dark:text-violet-400 font-medium">{ing.coffee}</span>
                          {ing.label ? ` ${ing.label}` : ''} — {weight} кг ({percent}%)
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <SummaryRow 
                label="Кофе:" 
                value={
                  <span>
                    {profile?.plus_coffee && (
                      <span className="text-violet-600 dark:text-violet-400 font-medium">{profile.plus_coffee} </span>
                    )}
                    {beans || roast.coffee_id || '—'}
                  </span>
                } 
              />
            )}
            
            {profile?.roastingnotes && (
              <SummaryRow label="Референс:" value={profile.roastingnotes || '—'} />
            )}
            
            <SummaryRow
              label="Начальный вес / Конечный вес (Ужарка):"
              value={
                greenWeight
                  ? `${greenWeight} кг / ${roastedWeight ?? '—'} кг${
                      weightLoss != null ? ` (${weightLoss.toFixed(2)}%)` : ''
                    }`
                  : null
              }
              onClick={canEditRoasts ? () => setShowEditRoastInfoDialog(true) : undefined}
            />
            
            {(storeName || storeId) && (
              <SummaryRow label="Склад:" value={`${storeId || ''} ${storeName || ''}`} />
            )}
            
            <SummaryRow label="Машина:" value={machineName} onClick={canEditRoasts ? () => setShowEditRoastInfoDialog(true) : undefined} />
            
            <SummaryRow
              label="Оператор:"
              value={
                operatorName
                  ? `${operatorName}${roast.email ? ` (${roast.email})` : ''}`
                  : null
              }
              onClick={canEditRoasts ? () => setShowEditRoastInfoDialog(true) : undefined}
            />
            
            <SummaryRow label="Дата:" value={roastDate ? formatDateTime(roastDate) : null} />
            
            {(roast.whole_color > 0 || roast.ground_color > 0 || profile?.whole_color || profile?.ground_color) && (
              <SummaryRow
                label="Цвет:"
                value={`${roast.whole_color || (profile?.whole_color as number) || '—'} / ${roast.ground_color || (profile?.ground_color as number) || '—'}`}
              />
            )}
            
            {roast.cupping_score > 0 && (
              <SummaryRow label="Оценка:" value={roast.cupping_score} />
            )}
            
            {(roast.notes || profile?.roastingnotes) && (
              <SummaryRow label="Заметки:" value={roast.notes || profile?.roastingnotes} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Information Block */}
      <Card>
        <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div className="space-y-0">
              <InfoRow label="Батч" value={batchNumberDisplay || '—'} />
              <InfoRow label="Дата" value={roastDate ? formatDateTime(roastDate) : '—'} />
              {roast.schedule_id && (
                <InfoRow
                  label="Schedule"
                  value={
                    <Link
                      to="/schedule"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Calendar className="w-4 h-4" />
                      View schedule
                    </Link>
                  }
                />
              )}
              {roast.cupping_score > 0 && <InfoRow label="Оценка" value={roast.cupping_score} />}
              {(roast.notes || profile?.roastingnotes) && (
                <InfoRow label="Заметки" value={roast.notes || profile?.roastingnotes || '—'} />
              )}
              {(roast.whole_color > 0 || roast.ground_color > 0 || profile?.whole_color || profile?.ground_color) && (
                <InfoRow label="Цвет" value={`${roast.whole_color || (profile?.whole_color as number) || '—'} / ${roast.ground_color || (profile?.ground_color as number) || '—'}`} />
              )}
              <InfoRow
                label="Начальный / конечный вес"
                value={`${greenWeight ?? '—'} кг / ${roastedWeight ?? '—'} кг`}
              />
              <InfoRow label="Ужарка" value={weightLoss != null ? `${weightLoss.toFixed(2)}%` : '—'} />
            </div>
            <div className="space-y-0">
              <InfoRow
                label="Температура загрузки"
                value={
                  (computed?.CHARGE_BT ?? roast.charge_temp)
                    ? `${(computed?.CHARGE_BT ?? roast.charge_temp)?.toFixed(1)}°${tempUnit}`
                    : '—'
                }
              />
              <InfoRow
                label="Разворот"
                value={
                  (computed?.TP_time ?? roast.TP_time) != null && (computed?.TP_BT ?? roast.TP_temp) != null
                    ? `${formatTimeMMSS(computed?.TP_time ?? roast.TP_time!)} – ${(computed?.TP_BT ?? roast.TP_temp)?.toFixed(1)}°${tempUnit}`
                    : '—'
                }
              />
              <InfoRow
                label="Сушка"
                value={
                  (computed?.DRY_time ?? roast.DRY_time) != null && (computed?.DRY_BT ?? roast.DRY_temp) != null
                    ? `${formatTimeMMSS(computed?.DRY_time ?? roast.DRY_time!)} – ${(computed?.DRY_BT ?? roast.DRY_temp)?.toFixed(0)}°${tempUnit}`
                    : '—'
                }
              />
              <InfoRow
                label="Первый крэк"
                value={
                  (computed?.FCs_time ?? roast.FCs_time) != null && (computed?.FCs_BT ?? roast.FCs_temp) != null
                    ? `${formatTimeMMSS(computed?.FCs_time ?? roast.FCs_time!)} – ${(computed?.FCs_BT ?? roast.FCs_temp)?.toFixed(1)}°${tempUnit}`
                    : '—'
                }
              />
              <InfoRow
                label="Выгрузка"
                value={
                  (computed?.DROP_time ?? roast.drop_time) != null && (computed?.DROP_BT ?? roast.drop_temp) != null
                    ? `${formatTimeMMSS(computed?.DROP_time ?? roast.drop_time!)} – ${(computed?.DROP_BT ?? roast.drop_temp)?.toFixed(1)}°${tempUnit}`
                    : '—'
                }
              />
              <InfoRow
                label="Общее время"
                value={(computed?.totaltime ?? roast.drop_time) ? formatTimeMMSS(computed?.totaltime ?? roast.drop_time!) : '—'}
              />
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-600">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Фазы обжарки</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 text-center">
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Сушка</div>
                <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                  {(computed?.dryphasetime ?? computed?.DRY_time ?? roast.DRY_time)
                    ? formatTimeMMSS(computed?.dryphasetime ?? computed?.DRY_time ?? roast.DRY_time!)
                    : '—'}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {phases.dryPercent != null ? `${phases.dryPercent.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3 text-center">
                <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">Маяр</div>
                <div className="text-lg font-semibold text-orange-700 dark:text-orange-300">
                  {(computed?.midphasetime ?? phases.mailardTime)
                    ? formatTimeMMSS(computed?.midphasetime ?? phases.mailardTime!)
                    : '—'}
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  {phases.mailardPercent != null ? `${phases.mailardPercent.toFixed(1)}%` : '—'}
                </div>
              </div>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center">
                <div className="text-xs text-red-600 dark:text-red-400 mb-1">Развитие</div>
                <div className="text-lg font-semibold text-red-700 dark:text-red-300">
                  {(computed?.finishphasetime ?? roast.DEV_time)
                    ? formatTimeMMSS(computed?.finishphasetime ?? roast.DEV_time!)
                    : '—'}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">
                  {roast.DEV_ratio != null
                    ? `${roast.DEV_ratio.toFixed(1)}%`
                    : phases.devPercent != null
                      ? `${phases.devPercent.toFixed(1)}%`
                      : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Расширенная статистика (AUC, MET, RoR) */}
          {computed && (computed.AUC != null || computed.MET != null || computed.fcs_ror != null || computed.total_ror != null) && (
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Расширенная статистика</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {computed.AUC != null && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">AUC</div>
                    <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">{computed.AUC}</div>
                    {computed.AUCbase != null && (
                      <div className="text-xs text-blue-500 dark:text-blue-400">база: {computed.AUCbase}°</div>
                    )}
                  </div>
                )}
                {computed.MET != null && (
                  <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-red-600 dark:text-red-400 mb-1">MET</div>
                    <div className="text-lg font-semibold text-red-700 dark:text-red-300">{computed.MET.toFixed(1)}°{tempUnit}</div>
                    <div className="text-xs text-red-500 dark:text-red-400">макс. ET</div>
                  </div>
                )}
                {computed.fcs_ror != null && (
                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">RoR @ FC</div>
                    <div className="text-lg font-semibold text-orange-700 dark:text-orange-300">{computed.fcs_ror.toFixed(1)}°/мин</div>
                  </div>
                )}
                {computed.total_ror != null && (
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">Общий RoR</div>
                    <div className="text-lg font-semibold text-green-700 dark:text-green-300">{computed.total_ror.toFixed(1)}°/мин</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RoR по фазам */}
          {computed && (computed.dry_phase_ror != null || computed.mid_phase_ror != null || computed.finish_phase_ror != null) && (
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">RoR по фазам</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 text-center">
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Сушка</div>
                  <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                    {computed.dry_phase_ror != null ? `${computed.dry_phase_ror.toFixed(1)}°/мин` : '—'}
                  </div>
                  {computed.dry_phase_delta_temp != null && (
                    <div className="text-xs text-amber-500 dark:text-amber-400">Δ{computed.dry_phase_delta_temp.toFixed(1)}°</div>
                  )}
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3 text-center">
                  <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">Майяр</div>
                  <div className="text-lg font-semibold text-orange-700 dark:text-orange-300">
                    {computed.mid_phase_ror != null ? `${computed.mid_phase_ror.toFixed(1)}°/мин` : '—'}
                  </div>
                  {computed.mid_phase_delta_temp != null && (
                    <div className="text-xs text-orange-500 dark:text-orange-400">Δ{computed.mid_phase_delta_temp.toFixed(1)}°</div>
                  )}
                </div>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center">
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1">Развитие</div>
                  <div className="text-lg font-semibold text-red-700 dark:text-red-300">
                    {computed.finish_phase_ror != null ? `${computed.finish_phase_ror.toFixed(1)}°/мин` : '—'}
                  </div>
                  {computed.finish_phase_delta_temp != null && (
                    <div className="text-xs text-red-500 dark:text-red-400">Δ{computed.finish_phase_delta_temp.toFixed(1)}°</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AUC по фазам */}
          {computed && (computed.dry_phase_AUC != null || computed.mid_phase_AUC != null || computed.finish_phase_AUC != null) && (
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">AUC по фазам</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 text-center">
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Сушка</div>
                  <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">{computed.dry_phase_AUC ?? '—'}</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-3 text-center">
                  <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">Майяр</div>
                  <div className="text-lg font-semibold text-orange-700 dark:text-orange-300">{computed.mid_phase_AUC ?? '—'}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3 text-center">
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1">Развитие</div>
                  <div className="text-lg font-semibold text-red-700 dark:text-red-300">{computed.finish_phase_AUC ?? '—'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Параметры зерна */}
          {profile && (profile.moisture_greens != null || profile.density != null || profile.drumspeed || profile.organization) && (
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Параметры</h4>
              <div className="grid grid-cols-2 gap-x-8">
                {profile.moisture_greens != null && (
                  <InfoRow label="Влажность зерна" value={`${profile.moisture_greens}%`} />
                )}
                {profile.density != null && Array.isArray(profile.density) && profile.density.length >= 4 && (
                  <InfoRow 
                    label="Плотность" 
                    value={`${profile.density[0]} ${profile.density[1]}/${profile.density[2]} ${profile.density[3]}`} 
                  />
                )}
                {profile.drumspeed && (
                  <InfoRow label="Скорость барабана" value={profile.drumspeed} />
                )}
                {profile.organization && (
                  <InfoRow label="Организация" value={profile.organization} />
                )}
                {profile.machinesetup && (
                  <InfoRow label="Настройка машины" value={profile.machinesetup} />
                )}
                {profile.beansize_min && profile.beansize_max && profile.beansize_min !== '0' && (
                  <InfoRow label="Размер зерна" value={`${profile.beansize_min} - ${profile.beansize_max}`} />
                )}
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-600">
            <div className="grid grid-cols-2 gap-x-8">
              <InfoRow label="Машина" value={machineName || '—'} />
              <InfoRow
                label="Оператор"
                value={operatorName ? `${operatorName}${roast.email ? ` (${roast.email})` : ''}` : '—'}
              />
            </div>
          </div>

          {!(computed?.CHARGE_BT ?? computed?.TP_time ?? computed?.DRY_time ?? computed?.FCs_time ?? computed?.DROP_time ?? roast?.charge_temp ?? roast?.TP_time ?? roast?.DRY_time ?? roast?.FCs_time ?? roast?.drop_time) && (
            <p className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
              Данные о фазах (загрузка, разворот, сушка, первый крэк, выгрузка) берутся из загруженного профиля .alog с разметкой Artisan или из полей обжарки в БД. Если обжарка создана вручную без профиля или профиль без разметки событий — эти поля будут пустыми.
            </p>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Goals check */}
      {roast && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Target className="w-5 h-5 text-brand" />
              {t('roastDetail.goalsCheck')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roast.goals_check ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                      roast.goals_check.status === 'green'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                        : roast.goals_check.status === 'red'
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'
                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {roast.goals_check.status === 'green' && <CheckCircle className="w-4 h-4" />}
                    {roast.goals_check.status === 'red' && <AlertCircle className="w-4 h-4" />}
                    {roast.goals_check.status === 'yellow' && <HelpCircle className="w-4 h-4" />}
                    {roast.goals_check.status === 'green'
                      ? t('roasts.goalsStatusGreen')
                      : roast.goals_check.status === 'red'
                      ? t('roasts.goalsStatusRed')
                      : t('roasts.goalsStatusYellow')}
                  </span>
                  {roast.goals_check.reference_roast_id && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t('roastDetail.referenceRoast')}:{' '}
                      <Link to={`/roasts/${roast.goals_check.reference_roast_id}`} className="text-brand hover:underline">
                        {roast.goals_check.reference_roast_id.slice(0, 8)}…
                      </Link>
                    </span>
                  )}
                </div>
                {roast.goals_check.message && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">{roast.goals_check.message}</p>
                )}
                <div className="space-y-3">
                  {roast.goals_check.goals.map((g) => (
                    <div
                      key={g.goal_id}
                      className={`rounded-lg border p-3 ${
                        g.status === 'green'
                          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20'
                          : g.status === 'red'
                          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
                          : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">
                        {g.status === 'green' && <CheckCircle className="w-4 h-4 text-green-600" />}
                        {g.status === 'red' && <AlertCircle className="w-4 h-4 text-red-600" />}
                        {g.status === 'yellow' && <HelpCircle className="w-4 h-4 text-amber-600" />}
                        {g.goal_name}
                      </div>
                      <ul className="space-y-1 text-xs">
                        {Object.entries(g.parameters).map(([paramKey, param]) => (
                          <li
                            key={paramKey}
                            className={`flex justify-between gap-2 ${
                              param.status === 'green'
                                ? 'text-green-700 dark:text-green-300'
                                : param.status === 'red'
                                ? 'text-red-700 dark:text-red-300'
                                : 'text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            <span className="font-mono">{paramKey}</span>
                            <span>
                              {param.actual != null && param.reference != null
                                ? `${param.actual.toFixed(1)} / ${param.reference.toFixed(1)}`
                                : param.message ?? param.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('roastDetail.goalsCheckNoData')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Temperature Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Температура</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Legend with checkboxes - Coffeewave Plus style */}
            <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-gray-100 dark:border-gray-600">
              <LegendCheckbox checked={showET} onChange={() => setShowET(!showET)} color="#dc2626" label="ET" />
              <LegendCheckbox checked={showDeltaET} onChange={() => setShowDeltaET(!showDeltaET)} color="#fca5a5" label="ΔET" />
              <LegendCheckbox checked={showBT} onChange={() => setShowBT(!showBT)} color="#2563eb" label="BT" />
              <LegendCheckbox checked={showDeltaBT} onChange={() => setShowDeltaBT(!showDeltaBT)} color="#93c5fd" label="ΔBT" />
              {(telemetry?.air || airEvents.length > 0) && (
                <LegendCheckbox checked={showAir} onChange={() => setShowAir(!showAir)} color="#3b82f6" label="Air" />
              )}
              {(telemetry?.drum || drumEvents.length > 0) && (
                <LegendCheckbox checked={showDrum} onChange={() => setShowDrum(!showDrum)} color="#10b981" label="Drum" />
              )}
              {(telemetry?.gas || gasEvents.length > 0) && (
                <LegendCheckbox checked={showGas} onChange={() => setShowGas(!showGas)} color="#f59e0b" label="Gas" />
              )}
              <LegendCheckbox checked={showEvents} onChange={() => setShowEvents(!showEvents)} color="#6b7280" label="События" />
              <LegendCheckbox checked={showPhaseZones} onChange={() => setShowPhaseZones(!showPhaseZones)} color="#e5e7eb" label="Фазы" />
              
              {/* RoR period selector */}
              <div className="flex items-center gap-2 ml-4 border-l border-gray-200 dark:border-gray-600 pl-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">RoR:</span>
                <button
                  onClick={() => setRorPeriod(30)}
                  className={`px-2 py-1 text-xs rounded ${rorPeriod === 30 ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                >
                  30s
                </button>
                <button
                  onClick={() => setRorPeriod(60)}
                  className={`px-2 py-1 text-xs rounded ${rorPeriod === 60 ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                >
                  60s
                </button>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  
                  {/* Phase zones (colored backgrounds): Сушка → Майяра → Развитие */}
                  {/* Use phaseTimes from profile.timeindex for accurate positioning */}
                  {showPhaseZones && phaseTimes?.dry != null && (
                    <ReferenceArea
                      x1={phaseTimes.charge}
                      x2={phaseTimes.dry}
                      yAxisId="temp"
                      fill="#dbeafe"
                      fillOpacity={0.4}
                      label={{ value: 'Сушка', position: 'insideTop', fontSize: 11, fill: '#1e40af', fontWeight: 600 }}
                    />
                  )}
                  {showPhaseZones && phaseTimes?.dry != null && phaseTimes?.fcs != null && (
                    <ReferenceArea
                      x1={phaseTimes.dry}
                      x2={phaseTimes.fcs}
                      yAxisId="temp"
                      fill="#fef3c7"
                      fillOpacity={0.4}
                      label={{ value: 'Майяра', position: 'insideTop', fontSize: 11, fill: '#92400e', fontWeight: 600 }}
                    />
                  )}
                  {showPhaseZones && phaseTimes?.fcs != null && phaseTimes?.drop != null && (
                    <ReferenceArea
                      x1={phaseTimes.fcs}
                      x2={phaseTimes.drop}
                      yAxisId="temp"
                      fill="#fecaca"
                      fillOpacity={0.4}
                      label={{ value: 'Развитие', position: 'insideTop', fontSize: 11, fill: '#991b1b', fontWeight: 600 }}
                    />
                  )}
                  
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={[0, 'dataMax']}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(t) => formatTimeMMSS(t)}
                  />
                  <YAxis
                    yAxisId="temp"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 12 }}
                    label={{ value: `°${tempUnit}`, angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="ror"
                    orientation="right"
                    domain={[0, 25]}
                    ticks={[0, 5, 10, 15, 20, 25]}
                    allowDataOverflow={true}
                    tick={{ fontSize: 11 }}
                    label={{ value: '°/min', angle: 90, position: 'insideRight', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'BT' || name === 'ET') return [`${value?.toFixed(1)}°${tempUnit}`, name];
                      if (name === 'ΔBT' || name === 'ΔET') return [`${value?.toFixed(1)}°/min`, name];
                      return [value?.toFixed(1), name];
                    }}
                    labelFormatter={(label: number) => `Время: ${formatTimeMMSS(label)}`}
                  />

                  {/* Temperature lines */}
                  {showET && (
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="ET"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={false}
                      name="ET"
                    />
                  )}
                  {showBT && (
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="BT"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      name="BT"
                    />
                  )}

                  {/* RoR lines */}
                  {showDeltaET && (
                    <Line
                      yAxisId="ror"
                      type="monotone"
                      dataKey="deltaET"
                      stroke="#fca5a5"
                      strokeWidth={1}
                      dot={false}
                      name="ΔET"
                    />
                  )}
                  {showDeltaBT && (
                    <Line
                      yAxisId="ror"
                      type="monotone"
                      dataKey="deltaBT"
                      stroke="#93c5fd"
                      strokeWidth={1}
                      dot={false}
                      name="ΔBT"
                    />
                  )}

                  {/* Note: Gas/Air/Drum are shown as event markers on BT curve, not as separate lines */}

                  {/* Event markers - vertical dashed lines */}
                  {showEvents &&
                    events.map((event) => (
                      <ReferenceLine
                        key={`line-${event.name}`}
                        x={event.time}
                        yAxisId="temp"
                        stroke={event.color}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                    ))}
                  
                  {/* Event dots with labels (CHARGE, TP, DRY, FC, DROP) */}
                  {showEvents && profile?.timex && profile?.temp2 &&
                    events.map((event) => {
                      // IMPORTANT: Use profile data directly (not telemetry from DB)
                      // because timeindex refers to profile.timex/temp2 arrays
                      const ti = profile.timeindex;
                      const timex = profile.timex;
                      const temp2 = profile.temp2; // BT in Artisan
                      
                      let eventIdx = -1;
                      
                      if (ti && ti.length >= 7) {
                        if (event.name === 'Charge' && ti[0] >= 0) eventIdx = ti[0];
                        else if (event.name === 'Dry' && ti[1] >= 0) eventIdx = ti[1];
                        else if (event.name === 'FC' && ti[2] >= 0) eventIdx = ti[2];
                        else if (event.name === 'Drop' && ti[6] >= 0) eventIdx = ti[6];
                        else if (event.name === 'TP') {
                          // TP is the minimum BT between CHARGE and DRY (or FCs if DRY not set)
                          if (!temp2) {
                            eventIdx = -1;
                          } else {
                            const startIdx = ti[0] >= 0 ? ti[0] : 0;
                            const endIdx = ti[1] >= 0 ? ti[1] : (ti[2] >= 0 ? ti[2] : Math.min(temp2.length - 1, 200));
                            let minBT = Infinity;
                            let minIdx = startIdx;
                            for (let i = startIdx; i <= endIdx && i < temp2.length; i++) {
                              if (temp2[i] < minBT) {
                                minBT = temp2[i];
                                minIdx = i;
                              }
                            }
                            eventIdx = minIdx;
                          }
                        }
                      }
                      
                      // Fallback: search by time if timeindex not available
                      if (eventIdx < 0 && timex) {
                        let bestDiff = Infinity;
                        for (let i = 0; i < timex.length; i++) {
                          const diff = Math.abs(timex[i] - event.time);
                          if (diff < bestDiff) {
                            bestDiff = diff;
                            eventIdx = i;
                          }
                        }
                      }
                      
                      if (!temp2 || !timex || eventIdx < 0 || eventIdx >= temp2.length) return null;
                      
                      // Get actual BT value at this index (temp2 = BT in Artisan)
                      const actualBT = temp2[eventIdx];
                      const actualTime = timex[eventIdx];
                      
                      if (actualBT == null) return null;
                      
                      const displayName = event.name === 'Charge' ? 'CHARGE' 
                        : event.name === 'Dry' ? 'DE'
                        : event.name === 'Drop' ? 'DROP'
                        : event.name;
                      // Use event.time for label (relative time from CHARGE), but actualBT for temperature
                      const labelText = `${displayName} ${formatTimeMMSS(event.time)} / ${actualBT.toFixed(1)}°`;
                      
                      // Position labels based on event type to avoid overlapping
                      const position: 'top' | 'bottom' = 
                        event.name === 'TP' ? 'top' : 
                        event.name === 'Charge' ? 'top' :
                        event.name === 'Drop' ? 'top' :
                        'bottom';
                      
                      return (
                        <ReferenceDot
                          key={`dot-${event.name}`}
                          x={Math.round(actualTime)}
                          y={actualBT}
                          yAxisId="temp"
                          r={6}
                          fill={event.color}
                          stroke="#fff"
                          strokeWidth={2}
                          label={{
                            value: labelText,
                            position: position,
                            fill: event.color,
                            fontSize: 10,
                            fontWeight: 600,
                            offset: 15,
                          }}
                        />
                      );
                    })}
                  
                  {/* Gas event markers (G35, G70, G100, etc.) - diamond shape */}
                  {showGas && gasEvents.map((gasEvent, idx) => {
                    const dataPoint = chartData.find(d => Math.abs(d.time - gasEvent.time) < DOWNSAMPLE_STEP * 2);
                    if (!dataPoint) return null;
                    const btValue = dataPoint.BT;
                    if (btValue == null) return null;
                    
                    return (
                      <ReferenceDot
                        key={`gas-${idx}`}
                        x={dataPoint.time}
                        y={btValue}
                        yAxisId="temp"
                        r={0}
                        shape={(props) => (
                          <g transform={`translate(${props.cx},${props.cy})`}>
                            {/* Diamond shape */}
                            <polygon
                              points="0,-10 10,0 0,10 -10,0"
                              fill="#f59e0b"
                              stroke="#fff"
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={4}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={7}
                              fontWeight="bold"
                            >
                              {gasEvent.label}
                            </text>
                          </g>
                        )}
                      />
                    );
                  })}
                  
                  {/* Air event markers (A50, A80, etc.) - diamond shape */}
                  {showAir && airEvents.map((airEvent, idx) => {
                    const dataPoint = chartData.find(d => Math.abs(d.time - airEvent.time) < DOWNSAMPLE_STEP * 2);
                    if (!dataPoint) return null;
                    const btValue = dataPoint.BT;
                    if (btValue == null) return null;
                    
                    return (
                      <ReferenceDot
                        key={`air-${idx}`}
                        x={dataPoint.time}
                        y={btValue}
                        yAxisId="temp"
                        r={0}
                        shape={(props) => (
                          <g transform={`translate(${props.cx},${props.cy})`}>
                            <polygon
                              points="0,-10 10,0 0,10 -10,0"
                              fill="#3b82f6"
                              stroke="#fff"
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={4}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={7}
                              fontWeight="bold"
                            >
                              {airEvent.label}
                            </text>
                          </g>
                        )}
                      />
                    );
                  })}
                  
                  {/* Drum event markers (D51, etc.) - diamond shape */}
                  {showDrum && drumEvents.map((drumEvent, idx) => {
                    const dataPoint = chartData.find(d => Math.abs(d.time - drumEvent.time) < DOWNSAMPLE_STEP * 2);
                    if (!dataPoint) return null;
                    const btValue = dataPoint.BT;
                    if (btValue == null) return null;
                    
                    return (
                      <ReferenceDot
                        key={`drum-${idx}`}
                        x={dataPoint.time}
                        y={btValue}
                        yAxisId="temp"
                        r={0}
                        shape={(props) => (
                          <g transform={`translate(${props.cx},${props.cy})`}>
                            <polygon
                              points="0,-10 10,0 0,10 -10,0"
                              fill="#10b981"
                              stroke="#fff"
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={4}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={7}
                              fontWeight="bold"
                            >
                              {drumEvent.label}
                            </text>
                          </g>
                        )}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meta info */}
      <Card>
        <CardHeader>
            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Мета</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p>ID: {roast.id}</p>
          {roast.created_at && <p>Создано: {formatDateTime(roast.created_at)}</p>}
          {roast.updated_at && <p>Обновлено: {formatDateTime(roast.updated_at)}</p>}
          {roast.modified_at && <p>Modified: {formatDateTime(roast.modified_at)}</p>}
        </CardContent>
      </Card>
    </div>
  );
};
