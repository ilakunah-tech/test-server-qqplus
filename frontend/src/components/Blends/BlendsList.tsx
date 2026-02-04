import { useState, useEffect } from 'react';
import { getBlends, deleteBlend, Blend, RecipeComponent } from '@/api/blends';
import { Button } from '@/components/ui/button';
import { BlendForm } from './BlendForm';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { formatWeight } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function formatRecipe(recipe: RecipeComponent[]) {
  return recipe
    .map((c) => `${c.coffee_name || 'Unknown'} (${c.percentage}%)`)
    .join(' + ');
}

const isBlendDialogOpen = (show: boolean, editing: Blend | null) => show || editing != null;

export function BlendsList() {
  const [blends, setBlends] = useState<Blend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBlend, setEditingBlend] = useState<Blend | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBlendDialogOpen(showCreateModal, editingBlend)) {
        setShowCreateModal(false);
        setEditingBlend(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreateModal, editingBlend]);

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
    setShowCreateModal(false);
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

  const openCreateDialog = () => {
    setEditingBlend(null);
    setShowCreateModal(true);
  };

  const blendDialogOpen = isBlendDialogOpen(showCreateModal, editingBlend);

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Blend
        </Button>
      </div>

      {/* Диалог создания/редактирования бленда */}
      {blendDialogOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            aria-hidden
            onClick={handleFormCancel}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-card border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingBlend ? 'Edit Blend' : 'Create Blend'}
            </h3>
            <BlendForm
              blend={editingBlend ?? undefined}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        </>
      )}

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading blends...</p>
      ) : (
        <div className="rounded-card border border-gray-200 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Recipe</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Available Stock</th>
                <th className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {blends.map((blend) => (
                <tr key={blend.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{blend.name}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatRecipe(blend.recipe)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
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
            <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No blends yet. Create one to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}
