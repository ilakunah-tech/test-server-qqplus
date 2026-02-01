import { useState, useEffect } from 'react';
import { getBlends, deleteBlend, Blend, RecipeComponent } from '@/api/blends';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlendForm } from './BlendForm';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { formatWeight } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function formatRecipe(recipe: RecipeComponent[]) {
  return recipe
    .map((c) => `${c.coffee_name || 'Unknown'} (${c.percentage}%)`)
    .join(' + ');
}

export function BlendsList() {
  const [blends, setBlends] = useState<Blend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBlend, setEditingBlend] = useState<Blend | null>(null);

  const loadBlends = async () => {
    try {
      const data = await getBlends();
      setBlends(data.items);
    } catch (error) {
      console.error('Failed to load blends:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlends();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this blend? This action cannot be undone.')) return;
    try {
      await deleteBlend(id);
      await loadBlends();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail || 'Failed to delete blend');
    }
  };

  const handleEdit = (blend: Blend) => {
    setEditingBlend(blend);
  };

  const handleFormSuccess = () => {
    setShowCreateModal(false);
    setEditingBlend(null);
    loadBlends();
  };

  const handleFormCancel = () => {
    setShowCreateModal(false);
    setEditingBlend(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Blend
        </Button>
      </div>

      {showCreateModal && (
        <Card>
          <CardHeader>
            <CardTitle>Create Blend</CardTitle>
          </CardHeader>
          <CardContent>
            <BlendForm onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
          </CardContent>
        </Card>
      )}

      {editingBlend && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Blend</CardTitle>
          </CardHeader>
          <CardContent>
            <BlendForm
              blend={editingBlend}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-gray-500">Loading blends...</p>
      ) : (
        <div className="rounded-card border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-900">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Recipe</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Available Stock</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {blends.map((blend) => (
                <tr key={blend.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{blend.name}</td>
                  <td className="px-4 py-3 text-gray-700">{formatRecipe(blend.recipe)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {blend.available_weight_kg != null
                      ? formatWeight(blend.available_weight_kg)
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(blend)}
                        className="p-2"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(blend.id)}
                        className={cn('p-2 text-red-600 hover:text-red-700 hover:bg-red-50')}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {blends.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-500">No blends yet. Create one to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}
