
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Creator, CreatorStatus, PaymentStatus, ContentItem, ShipmentStatus, ContentStatus } from '../types';
import { Users, DollarSign, Flame, Truck, Package, Archive, Layers, PauseCircle } from 'lucide-react';

interface StatsOverviewProps {
  creators: Creator[];
  content: ContentItem[];
  onPendingClick: () => void;
  onUnusedClick: () => void;
  onInTransitClick: () => void;
  onNoPostClick: () => void;
  onInactiveClick: () => void;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({
  creators, content, onPendingClick, onUnusedClick, onInTransitClick, onNoPostClick, onInactiveClick
}) => {
  const total = creators.length;
  const active = creators.filter(c => c.status === CreatorStatus.Active || c.status === CreatorStatus.LongTerm).length;
  const blackburned = creators.filter(c => c.status === CreatorStatus.Blackburn).length;
  const inactive = creators.filter(c => c.status === CreatorStatus.Inactive).length;

  // Payment Stats
  const unpaidCount = creators.filter(c => c.paymentStatus === PaymentStatus.Unpaid).length;
  const pendingPayout = creators
    .filter(c => c.paymentStatus === PaymentStatus.Unpaid && c.status !== CreatorStatus.Blackburn)
    .reduce((sum, c) => sum + (c.rate || 0), 0);

  // Content Stats
  const unusedContentCount = content.filter(c => !c.scheduledDate && c.status !== ContentStatus.Posted).length;

  // Logistics Stats
  const inTransitCount = creators.filter(c => c.shipmentStatus === ShipmentStatus.Shipped).length;
  const deliveredButNoPost = creators.filter(c => {
    // Creator has received package
    if (c.shipmentStatus !== ShipmentStatus.Delivered) return false;
    // Creator is Active
    if (c.status === CreatorStatus.Blackburn || c.status === CreatorStatus.Inactive) return false;
    // Check if shipped 7+ days ago (using most recent shipment or legacy field)
    const latestShipment = c.shipments?.sort((a, b) => new Date(b.dateShipped).getTime() - new Date(a.dateShipped).getTime())[0];
    const shipDate = latestShipment?.dateShipped || c.dateAdded;
    if (shipDate) {
      const daysSinceShip = (Date.now() - new Date(shipDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceShip < 7) return false;
    }
    // Check if they have ANY content marked as Ready or Posted
    const hasContent = content.some(item =>
      item.creatorId === c.id &&
      (item.status === ContentStatus.Posted || item.status === ContentStatus.Ready)
    );
    return !hasContent; // True if they received item but have no ready content
  }).length;

  const data = [
    { name: 'Active', value: active },
    { name: 'Inactive', value: inactive },
    { name: 'Blackburned', value: blackburned },
  ];

  const StatCard = ({ title, value, sub, icon: Icon, color, onClick }: any) => (
    <div
      onClick={onClick}
      className={`bg-ooedn-gray border border-neutral-800 p-5 rounded-xl flex items-center justify-between transition-all 
        ${onClick ? 'cursor-pointer hover:border-neutral-600 hover:bg-neutral-800 hover:shadow-lg' : ''}`}
    >
      <div>
        <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
        <h2 className="text-2xl font-bold text-white">{value}</h2>
        {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 mb-8">
      {/* Row 1: General & Financial */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Creators"
          value={total}
          sub={`${active} Active Tracking`}
          icon={Users}
          color="text-white bg-white"
        />
        <StatCard
          title="Pending Payments"
          value={`$${pendingPayout.toLocaleString()}`}
          sub={`${unpaidCount} creators unpaid`}
          icon={DollarSign}
          color="text-emerald-500 bg-emerald-500"
          onClick={onPendingClick}
        />

        {/* Mini Chart */}
        <div className="bg-ooedn-gray border border-neutral-800 p-2 rounded-xl flex items-center justify-center relative min-h-[100px]">
          <div className="absolute top-2 left-3 text-[10px] text-neutral-500 font-bold uppercase">Distro</div>
          <ResponsiveContainer width="100%" height={100}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={35}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#a3a3a3' : '#ef4444'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <StatCard
          title="Unused Content"
          value={unusedContentCount}
          sub="Available Pool"
          icon={Layers}
          color="text-purple-500 bg-purple-500"
          onClick={onUnusedClick}
        />
      </div>

      {/* Row 2: Logistics / Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="In Transit"
          value={inTransitCount}
          sub="Units on the way"
          icon={Truck}
          color="text-blue-400 bg-blue-400"
          onClick={onInTransitClick}
        />
        <StatCard
          title="Overdue Content"
          value={deliveredButNoPost}
          sub="Received 7+ days, no post"
          icon={Package}
          color="text-orange-400 bg-orange-400"
          onClick={onNoPostClick}
        />
        <StatCard
          title="Inactive / Bench"
          value={inactive}
          sub="Paused Creators"
          icon={Archive}
          color="text-neutral-400 bg-neutral-400"
          onClick={onInactiveClick}
        />
        <StatCard
          title="Blackburn"
          value={blackburned}
          sub="Do Not Hire"
          icon={Flame}
          color="text-red-500 bg-red-500"
        />
      </div>
    </div>
  );
};

export default StatsOverview;
