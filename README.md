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

- Tạo/chọn/xóa tour (có xác nhận); xóa tour chỉ xóa lộ trình và thứ tự các điểm dừng, spot vẫn nằm trong thư viện.
- Bật/tắt đường tuyến; khi tắt, các số thứ tự trên pin vẫn được giữ.
- Thư viện độc lập, thêm địa điểm vào nhiều tour, Remove Pin chỉ bỏ liên kết.
- Archive/Restore bảo toàn thông tin và các tour đã liên kết. Xóa vĩnh viễn có xác nhận, gỡ spot khỏi các tour và xóa metadata liên quan.
- Trạng thái khảo sát, tọa độ, giờ phù hợp, đường vào, mô tả, highlights, ghi chú.
- Mobile: chụp ảnh bằng camera hoặc chọn nhiều ảnh, xem trước/bỏ ảnh rồi lưu cùng địa điểm. Có thể thêm ảnh vào địa điểm đã lưu. Gallery hỗ trợ ảnh tải lên và URL ảnh có sẵn.
- Folder mở thư mục Google Drive đã liên kết; không đọc file riêng tư hoặc giả số lượng ảnh.
- Notes, Checklist, History lưu trong SQLite. Thời lượng điểm dừng sửa trong Edit → Sửa thời lượng.
- Bản đồ Leaflet: Esri satellite / OpenStreetMap, zoom, fit toàn bộ lộ trình, chọn pin.
- Search tìm địa điểm trong thư viện đã lưu. Open in Maps mở tọa độ trên Google Maps.
- Nút tải xuống góc phải xuất snapshot JSON để đối chiếu.

## Database và hợp đồng tích hợp

**Schema chuẩn duy nhất: `database/schema.sql`.** Server thực thi chính file này khi khởi động. Các bảng: `scout_locations`, `tours`, `tour_stops`, `location_photos`, `location_checklist`, `location_history`, `workspace_meta`.

Server local mặc định dùng `data/scout.sqlite`, không được commit. Có thể đặt `SCOUT_DB` thành đường dẫn tuyệt đối khác; không mở cùng một file SQLite đồng thời trên nhiều máy qua thư mục đồng bộ. Khi chạy server local, phải sao lưu SQLite cùng ảnh/video trong file. Xem [Database location and backups](docs/BACKUPS.md) để phân biệt SQLite local với cấu hình Pages/D1 và cách thiết lập bản sao hằng ngày.

- `GET /api/workspace` → `{revision, locations, tours}`.
- `PUT /api/workspace` nhận cùng shape và lưu bằng transaction; trả snapshot đã lưu.
- `revision` chống ghi đè giữa các cửa sổ: HTTP 409 nếu stale; giao diện báo lỗi và cho tải lại.
- HTTP 400 cho dữ liệu sai; 413 khi payload vượt 5 MB. Xóa route qua giao diện xóa bản ghi tour và các điểm dừng của route trong cùng transaction; spot vẫn giữ nguyên.
- `coordinates.lat/lng` ánh xạ thành `latitude/longitude`.
- `camera_angles`, `tags`, `drive_reference`, `assigned_crew` là JSON trong SQL.
- `photos`, `checklist`, `history` là các bảng con; `Tour.stops` đọc từ `tour_stops` theo `stop_order`.
- History là nhật ký thao tác ứng dụng, không phải audit log chống sửa đổi.

## Phạm vi hoạt động

Tải ảnh lên, xem bản đồ và tính tuyến cần Internet; Quick Capture có thể lưu điểm cùng ảnh/video trên điện thoại trước rồi đồng bộ sau. Tuyến ô tô lấy từ OSRM/FOSSGIS theo đúng thứ tự điểm, có quãng đường và thời gian di chuyển ước tính (không tính thời gian dừng). Khi không có tuyến, giao diện báo lỗi; không thay bằng đường thẳng giả. Tọa độ các điểm chỉ được gửi đến dịch vụ routing khi route có ít nhất hai điểm và đường tuyến đang bật. Google Drive hoạt động bằng liên kết thư mục, chưa tích hợp OAuth. Chưa có đăng nhập, chia sẻ đa người dùng hoặc đồng bộ QNCC; file schema dành cho bước tích hợp này.

## Kiểm thử

```powershell
npm test
npm run build
```

Vitest kiểm tra bất biến miền dữ liệu. Node test kiểm tra schema, persistence sau mở lại, archive/restore, conflict, validation và transaction rollback. Test dùng database riêng, không seed dữ liệu vào bản người dùng.

