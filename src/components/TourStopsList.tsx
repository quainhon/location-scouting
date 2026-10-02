import React from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { HydratedTourStop, Tour } from '../types/scout';

interface TourStopsListProps {
  tour: Tour;
  hydratedStops: HydratedTourStop[];
  selectedLocationId: string | null;
  onSelectLocation: (locationId: string) => void;
  onMoveStop: (stopId: string, direction: 'up' | 'down') => void;
  onRemoveStop: (stopId: string) => void;
  onOpenLibrary: () => void;
}

export const TourStopsList: React.FC<TourStopsListProps> = ({
  tour,
  hydratedStops,
  selectedLocationId,
  onSelectLocation,
  onMoveStop,
  onRemoveStop,
  onOpenLibrary,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded">
              Lộ Trình
            </span>
            <span className="text-xs text-slate-400">{tour.code}</span>
          </div>
          <h2 className="text-sm font-bold text-slate-100 mt-1 line-clamp-1">
            {tour.title}
          </h2>
        </div>
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
          title="Thêm điểm khảo sát từ thư viện"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm Điểm</span>
        </button>
      </div>

      {/* Meta Bar */}
      <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Tổng số điểm: <strong className="text-slate-200">{hydratedStops.length}</strong></span>
        <span>Tuần: <strong className="text-slate-200">{tour.production_week}</strong></span>
      </div>

      {/* Stops Sequence Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {hydratedStops.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MapPin className="w-8 h-8 mb-2 text-slate-600 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-400">Lộ trình chưa có điểm quay nào</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              Nhấn "+ Thêm Điểm" để chọn bối cảnh từ Thư Viện Khảo Sát Quài Nhơn.
            </p>
          </div>
        ) : (
          hydratedStops.map((stop, index) => {
            const isSelected = selectedLocationId === stop.location.id;
            const isFirst = index === 0;
            const isLast = index === hydratedStops.length - 1;

            return (
              <div
                key={stop.id}
                onClick={() => onSelectLocation(stop.location.id)}
                className={`group relative p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-950/40 border-sky-500/70 shadow-sm shadow-sky-950'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/90'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Left: Badge + Titles */}
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span
                      className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        isSelected
                          ? 'bg-sky-500 text-slate-950 ring-2 ring-sky-400/40'
                          : 'bg-slate-800 text-sky-400 border border-slate-700'
                      }`}
                    >
                      {stop.stop_order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-slate-100 truncate">
                          {stop.location.name}
                        </h3>
                        <span className="text-[10px] text-slate-400 px-1.5 py-0.2 bg-slate-800 rounded">
                          {stop.location.region}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {stop.focus_scenes || stop.location.scouting_notes}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                        {stop.target_arrival_time && (
                          <span className="flex items-center gap-1 text-sky-400/90">
                            <Clock className="w-3 h-3" />
                            {stop.target_arrival_time}
                          </span>
                        )}
                        <span>{stop.planned_duration_minutes} phút</span>
                        {stop.location.drone_permitted && (
                          <span className="text-emerald-400">Flycam OK</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Reorder & Remove */}
                  <div
                    className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onMoveStop(stop.id, 'up')}
                      disabled={isFirst}
                      title="Chuyển lên trước"
                      className={`p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onMoveStop(stop.id, 'down')}
                      disabled={isLast}
                      title="Chuyển xuống sau"
                      className={`p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemoveStop(stop.id)}
                      title="Xóa khỏi lộ trình (Không xóa bối cảnh)"
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Invariant Hint */}
      <div className="p-3 bg-slate-950/70 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span className="truncate">Thứ tự thuộc về Điểm Lộ Trình. Bối cảnh luôn được bảo toàn.</span>
      </div>
    </div>
  );
};
