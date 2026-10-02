import { useState } from 'react';
import { Compass, ShieldCheck, ChevronDown } from 'lucide-react';
import { ScoutLocation, Tour } from '../types/scout';
import { INITIAL_SCOUT_LOCATIONS, INITIAL_TOURS } from '../data/mockScoutData';
import {
  addStopToTour,
  removeStopFromTour,
  moveStop,
  archiveLocation,
  restoreLocation,
  hydrateTourStops,
} from '../utils/invariants';
import { TourStopsList } from './TourStopsList';
import { LocationCanvas } from './LocationCanvas';
import { LocationDetailPanel } from './LocationDetailPanel';
import { ScoutLibraryModal } from './ScoutLibraryModal';

export const ScoutWorkspace: React.FC = () => {
  const [locations, setLocations] = useState<ScoutLocation[]>(INITIAL_SCOUT_LOCATIONS);
  const [tours, setTours] = useState<Tour[]>(INITIAL_TOURS);
  const [activeTourId, setActiveTourId] = useState<string>(INITIAL_TOURS[0].id);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    INITIAL_SCOUT_LOCATIONS[0].id
  );
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const activeTour = tours.find((t) => t.id === activeTourId) || tours[0];
  const hydratedStops = hydrateTourStops(activeTour, locations);
  const selectedLocation = locations.find((l) => l.id === selectedLocationId) || null;

  // Handlers enforcing pure domain invariants
  const handleAddStop = (location: ScoutLocation) => {
    const updatedTour = addStopToTour(activeTour, location);
    setTours((prev) => prev.map((t) => (t.id === updatedTour.id ? updatedTour : t)));
    setSelectedLocationId(location.id);
  };

  const handleRemoveStop = (stopId: string) => {
    const updatedTour = removeStopFromTour(activeTour, stopId);
    setTours((prev) => prev.map((t) => (t.id === updatedTour.id ? updatedTour : t)));
  };

  const handleMoveStop = (stopId: string, direction: 'up' | 'down') => {
    const updatedTour = moveStop(activeTour, stopId, direction);
    setTours((prev) => prev.map((t) => (t.id === updatedTour.id ? updatedTour : t)));
  };

  const handleToggleArchive = (loc: ScoutLocation) => {
    const updated = loc.status === 'active' ? archiveLocation(loc) : restoreLocation(loc);
    setLocations((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  // Compute total planned duration
  const totalMinutes = hydratedStops.reduce((sum, s) => sum + s.planned_duration_minutes, 0);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <header className="h-14 px-5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-20">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 tracking-tight">
                Quài Nhơn Location Scout
              </h1>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 bg-sky-950 text-sky-400 border border-sky-800/80 rounded">
                NDP5 • Stage 1
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Khảo sát bối cảnh, quản lý điểm quay & lộ trình tiền trạm
            </p>
          </div>
        </div>

        {/* Tour Switcher & Header Controls */}
        <div className="flex items-center gap-3">
          {/* Tour Dropdown */}
          <div className="relative">
            <select
              value={activeTourId}
              onChange={(e) => setActiveTourId(e.target.value)}
              className="appearance-none bg-slate-800/90 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 pl-3 pr-8 py-1.5 rounded-lg focus:outline-none focus:border-sky-500 cursor-pointer transition-colors"
            >
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Metrics */}
          <div className="hidden md:flex items-center gap-2 text-xs bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
            <span>Thời lượng: <strong className="text-sky-300">{Math.floor(totalMinutes / 60)}h{totalMinutes % 60}m</strong></span>
            <span className="text-slate-700">•</span>
            <span>Trạng thái: <strong className="text-emerald-400 uppercase">{activeTour.status}</strong></span>
          </div>

          {/* Invariant Safety Badge */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Quyền & Hiển Invariant Active</span>
          </div>
        </div>
      </header>

      {/* Main 3-Area Workspace */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">
        {/* AREA 1 (LEFT ~30%): Compact Tour Stops List */}
        <section className="lg:col-span-4 xl:col-span-3 h-full overflow-hidden flex flex-col">
          <TourStopsList
            tour={activeTour}
            hydratedStops={hydratedStops}
            selectedLocationId={selectedLocationId}
            onSelectLocation={setSelectedLocationId}
            onMoveStop={handleMoveStop}
            onRemoveStop={handleRemoveStop}
            onOpenLibrary={() => setIsLibraryOpen(true)}
          />
        </section>

        {/* AREA 2 (CENTER ~45%): Central Map & Canvas */}
        <section className="lg:col-span-5 xl:col-span-6 h-full overflow-hidden flex flex-col">
          <LocationCanvas
            locations={locations}
            hydratedStops={hydratedStops}
            selectedLocationId={selectedLocationId}
            onSelectLocation={setSelectedLocationId}
          />
        </section>

        {/* AREA 3 (RIGHT ~25%): Selected Location Detail Panel */}
        <section className="lg:col-span-3 xl:col-span-3 h-full overflow-hidden flex flex-col">
          <LocationDetailPanel
            location={selectedLocation}
            activeTour={activeTour}
            onAddToTour={handleAddStop}
            onRemoveFromTour={handleRemoveStop}
            onToggleArchive={handleToggleArchive}
          />
        </section>
      </main>

      {/* Modal: Scout Library */}
      <ScoutLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        locations={locations}
        activeTour={activeTour}
        onSelectAndAdd={handleAddStop}
        onInspectLocation={setSelectedLocationId}
      />
    </div>
  );
};
