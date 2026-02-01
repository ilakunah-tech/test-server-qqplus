import { useState, useEffect } from 'react';
import { createBlend, updateBlend, Blend, BlendCreate } from '@/api/blends';
import { inventoryApi } from '@/api/inventory';
import { Coffee } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatWeight } from '@/utils/formatters';

interface BlendFormProps {
  blend?: Blend;
  onSuccess: () => void;
  onCancel: () => void;
}

type CoffeeOption = Coffee & { displayName: string };

export function BlendForm({ blend, onSuccess, onCancel }: BlendFormProps) {
  const [name, setName] = useState(blend?.name ?? '');
  const [description, setDescription] = useState(blend?.description ?? '');
  const [components, setComponents] = useState<{ coffee_id: string; percentage: number }[]>(
    blend?.recipe?.length
      ? blend.recipe.map((c) => ({ coffee_id: c.coffee_id, percentage: c.percentage }))
      : [
          { coffee_id: '', percentage: 0 },
          { coffee_id: '', percentage: 0 },
        ]
  );
  const [coffees, setCoffees] = useState<CoffeeOption[]>([]);
  const [availableWeight, setAvailableWeight] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCoffees = async () => {
      try {
        const res = await inventoryApi.getCoffees();
        const items = res.data.items.map((c) => ({
          ...c,
          displayName: (c as Coffee & { label?: string }).label ?? c.name,
        }));
        setCoffees(items);
      } catch (e) {
        console.error('Failed to load coffees:', e);
      }
    };
    loadCoffees();
  }, []);

  useEffect(() => {
    const weights = components
      .map((c) => {
        const coffee = coffees.find((cf) => cf.id === c.coffee_id);
        if (!coffee || !c.percentage) return Infinity;
        const stock = coffee.stock_weight_kg ?? 0;
        return stock / (c.percentage / 100);
      })
      .filter((w) => w !== Infinity && !Number.isNaN(w));
    setAvailableWeight(weights.length ? Math.min(...weights) : 0);
  }, [components, coffees]);

  const addComponent = () => {
    setComponents([...components, { coffee_id: '', percentage: 0 }]);
  };

  const removeComponent = (index: number) => {
    if (components.length <= 2) return;
    setComponents(components.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: 'coffee_id' | 'percentage', value: string | number) => {
    const next = [...components];
    if (field === 'percentage') next[index].percentage = typeof value === 'number' ? value : parseInt(String(value), 10) || 0;
    else next[index].coffee_id = String(value);
    setComponents(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalPercentage = components.reduce((sum, c) => sum + c.percentage, 0);
    if (totalPercentage !== 100) {
      alert(`Recipe percentages must sum to 100%, got ${totalPercentage}%.`);
      return;
    }

    const coffeeIds = components.map((c) => c.coffee_id).filter(Boolean);
    const uniqueIds = new Set(coffeeIds);
    if (uniqueIds.size !== coffeeIds.length) {
      alert('Each coffee can only appear once in the recipe.');
      return;
    }

    if (components.length < 2) {
      alert('Recipe must have at least 2 components.');
      return;
    }

    const invalid = components.some((c) => !c.coffee_id || c.percentage < 1 || c.percentage > 100);
    if (invalid) {
      alert('Please select a coffee and set percentage (1–100) for each component.');
      return;
    }

    const data: BlendCreate = {
      name,
      description: description || undefined,
      recipe: components.map((c) => ({ coffee_id: c.coffee_id, percentage: c.percentage })),
    };

    setSaving(true);
    try {
      if (blend) {
        await updateBlend(blend.id, data);
      } else {
        await createBlend(data);
      }
      onSuccess();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail || 'Failed to save blend');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="blend-name">Name *</Label>
        <Input
          id="blend-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Blend Name"
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="blend-desc">Description</Label>
        <textarea
          id="blend-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className="mt-1 flex w-full rounded-input border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Recipe components (min 2, sum = 100%)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addComponent}>
            Add component
          </Button>
        </div>
        <div className="space-y-2">
          {components.map((comp, index) => (
            <div key={index} className="flex gap-2 items-center flex-wrap">
              <Select
                value={comp.coffee_id}
                onChange={(e) => updateComponent(index, 'coffee_id', e.target.value)}
                className="flex-1 min-w-[180px]"
              >
                <option value="">Select coffee</option>
                {coffees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} ({c.stock_weight_kg != null ? formatWeight(c.stock_weight_kg) : '—'})
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={1}
                max={100}
                placeholder="%"
                value={comp.percentage || ''}
                onChange={(e) => updateComponent(index, 'percentage', e.target.value)}
                className="w-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeComponent(index)}
                disabled={components.length <= 2}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Available blend weight: <strong>{Number.isFinite(availableWeight) ? formatWeight(availableWeight) : '—'}</strong>
      </p>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {blend ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