Nguồn bản đồ: [Leaflet](https://leafletjs.com/reference), [Esri imagery attribution](https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basemap-000012040), [OpenStreetMap](https://www.openstreetmap.org/copyright).


## Mobile và tuyến đường

- Điện thoại mở thẳng bản đồ với **+ Scout**, **Đã scout** và **Thư viện**. Lưu nhanh không yêu cầu tên hoặc chọn tour. Xem [Mobile Scout UI](docs/MOBILE_SCOUT_UI.md) và [Photo Upload](docs/PHOTO_UPLOAD.md).
- Capture lưu bền trên thiết bị trước; hàng đợi gửi điểm cùng ảnh/video theo thứ tự khi có mạng và giữ nhãn **Chờ đồng bộ** đến khi API xác nhận.
- **Xem tất cả spots** cho chọn nhiều địa điểm đang hoạt động, đổi thứ tự, đặt tên rồi tạo một tour mới trong một lần lưu. Địa điểm và tour cũ được giữ nguyên.
- Giao diện mobile map-first có tab **Lộ trình** để chọn/xóa tour đã lưu, tạo tour từ nhiều spots, đổi thứ tự điểm dừng đã lưu, và mở map xem tuyến lái xe được tính lại theo thứ tự. Trên map có nút ẩn/hiện đường; số thứ tự pin vẫn hiển thị khi đường bị ẩn.
- Route view tạo link chỉ đường nhiều điểm đến Google Maps theo thứ tự đang hiển thị. Link báo giới hạn waypoint của Google trên trình duyệt điện thoại hoặc máy tính; không tự rút gọn hay sắp xếp lại điểm.
- Trong tour: map chiếm không gian chính, danh sách điểm có thể mở/thu gọn. Chọn pin zoom tới mức 17 và hiện thẻ nhỏ; **Chi tiết** mở panel ghi chú/ảnh/checklist hiện có.
- Kéo một ngón, zoom hai ngón hoặc nút +/−. **Thêm spot trên map** bật chế độ đặt pin; chạm bình thường không mở form. **Xem toàn bộ lộ trình** bao gồm cả geometry của đường đi đã tải.
- Bản đồ đường phố là mặc định. Satellite yêu cầu `blankTile=false`, dùng mức ảnh gốc tối đa 17 rồi phóng ảnh khi zoom gần hơn; tự chuyển về Map khi nhà cung cấp thiếu ảnh. Mức zoom giao diện tối đa 20.
- Routing: `https://routing.openstreetmap.de/routed-car/route/v1/driving/`, tối đa 100 điểm/lần, giữ thứ tự, không tự tối ưu lại. Cache bộ nhớ 10 phút/40 tuyến; debounce 1,1 giây, giới hạn nhịp request, timeout 15 giây. Kết quả cũ bị bỏ khi tour hoặc tọa độ thay đổi.
- Dịch vụ công cộng dành cho tải nhẹ, không có cam kết uptime. Nguồn và chính sách: [FOSSGIS](https://routing.openstreetmap.de/about.html), [OSRM API](https://project-osrm.org/docs/v5.24.0/api/), [Esri blankTile](https://developers.arcgis.com/rest/services-reference/enterprise/map-tile/).
- `wrangler.toml` cấu hình Cloudflare Pages với binding D1 `location_scout_db`; cấu hình này chưa xác nhận domain production đang dùng binding đó. Đối chiếu Cloudflare Pages, custom domain và D1 trước khi coi một nơi là dữ liệu thật. Repo có workflow sao lưu D1 hằng ngày tới R2 nhưng workflow chỉ chạy sau khi Actions và secrets lưu trữ được thiết lập.

PC cũng dùng dropdown lộ trình, nút Xem tất cả spots và chọn nhiều spots để tạo tour theo thứ tự. Web có các bộ lọc Hôm nay/Cần xem lại, upload ảnh trực tiếp vào spot, đánh giá nhanh, và chế độ Xem route toàn màn hình với thumbnail pin + đổi thứ tự trực tiếp trên bản đồ. Scout Library ở thanh bên vẫn cho xem chi tiết / thêm điểm vào tour hiện tại.

- Video spot: MP4/MOV tối đa 15 giây, 20 MB/clip, 4 clip/spot; xem và tải trực tiếp. Xem docs/VIDEO_UPLOAD.md.
