import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roastsApi } from '@/api/roasts';
import { inventoryApi } from '@/api/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Upload, Download } from 'lucide-react';
import { formatDateTime, formatWeight, formatPercent, formatTime } from '@/utils/formatters';

export const RoastsPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const queryClient = useQueryClient();

  const { data: roastsData } = useQuery({
    queryKey: ['roasts', dateFrom, dateTo],
    queryFn: () => roastsApi.getRoasts(100, 0, dateFrom || undefined, dateTo || undefined),
  });

  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => inventoryApi.getBatches(),
  });

  const createRoastMutation = useMutation({
    mutationFn: roastsApi.createRoast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowForm(false);
    },
  });

  const uploadProfileMutation = useMutation({
    mutationFn: ({ roastId, file }: { roastId: string; file: File }) =>
      roastsApi.uploadProfile(roastId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roasts'] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const batchId = formData.get('batch_id') as string;
    const batch = batchesData?.data.items.find(b => b.id === batchId);
    
    createRoastMutation.mutate({
      batch_id: batchId,
      coffee_id: batch?.coffee_id || '',
      roast_date: new Date(formData.get('roast_date') as string).toISOString(),
      operator: formData.get('operator') as string || undefined,
      machine: formData.get('machine') as string || undefined,
      green_weight_kg: parseFloat(formData.get('green_weight_kg') as string),
      roasted_weight_kg: parseFloat(formData.get('roasted_weight_kg') as string),
      roast_time_sec: formData.get('roast_time_sec') ? parseInt(formData.get('roast_time_sec') as string) : undefined,
      drop_temp: formData.get('drop_temp') ? parseInt(formData.get('drop_temp') as string) : undefined,
      first_crack_temp: formData.get('first_crack_temp') ? parseInt(formData.get('first_crack_temp') as string) : undefined,
      first_crack_time: formData.get('first_crack_time') ? parseInt(formData.get('first_crack_time') as string) : undefined,
      agtron: formData.get('agtron') ? parseInt(formData.get('agtron') as string) : undefined,
      notes: formData.get('notes') as string || undefined,
    });
  };

  const handleFileUpload = (roastId: string, file: File) => {
    uploadProfileMutation.mutate({ roastId, file });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Roasts</h2>
          <p className="text-gray-600 mt-1">Manage your roast records</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Roast
        </Button>
      </div>

      <div className="flex gap-4">
        <div>
          <Label htmlFor="date_from">From Date</Label>
          <Input
            id="date_from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="date_to">To Date</Label>
          <Input
            id="date_to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Roast</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batch_id">Batch *</Label>
                  <Select id="batch_id" name="batch_id" required>
                    <option value="">Select batch</option>
                    {batchesData?.data.items.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.lot_number}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="roast_date">Roast Date *</Label>
                  <Input id="roast_date" name="roast_date" type="datetime-local" required />
                </div>
                <div>
                  <Label htmlFor="operator">Operator</Label>
                  <Input id="operator" name="operator" />
                </div>
                <div>
                  <Label htmlFor="machine">Machine</Label>
                  <Input id="machine" name="machine" />
                </div>
                <div>
                  <Label htmlFor="green_weight_kg">Green Weight (kg) *</Label>
                  <Input id="green_weight_kg" name="green_weight_kg" type="number" step="0.1" required />
                </div>
                <div>
                  <Label htmlFor="roasted_weight_kg">Roasted Weight (kg) *</Label>
                  <Input id="roasted_weight_kg" name="roasted_weight_kg" type="number" step="0.1" required />
                </div>
                <div>
                  <Label htmlFor="roast_time_sec">Roast Time (sec)</Label>
                  <Input id="roast_time_sec" name="roast_time_sec" type="number" />
                </div>
                <div>
                  <Label htmlFor="drop_temp">Drop Temp (°C)</Label>
                  <Input id="drop_temp" name="drop_temp" type="number" />
                </div>
                <div>
                  <Label htmlFor="first_crack_temp">First Crack Temp (°C)</Label>
                  <Input id="first_crack_temp" name="first_crack_temp" type="number" />
                </div>
                <div>
                  <Label htmlFor="first_crack_time">First Crack Time (sec)</Label>
                  <Input id="first_crack_time" name="first_crack_time" type="number" />
                </div>
                <div>
                  <Label htmlFor="agtron">Agtron</Label>
                  <Input id="agtron" name="agtron" type="number" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createRoastMutation.isPending}>
                  Create
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {roastsData?.data.items.map((roast) => (
          <Card key={roast.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{formatDateTime(roast.roast_date)}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {roast.operator || 'Unknown'} • {roast.machine || 'Unknown machine'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {roast.profile_file ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => roastsApi.downloadProfile(roast.id).then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${roast.id}.alog`;
                        a.click();
                      })}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept=".alog"
                        id={`file-${roast.id}`}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(roast.id, file);
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById(`file-${roast.id}`)?.click()}
                        disabled={uploadProfileMutation.isPending}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Green Weight</p>
                  <p className="font-medium">{formatWeight(roast.green_weight_kg)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Roasted Weight</p>
                  <p className="font-medium">{formatWeight(roast.roasted_weight_kg)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Weight Loss</p>
                  <p className="font-medium">
                    {roast.weight_loss_percent ? formatPercent(roast.weight_loss_percent) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Roast Time</p>
                  <p className="font-medium">
                    {roast.roast_time_sec ? formatTime(roast.roast_time_sec) : 'N/A'}
                  </p>
                </div>
                {roast.drop_temp && (
                  <div>
                    <p className="text-gray-500">Drop Temp</p>
                    <p className="font-medium">{roast.drop_temp}°C</p>
                  </div>
                )}
                {roast.agtron && (
                  <div>
                    <p className="text-gray-500">Agtron</p>
                    <p className="font-medium">{roast.agtron}</p>
                  </div>
                )}
              </div>
              {roast.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">{roast.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
