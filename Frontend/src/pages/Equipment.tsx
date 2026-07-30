import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Link } from 'react-router-dom';

const EQUIPMENT_CATALOG = [
  { id: 'CAT-EX-1001', name: 'CAT 336 Large Excavator', category: 'Excavator', site: 'Mining Site S003', status: 'WORKING', hours: 452.4, fuel: 85.0, nextService: '2026-08-15' },
  { id: 'CAT-BD-1002', name: 'CAT D8 Heavy Bulldozer', category: 'Bulldozer', site: 'Quarry Site S001', status: 'WORKING', hours: 612.0, fuel: 68.5, nextService: '2026-08-10' },
  { id: 'CAT-DT-1003', name: 'CAT 777G Off-Highway Truck', category: 'Dump Truck', site: 'Mining Site S003', status: 'MAINTENANCE', hours: 890.2, fuel: 42.0, nextService: '2026-08-01' },
  { id: 'CAT-WL-1004', name: 'CAT 966M Wheel Loader', category: 'Wheel Loader', site: 'Const Site S002', status: 'AVAILABLE', hours: 320.5, fuel: 92.0, nextService: '2026-09-01' },
  { id: 'CAT-CR-1005', name: 'CAT Mobile Crane 50T', category: 'Crane', site: 'Port Facility P004', status: 'WORKING', hours: 154.0, fuel: 78.0, nextService: '2026-08-20' },
];

export default function EquipmentPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const filtered = EQUIPMENT_CATALOG.filter((eq) => {
    const matchesSearch = eq.id.toLowerCase().includes(search.toLowerCase()) || eq.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || eq.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ backgroundColor: '#fff8f0', color: '#1f1b10' }} className="min-h-screen flex overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        <Header title="Equipment Management" subtitle="Machine Inventory & Lifecycle Maintenance" searchQuery={search} onSearchChange={setSearch} />

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar">
          {/* Top Controls */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {['ALL', 'Excavator', 'Bulldozer', 'Dump Truck', 'Wheel Loader', 'Crane'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  style={{
                    backgroundColor: categoryFilter === c ? '#ffcd11' : '#f7eddb',
                    color: categoryFilter === c ? '#6f5800' : '#1f1b10',
                    borderColor: '#d1c5ab',
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-all cursor-pointer"
                >
                  {c}
                </button>
              ))}
            </div>

            <button style={{ backgroundColor: '#745b00', color: '#ffffff' }} className="px-4 py-2 rounded-lg font-bold text-xs uppercase cursor-pointer hover:opacity-90">
              + Add Machine Unit
            </button>
          </div>

          {/* Table Container */}
          <div style={{ backgroundColor: '#ffffff', borderColor: '#d1c5ab' }} className="border rounded-xl shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead style={{ backgroundColor: '#fdf3e1', color: '#4e4632', borderColor: '#d1c5ab' }} className="border-b uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-4">Unit ID</th>
                  <th className="p-4">Machine Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Site Location</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Runtime</th>
                  <th className="p-4">Fuel Level</th>
                  <th className="p-4">Next Service</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1c5ab]/40">
                {filtered.map((eq) => (
                  <tr key={eq.id} className="hover:bg-[#fdf3e1]/50 transition-colors">
                    <td className="p-4 font-bold text-[#745b00]">{eq.id}</td>
                    <td className="p-4 font-extrabold text-[#1f1b10]">{eq.name}</td>
                    <td className="p-4 font-medium">{eq.category}</td>
                    <td className="p-4 font-medium">{eq.site}</td>
                    <td className="p-4">
                      <span
                        style={{
                          backgroundColor: eq.status === 'WORKING' ? '#ffcd11' : eq.status === 'MAINTENANCE' ? '#ffdad6' : '#f7eddb',
                          color: eq.status === 'WORKING' ? '#6f5800' : eq.status === 'MAINTENANCE' ? '#ba1a1a' : '#006874',
                        }}
                        className="px-2.5 py-1 rounded text-[10px] font-bold uppercase"
                      >
                        {eq.status}
                      </span>
                    </td>
                    <td className="p-4 font-bold">{eq.hours} hrs</td>
                    <td className="p-4 font-bold">{eq.fuel}%</td>
                    <td className="p-4">{eq.nextService}</td>
                    <td className="p-4">
                      <Link to={`/equipment/${eq.id}`} style={{ color: '#745b00' }} className="font-bold uppercase no-underline hover:underline">
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
