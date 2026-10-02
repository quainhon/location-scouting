# Quài Nhơn Location Scout — Khảo Sát Bối Cảnh & Lộ Trình Quay (Stage 1)

Ứng dụng desktop-first chuyên biệt cho công tác khảo sát thực địa, quản lý điểm quay và lập kế hoạch lộ trình quay phim (Tour Route Planning) của Hệ sinh thái Quài Nhơn.

- **Authoritative NDP**: `NDP5` (Location Scout)
- **Repo**: `quainhon/location-scouting`
- **Stage**: Stage 1 (Authoritative Foundation & Domain Invariants)

---

## 🌟 Tính Năng Cốt Lõi (Stage 1)

1. **Mô Hình Dữ Liệu 3 Tầng Bảo Toàn Bất Biến**:
   - `ScoutLocation` (Bối cảnh khảo sát độc lập, tái sử dụng trên nhiều lộ trình).
   - `Tour` (Lộ trình quay theo tuần sản xuất, e.g. `2026-W41`).
   - `TourStop` (Điểm dừng trong lộ trình, sở hữu thứ tự `stop_order`).
2. **Không Gian Làm Việc 3 Khu Vực (3-Area Workspace)**:
   - **Khu vực 1 (Trái)**: Danh sách điểm dừng (Tour Stops) nhỏ gọn, hỗ trợ đổi thứ tự (Lên/Xuống), xóa an toàn khỏi tour.
   - **Khu vực 2 (Giữa)**: Bản đồ vector tương tác mô phỏng địa lý bờ biển Quy Nhơn / Bình Định, vẽ đường polyline kết nối các điểm theo thứ tự.
   - **Khu vực 3 (Phải)**: Bảng chi tiết bối cảnh (tọa độ, giờ chụp đẹp nhất, giấy phép flycam, ghi chú góc máy, liên kết thư mục Google Drive).
3. **Thư Viện Bối Cảnh (Scout Library Modal)**:
   - Tra cứu, lọc theo khu vực (Quy Nhơn, Hoài Hải, Tuy Phước...), chọn nhanh bối cảnh vào lộ trình mà không phá vỡ dữ liệu gốc.
4. **Bảo Toàn Bất Biến Quyền & Hiển**:
   - Xóa điểm dừng khỏi lộ trình **không bao giờ** làm mất hoặc thay đổi bối cảnh gốc trong thư viện.
   - Không xóa cứng dữ liệu (`soft-archive` bảo lưu lịch sử).
   - Tham chiếu tài nguyên Drive theo ID, không sao chép lãng phí.

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Thử

```bash
# Cài đặt dependencies
npm install

# Khởi chạy dev server (cổng 5173)
npm run dev

# Chạy bộ kiểm thử bất biến miền dữ liệu
npm test

# Kiểm tra kiểu dữ liệu TypeScript
npm run typecheck

# Build gói sản phẩm
npm run build
```

---

## 🏛️ Tài Liệu Kiến Trúc
Xem chi tiết tại [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
