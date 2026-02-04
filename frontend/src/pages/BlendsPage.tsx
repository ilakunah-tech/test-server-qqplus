import { BlendsList } from '@/components/Blends/BlendsList';

export const BlendsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Blends</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your coffee blends and recipes</p>
      </div>
      <BlendsList />
    </div>
  );
};
