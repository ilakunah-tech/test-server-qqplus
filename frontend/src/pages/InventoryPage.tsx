import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/api/inventory';
import { Coffee, Batch } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Package } from 'lucide-react';
import { formatDate, formatWeight } from '@/utils/formatters';

export const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState<'coffees' | 'batches'>('coffees');
  const [showCoffeeForm, setShowCoffeeForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: coffeesData } = useQuery({
    queryKey: ['coffees'],
    queryFn: () => inventoryApi.getCoffees(),
  });

  const { data: batchesData } = useQuery({
    queryKey: ['batches'],
    queryFn: () => inventoryApi.getBatches(),
  });

  const createCoffeeMutation = useMutation({
    mutationFn: inventoryApi.createCoffee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coffees'] });
      setShowCoffeeForm(false);
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: inventoryApi.createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowBatchForm(false);
    },
  });

  const handleCoffeeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createCoffeeMutation.mutate({
      name: formData.get('name') as string,
      origin: formData.get('origin') as string || undefined,
      region: formData.get('region') as string || undefined,
      variety: formData.get('variety') as string || undefined,
      processing: formData.get('processing') as string || undefined,
      moisture: formData.get('moisture') ? parseFloat(formData.get('moisture') as string) : undefined,
      density: formData.get('density') ? parseFloat(formData.get('density') as string) : undefined,
    });
  };

  const handleBatchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createBatchMutation.mutate({
      coffee_id: formData.get('coffee_id') as string,
      lot_number: formData.get('lot_number') as string,
      green_stock_kg: parseFloat(formData.get('green_stock_kg') as string),
      roasted_total_kg: parseFloat(formData.get('roasted_total_kg') as string) || 0,
      status: (formData.get('status') as 'active' | 'depleted' | 'expired') || 'active',
      arrival_date: formData.get('arrival_date') ? formData.get('arrival_date') as string : undefined,
      expiration_date: formData.get('expiration_date') ? formData.get('expiration_date') as string : undefined,
      supplier: formData.get('supplier') as string || undefined,
      notes: formData.get('notes') as string || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Inventory</h2>
          <p className="text-gray-600 mt-1">Manage your coffee beans and batches</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setActiveTab('coffees')}
            variant={activeTab === 'coffees' ? 'default' : 'outline'}
          >
            Coffees
          </Button>
          <Button
            onClick={() => setActiveTab('batches')}
            variant={activeTab === 'batches' ? 'default' : 'outline'}
          >
            Batches
          </Button>
        </div>
      </div>

      {activeTab === 'coffees' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Coffees</h3>
            <Button onClick={() => setShowCoffeeForm(!showCoffeeForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Coffee
            </Button>
          </div>

          {showCoffeeForm && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Coffee</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCoffeeSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input id="name" name="name" required />
                    </div>
                    <div>
                      <Label htmlFor="origin">Origin</Label>
                      <Input id="origin" name="origin" />
                    </div>
                    <div>
                      <Label htmlFor="region">Region</Label>
                      <Input id="region" name="region" />
                    </div>
                    <div>
                      <Label htmlFor="variety">Variety</Label>
                      <Input id="variety" name="variety" />
                    </div>
                    <div>
                      <Label htmlFor="processing">Processing</Label>
                      <Input id="processing" name="processing" />
                    </div>
                    <div>
                      <Label htmlFor="moisture">Moisture (%)</Label>
                      <Input id="moisture" name="moisture" type="number" step="0.1" />
                    </div>
                    <div>
                      <Label htmlFor="density">Density (g/L)</Label>
                      <Input id="density" name="density" type="number" step="0.01" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={createCoffeeMutation.isPending}>
                      Create
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCoffeeForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coffeesData?.data.items.map((coffee) => (
              <Card key={coffee.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{coffee.name}</CardTitle>
                  <p className="text-sm text-gray-500">{coffee.hr_id}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    {coffee.origin && <p><span className="font-medium">Origin:</span> {coffee.origin}</p>}
                    {coffee.region && <p><span className="font-medium">Region:</span> {coffee.region}</p>}
                    {coffee.variety && <p><span className="font-medium">Variety:</span> {coffee.variety}</p>}
                    {coffee.processing && <p><span className="font-medium">Processing:</span> {coffee.processing}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Batches</h3>
            <Button onClick={() => setShowBatchForm(!showBatchForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Batch
            </Button>
          </div>

          {showBatchForm && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Batch</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBatchSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="coffee_id">Coffee *</Label>
                    <Select id="coffee_id" name="coffee_id" required>
                      <option value="">Select coffee</option>
                      {coffeesData?.data.items.map((coffee) => (
                        <option key={coffee.id} value={coffee.id}>
                          {coffee.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="lot_number">Lot Number *</Label>
                      <Input id="lot_number" name="lot_number" required />
                    </div>
                    <div>
                      <Label htmlFor="green_stock_kg">Green Stock (kg) *</Label>
                      <Input id="green_stock_kg" name="green_stock_kg" type="number" step="0.1" required />
                    </div>
                    <div>
                      <Label htmlFor="arrival_date">Arrival Date</Label>
                      <Input id="arrival_date" name="arrival_date" type="date" />
                    </div>
                    <div>
                      <Label htmlFor="expiration_date">Expiration Date</Label>
                      <Input id="expiration_date" name="expiration_date" type="date" />
                    </div>
                    <div>
                      <Label htmlFor="supplier">Supplier</Label>
                      <Input id="supplier" name="supplier" />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select id="status" name="status">
                        <option value="active">Active</option>
                        <option value="depleted">Depleted</option>
                        <option value="expired">Expired</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input id="notes" name="notes" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={createBatchMutation.isPending}>
                      Create
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowBatchForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchesData?.data.items.map((batch) => {
              const coffee = coffeesData?.data.items.find(c => c.id === batch.coffee_id);
              return (
                <Card key={batch.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{batch.lot_number}</CardTitle>
                    <p className="text-sm text-gray-500">{coffee?.name}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">Green Stock:</span>
                        <span>{formatWeight(batch.green_stock_kg)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Roasted:</span>
                        <span>{formatWeight(batch.roasted_total_kg)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Status:</span>
                        <span className={`px-2 py-1 rounded-button text-xs ${
                          batch.status === 'active' ? 'bg-green-100 text-green-800' :
                          batch.status === 'depleted' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {batch.status}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
