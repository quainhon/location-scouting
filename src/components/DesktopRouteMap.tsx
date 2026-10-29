import { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Route, X } from 'lucide-react';
import type { HydratedTourStop, Tour } from '../types/scout';
import { moveStop } from '../utils/invariants';
import { googleMapsDirectionsUrl } from '../utils/routing';
import { ScoutMap } from './ScoutMap';

type Props = {
  tour: Tour;
  stops: HydratedTourStop[];
  busy: boolean;
  onClose: () => void;
  onUpdateTour: (tour: Tour, locationId?: string, action?: string) => Promise<boolean | void>;
};

export function DesktopRouteMap({ tour, stops, busy, onClose, onUpdateTour }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [reorderOpen, setReorderOpen] = useState(false);
  const selectedStop = stops.find(stop => stop.location_id === selectedId);
  const selectedIndex = selectedStop ? stops.findIndex(stop => stop.id === selectedStop.id) : -1;
  const routeMaps = (() => {
    try { return { url: googleMapsDirectionsUrl(stops.map(stop => stop.location.coordinates), false), error: '' }; }
    catch (e) { return { url: '', error: (e as Error).message }; }
  })();

  return <section className="desktop-route-map-fullscreen" aria-label={`Lộ trình ${tour.title}`}>
    <ScoutMap
      locations={stops.map(stop => stop.location)}
      stops={stops}
      selectedId={selectedId}
      onSelect={id => { setSelectedId(id); setReorderOpen(false); }}
      onCreateDraft={() => {}}
      draftPoint={null}
      fitSignal={1}
      showThumbnails
      focusSelected={false}
    />
    <button className="desktop-route-map-close" aria-label="Thoát xem route" onClick={onClose}><X size={24} /></button>
    <div className="desktop-route-map-title"><Route size={16} /><span>{tour.title}</span><b>{stops.length} điểm</b>{routeMaps.url ? <a href={routeMaps.url} target="_blank" rel="noreferrer"><ExternalLink size={15} />Mở tuyến trong Google Maps</a> : <small role="status">{routeMaps.error}</small>}</div>
    {selectedStop && <div className={`desktop-route-reorder ${reorderOpen ? 'open' : ''}`}>
      {reorderOpen && <div className="desktop-route-reorder-actions">
        <button
          aria-label={`Đưa ${selectedStop.location.name} lên trước`}
          disabled={busy || selectedIndex <= 0}
          onClick={() => void onUpdateTour(moveStop(tour, selectedStop.id, 'up'), selectedStop.location_id, 'Đổi thứ tự trên bản đồ route')}
        ><ArrowUp size={18} /><span>Lên</span></button>
        <button
          aria-label={`Đưa ${selectedStop.location.name} xuống sau`}
          disabled={busy || selectedIndex < 0 || selectedIndex >= stops.length - 1}
          onClick={() => void onUpdateTour(moveStop(tour, selectedStop.id, 'down'), selectedStop.location_id, 'Đổi thứ tự trên bản đồ route')}
        ><ArrowDown size={18} /><span>Xuống</span></button>
      </div>}
      <button className="desktop-route-reorder-toggle" aria-expanded={reorderOpen} onClick={() => setReorderOpen(open => !open)} disabled={busy}>
        <Route size={17} /><span>Đổi vị trí</span><b>{selectedStop.stop_order}</b>
      </button>
    </div>}
  </section>;
}
