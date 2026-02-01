import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '@/api/inventory';
import { roastsApi } from '@/api/roasts';
import { scheduleApi } from '@/api/schedule';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Flame, Calendar, TrendingUp } from 'lucide-react';
import { formatWeight } from '@/utils/formatters';

export const DashboardPage = () => {
  const { data: coffeesData } = useQuery({
    queryKey: ['coffees', 'dashboard'],
    queryFn: () => inventoryApi.getCoffees(10, 0),
  });

  const { data: roastsData } = useQuery({
    queryKey: ['roasts', 'dashboard'],
    queryFn: () => roastsApi.getRoasts(10, 0),
  });

  const { data: scheduleData } = useQuery({
    queryKey: ['schedule', 'dashboard'],
    queryFn: () => scheduleApi.getSchedule(undefined, undefined, 10, 0),
  });

  const totalCoffees = coffeesData?.data.total || 0;
  const totalRoasts = roastsData?.data.total || 0;
  const pendingSchedules = scheduleData?.data.items.filter(s => s.status === 'pending').length || 0;
  const totalRoasted = roastsData?.data.items?.reduce((sum, r) => sum + (Number(r.roasted_weight_kg) || 0), 0) ?? 0;

  const stats = [
    {
      title: 'Total Coffees',
      value: totalCoffees,
      icon: Package,
      color: 'text-blue-600',
    },
    {
      title: 'Total Roasts',
      value: totalRoasts,
      icon: Flame,
      color: 'text-orange-600',
    },
    {
      title: 'Pending Schedules',
      value: pendingSchedules,
      icon: Calendar,
      color: 'text-purple-600',
    },
    {
      title: 'Total Roasted',
      value: formatWeight(totalRoasted),
      icon: TrendingUp,
      color: 'text-green-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Overview of your coffee operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Roasts</CardTitle>
          </CardHeader>
          <CardContent>
            {(roastsData?.data?.items?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {(roastsData!.data.items).slice(0, 5).map((roast) => {
                  const dateStr = roast.roasted_at ?? roast.roast_date;
                  const weightKg = Number(roast.roasted_weight_kg) || 0;
                  const lossPct = roast.weight_loss_percent;
                  return (
                  <div key={roast.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{roast.title ?? roast.operator ?? '—'}</p>
                      <p className="text-sm text-gray-500">
                        {dateStr ? new Date(dateStr).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatWeight(weightKg)}</p>
                      <p className="text-sm text-gray-500">
                        {lossPct != null ? `${lossPct.toFixed(1)}% loss` : '—'}
                      </p>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500">No roasts yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {scheduleData?.data.items.filter(s => s.status === 'pending').length ? (
              <div className="space-y-2">
                {scheduleData.data.items
                  .filter(s => s.status === 'pending')
                  .slice(0, 5)
                  .map((schedule) => (
                    <div key={schedule.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">Scheduled Roast</p>
                        <p className="text-sm text-gray-500">
                          {new Date(schedule.planned_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-button text-xs">
                          Pending
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500">No upcoming schedules</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
