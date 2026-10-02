import React, { useState } from 'react';
import { X, Search, Plus, Check, MapPin, Video, Clock } from 'lucide-react';
import { ScoutLocation, Tour } from '../types/scout';

interface ScoutLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: ScoutLocation[];
  activeTour: Tour;
  onSelectAndAdd: (location: ScoutLocation) => void;
  onInspectLocation: (locationId: string) => void;
}

export const ScoutLibraryModal: React.FC<ScoutLibraryModalProps> = ({
  isOpen,
  onClose,
  locations,
  activeTour,
  onSelectAndAdd,
  onInspectLocation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  if (!isOpen) return null;

  const regions = ['all', ...Array.from(new Set(locations.map((l) => l.region)))];

  const tourLocationIds = new Set(activeTour.stops.map((s) => s.location_id));

  const filteredLocations = locations.filter((loc) => {
    if (loc.status === 'archived') return false;

    const matchesSearch =
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRegion = selectedRegion === 'all' || loc.region === selectedRegion;

    return matchesSearch && matchesRegion;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Thư Viện Điểm Khảo Sát Quài Nhơn</span>
              <span className="text-xs font-normal text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                {locations.filter((l) => l.status === 'active').length} điểm lưu trữ
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Chọn bối cảnh thực địa để bổ sung vào lộ trình <span className="text-slate-200 font-semibold">{activeTour.title}</span>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, khu vực, thẻ..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Region Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {regions.map((reg) => (
              <button
                key={reg}
                onClick={() => setSelectedRegion(reg)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedRegion === reg
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {reg === 'all' ? 'Tất Cả Khu Vực' : reg}
              </button>
            ))}
          </div>
        </div>

        {/* Locations List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredLocations.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Không tìm thấy bối cảnh phù hợp với tiêu chí tìm kiếm.
            </div>
          ) : (
            filteredLocations.map((loc) => {
              const inTour = tourLocationIds.has(loc.id);
              const stopIndex = inTour
                ? activeTour.stops.find((s) => s.location_id === loc.id)?.stop_order
                : undefined;

              return (
                <div
                  key={loc.id}
                  className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.2 rounded">
                        {loc.code}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100 truncate">
                        {loc.name}
                      </h4>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {loc.region}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1 mt-1">
                      {loc.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {loc.best_time_to_shoot}
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3 text-sky-400" />
                        <span className={loc.drone_permitted ? 'text-emerald-400' : 'text-slate-400'}>
                          {loc.drone_permitted ? 'Flycam OK' : 'Không bay flycam'}
                        </span>
                      </span>
                      <span>{loc.drive_reference.asset_count} tệp Drive</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <button
                      onClick={() => {
                        onInspectLocation(loc.id);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Chi Tiết
                    </button>
                    {inTour ? (
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-sky-950/80 text-sky-400 border border-sky-800/80 rounded-lg text-xs font-medium">
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã có (Điểm #{stopIndex})</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelectAndAdd(loc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Chọn Vào Tour</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Thư viện bối cảnh độc lập — Thêm vào tour chỉ tạo tham chiếu điểm dừng.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
