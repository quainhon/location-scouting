# Quài Nhơn Location Scout

Giao diện ba cột theo ảnh tham chiếu, sử dụng dữ liệu do người dùng nhập. Không seed địa điểm, tour, ảnh hay số liệu mẫu.

## Chạy trên máy

Yêu cầu Node.js 24 trở lên (dùng `node:sqlite`).

```powershell
npm install
npm run dev
```

Mở http://127.0.0.1:5173. Lệnh này khởi động cả Vite và API SQLite.

Bản build:

```powershell
npm run build
npm start
```

Mở http://127.0.0.1:3001. Chỉ bind localhost; chưa phải dịch vụ nhiều người dùng trên Internet.

## Tính năng

- Tạo/chọn tour, tạo/sửa địa điểm; đổi thứ tự bằng nút lên/xuống.
- Thư viện độc lập, thêm địa điểm vào nhiều tour, Remove Pin chỉ bỏ liên kết.
- Archive/Restore bảo toàn thông tin và các tour đã liên kết.
- Trạng thái khảo sát, tọa độ, giờ phù hợp, đường vào, mô tả, highlights, ghi chú.
- Gallery từ URL ảnh thật do người dùng cung cấp; chuyển ảnh và báo khi URL không tải được.
- Folder mở thư mục Google Drive đã liên kết; không đọc file riêng tư hoặc giả số lượng ảnh.
- Notes, Checklist, History lưu trong SQLite. Thời lượng điểm dừng sửa trong Edit → Sửa thời lượng.
- Bản đồ Leaflet: Esri satellite / OpenStreetMap, zoom, fit toàn bộ lộ trình, chọn pin.
- Search tìm địa điểm trong thư viện đã lưu. Open in Maps mở tọa độ trên Google Maps.
- Nút tải xuống góc phải xuất snapshot JSON để đối chiếu.

## Database và hợp đồng tích hợp

**Schema chuẩn duy nhất: `database/schema.sql`.** Server thực thi chính file này khi khởi động. Các bảng: `scout_locations`, `tours`, `tour_stops`, `location_photos`, `location_checklist`, `location_history`, `workspace_meta`.

Database mặc định ở `data/scout.sqlite`, không được commit. Có thể đặt `SCOUT_DB` thành đường dẫn tuyệt đối khác, nên dùng ổ local nếu nhiều máy cùng đồng bộ Google Drive. Không mở cùng một file SQLite đồng thời trên nhiều máy qua thư mục đồng bộ. Dừng server trước khi sao lưu file SQLite cùng các sidecar còn tồn tại.

- `GET /api/workspace` → `{revision, locations, tours}`.
- `PUT /api/workspace` nhận cùng shape và lưu bằng transaction; trả snapshot đã lưu.
- `revision` chống ghi đè giữa các cửa sổ: HTTP 409 nếu stale; giao diện báo lỗi và cho tải lại.
- HTTP 400 cho dữ liệu sai; 413 khi payload vượt 5 MB. Xóa vĩnh viễn location/tour bị từ chối.
- `coordinates.lat/lng` ánh xạ thành `latitude/longitude`.
- `camera_angles`, `tags`, `drive_reference`, `assigned_crew` là JSON trong SQL.
- `photos`, `checklist`, `history` là các bảng con; `Tour.stops` đọc từ `tour_stops` theo `stop_order`.
- History là nhật ký thao tác ứng dụng, không phải audit log chống sửa đổi.

## Phạm vi hoạt động

Ảnh và bản đồ cần Internet. Bản đồ nét đứt thể hiện thứ tự điểm; chưa tính đường lái xe, quãng đường hay ETA. Google Drive hoạt động bằng liên kết thư mục, chưa tích hợp OAuth. Chưa có đăng nhập, chia sẻ đa người dùng hoặc đồng bộ QNCC; file schema dành cho bước tích hợp này.

## Kiểm thử

```powershell
npm test
npm run build
```

Vitest kiểm tra bất biến miền dữ liệu. Node test kiểm tra schema, persistence sau mở lại, archive/restore, conflict, validation và transaction rollback. Test dùng database riêng, không seed dữ liệu vào bản người dùng.

Nguồn bản đồ: [Leaflet](https://leafletjs.com/reference), [Esri imagery attribution](https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basemap-000012040), [OpenStreetMap](https://www.openstreetmap.org/copyright).
