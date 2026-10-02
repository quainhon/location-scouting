import React from 'react';
import {
  MapPin,
  Clock,
  Compass,
  Camera,
  FolderGit2,
  ExternalLink,
  Plus,
  Trash2,
  Archive,
  RefreshCw,
  Check,
  Video,
  AlertCircle
} from 'lucide-react';
import { ScoutLocation, Tour } from '../types/scout';

interface LocationDetailPanelProps {
  location: ScoutLocation | null;
  activeTour: Tour;
  onAddToTour: (location: ScoutLocation) => void;
  onRemoveFromTour: (stopId: string) => void;
  onToggleArchive: (location: ScoutLocation) => void;
}

export const LocationDetailPanel: React.FC<LocationDetailPanelProps> = ({
  location,
  activeTour,
  onAddToTour,
  onRemoveFromTour,
  onToggleArchive,
}) => {
  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-center shadow-lg text-slate-500">
        <Compass className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
        <h3 className="text-sm font-semibold text-slate-300">Chưa Chọn Bối Cảnh</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
          Chọn một điểm trên danh sách lộ trình hoặc trên bản đồ để xem chi tiết tiền trạm và tài nguyên Drive.
        </p>
      </div>
    );
  }

  // Find if location is in active tour
  const tourStop = activeTour.stops.find((s) => s.location_id === location.id);
  const isInActiveTour = !!tourStop;

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded">
            {location.code}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                location.status === 'active'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
              }`}
            >
              {location.status === 'active' ? 'Đang Hoạt Động' : 'Lưu Trữ'}
            </span>
            <button
              onClick={() => onToggleArchive(location)}
              title={location.status === 'active' ? 'Lưu trữ bối cảnh này' : 'Khôi phục bối cảnh'}
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            >
              {location.status === 'active' ? (
                <Archive className="w-3.5 h-3.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <h2 className="text-base font-bold text-slate-100 mt-2">
          {location.name}
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
          <MapPin className="w-3.5 h-3.5 text-slate-500" />
          <span>{location.region}, Bình Định</span>
          <span className="text-slate-600">•</span>
          <span className="font-mono text-[11px] text-slate-500">
            {location.coordinates.lat.toFixed(4)}, {location.coordinates.lng.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Tour Affiliation Card */}
        <div
          className={`p-3 rounded-lg border transition-colors ${
            isInActiveTour
              ? 'bg-sky-950/30 border-sky-800/60 text-sky-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isInActiveTour ? (
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-slate-950 font-bold text-xs">
                  {tourStop?.stop_order}
                </div>
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-600" />
              )}
              <span className="text-xs font-semibold">
                {isInActiveTour
                  ? `Đang thuộc Lộ Trình: Điểm #${tourStop?.stop_order}`
                  : 'Chưa đưa vào Lộ Trình hiện tại'}
              </span>
            </div>
            {isInActiveTour ? (
              <button
                onClick={() => tourStop && onRemoveFromTour(tourStop.id)}
                className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-1 rounded transition-colors"
                title="Bỏ khỏi lộ trình (bối cảnh vẫn an toàn trong thư viện)"
              >
                <Trash2 className="w-3 h-3" />
                <span>Bỏ khỏi Tour</span>
              </button>
            ) : (
              <button
                onClick={() => onAddToTour(location)}
                className="flex items-center gap-1 text-[11px] text-white bg-sky-600 hover:bg-sky-500 px-2.5 py-1 rounded font-medium transition-colors shadow-sm"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm vào Tour</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Parameters */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-slate-950/50 rounded-lg border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px]">Giờ Quay Lý Tưởng</span>
            </div>
            <p className="font-medium text-slate-200 text-xs">{location.best_time_to_shoot}</p>
          </div>
          <div className="p-2.5 bg-slate-950/50 rounded-lg border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Video className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px]">Flycam Quy Hoạch</span>
            </div>
            <p
              className={`font-semibold text-xs ${
                location.drone_permitted ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {location.drone_permitted ? 'Cho phép cất cánh' : 'Hạn chế cất cánh'}
            </p>
          </div>
        </div>

        {/* Description & Notes */}
        <div>
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Mô Tả Tiền Trạm
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
            {location.description}
          </p>
        </div>

        {/* Scouting Field Notes */}
        <div>
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span>Ghi Chú Đạo Diễn & Góc Máy</span>
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
            {location.scouting_notes}
          </p>
        </div>

        {/* Camera Angles List */}
        <div>
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Góc Máy Khuyến Nghị ({location.camera_angles.length})
          </h4>
          <ul className="space-y-1.5">
            {location.camera_angles.map((angle, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/30 p-2 rounded border border-slate-800/60"
              >
                <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                <span>{angle}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Google Drive Reference Card */}
        <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <FolderGit2 className="w-4 h-4 text-emerald-400" />
              <span>Tài Nguyên Google Drive</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
              {location.drive_reference.asset_count} tệp tin
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate font-mono">
            {location.drive_reference.folder_id || 'Chưa liên kết folder ID'}
          </p>
          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-500">
              Bảo tồn tham chiếu Drive, không tải trùng lặp
            </span>
            <a
              href={location.drive_reference.folder_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
            >
              <span>Mở Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Tags */}
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Thẻ Phân Loại
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {location.tags.map((t, idx) => (
              <span
                key={idx}
                className="text-[11px] text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Safety Notice Footer */}
      <div className="p-3 bg-slate-950/70 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
        <span className="truncate">Thao tác an toàn: Không xóa cứng dữ liệu khảo sát.</span>
      </div>
    </div>
  );
};
