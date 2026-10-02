import React, { useState } from 'react';
import { Compass, ZoomIn, ZoomOut, Layers, Eye } from 'lucide-react';
import { ScoutLocation, HydratedTourStop } from '../types/scout';

interface LocationCanvasProps {
  locations: ScoutLocation[];
  hydratedStops: HydratedTourStop[];
  selectedLocationId: string | null;
  onSelectLocation: (locationId: string) => void;
}

// Bounding box for Quy Nhơn / Bình Định coastal region
const MIN_LAT = 13.55;
const MAX_LAT = 14.35;
const MIN_LNG = 109.05;
const MAX_LNG = 109.40;

function projectToCanvas(lat: number, lng: number, width = 800, height = 600) {
  // Normalize lng (X axis: left to right)
  const xNorm = (lng - MIN_LNG) / (MAX_LNG - MIN_LNG);
  // Normalize lat (Y axis: top to bottom, note lat increases upwards so invert)
  const yNorm = (MAX_LAT - lat) / (MAX_LAT - MIN_LAT);

  // Add padding
  const padding = 60;
  const x = padding + xNorm * (width - padding * 2);
  const y = padding + yNorm * (height - padding * 2);

  return { x, y };
}

export const LocationCanvas: React.FC<LocationCanvasProps> = ({
  locations,
  hydratedStops,
  selectedLocationId,
  onSelectLocation,
}) => {
  const [zoom, setZoom] = useState(1);
  const [showAllLocations, setShowAllLocations] = useState(true);

  // Map stop location_id to stop_order
  const stopOrderMap = new Map<string, number>();
  hydratedStops.forEach((stop) => {
    stopOrderMap.set(stop.location.id, stop.stop_order);
  });

  // Calculate polyline points in stop_order sequence
  const polylinePoints = hydratedStops.map((stop) => {
    const pt = projectToCanvas(stop.location.coordinates.lat, stop.location.coordinates.lng);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  return (
    <div className="relative flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Top Map Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 shadow-lg pointer-events-auto">
          <Compass className="w-4 h-4 text-sky-400 animate-spin-slow" />
          <span className="text-xs font-bold text-slate-200">Không Gian Bản Đồ Quy Nhơn</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
            13.5°N - 14.3°N
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 shadow-lg pointer-events-auto">
          <button
            onClick={() => setShowAllLocations(!showAllLocations)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              showAllLocations
                ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Bật/Tắt hiển thị toàn bộ bối cảnh thư viện"
          >
            <Eye className="w-3 h-3" />
            <span className="text-[11px]">Bối Cảnh Khác</span>
          </button>
          <div className="h-4 w-[1px] bg-slate-800 mx-0.5" />
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.15, 1.6))}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Thu phóng gần"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.7))}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Thu phóng xa"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Khôi phục góc nhìn"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center p-4">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Sea coastline illustrative backdrop */}
        <svg
          viewBox="0 0 800 600"
          className="w-full h-full transition-transform duration-300 select-none"
          style={{ transform: `scale(${zoom})` }}
        >
          <defs>
            {/* Gradient for route sequence line */}
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.7" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Stylized Coastline of Bình Định */}
          <path
            d="M 280 20 Q 320 120 340 220 T 370 340 Q 390 420 370 480 T 360 580"
            fill="none"
            stroke="#1e293b"
            strokeWidth="38"
            strokeLinecap="round"
          />
          <path
            d="M 280 20 Q 320 120 340 220 T 370 340 Q 390 420 370 480 T 360 580"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2"
            strokeDasharray="6 6"
            strokeOpacity="0.4"
          />

          {/* Coast label */}
          <text x="320" y="560" fill="#475569" fontSize="12" fontWeight="600" letterSpacing="2">
            BIỂN ĐÔNG (DUYÊN HẢI BÌNH ĐỊNH)
          </text>
          <text x="140" y="320" fill="#334155" fontSize="14" fontWeight="bold" letterSpacing="4">
            ĐẤT LIỀN QUY NHƠN
          </text>

          {/* Route Sequence Polyline */}
          {hydratedStops.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="3.5"
              strokeDasharray="8 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
              className="animate-pulse"
            />
          )}

          {/* Locations Markers */}
          {locations.map((loc) => {
            if (loc.status === 'archived') return null;

            const isStop = stopOrderMap.has(loc.id);
            const stopOrder = stopOrderMap.get(loc.id);

            // Filter out unassigned locations if toggled off
            if (!isStop && !showAllLocations) return null;

            const { x, y } = projectToCanvas(loc.coordinates.lat, loc.coordinates.lng);
            const isSelected = selectedLocationId === loc.id;

            return (
              <g
                key={loc.id}
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectLocation(loc.id)}
                className="cursor-pointer group"
              >
                {/* Selection pulse ring */}
                {isSelected && (
                  <circle
                    r="22"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeOpacity="0.8"
                    className="animate-ping"
                  />
                )}

                {isStop ? (
                  /* Tour Stop Marker with Stop Order */
                  <>
                    <circle
                      r="16"
                      fill={isSelected ? '#0284c7' : '#0f172a'}
                      stroke={isSelected ? '#38bdf8' : '#38bdf8'}
                      strokeWidth={isSelected ? '3' : '2'}
                      filter={isSelected ? 'url(#glow)' : undefined}
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {stopOrder}
                    </text>
                  </>
                ) : (
                  /* Library / Unassigned Location Marker */
                  <>
                    <circle
                      r="9"
                      fill={isSelected ? '#0284c7' : '#1e293b'}
                      stroke={isSelected ? '#38bdf8' : '#64748b'}
                      strokeWidth="2"
                    />
                    <circle r="3" fill={isSelected ? '#ffffff' : '#94a3b8'} />
                  </>
                )}

                {/* Marker Name Label */}
                <g transform="translate(0, 24)">
                  <rect
                    x={-(loc.name.length * 3.4 + 10)}
                    y="-10"
                    width={loc.name.length * 6.8 + 20}
                    height="18"
                    rx="4"
                    fill="#090d16"
                    fillOpacity="0.85"
                    stroke={isSelected ? '#38bdf8' : '#334155'}
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    dy="3"
                    fill={isSelected ? '#38bdf8' : '#cbd5e1'}
                    fontSize="10"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                  >
                    {loc.name}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Map Status Bar */}
      <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Lớp Bản Đồ Vector Thử Nghiệm</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
            Điểm Lộ Trình ({hydratedStops.length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-500 inline-block" />
            Thư Viện Khảo Sát ({locations.filter((l) => l.status === 'active').length})
          </span>
        </div>
      </div>
    </div>
  );
};
