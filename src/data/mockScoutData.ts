import { ScoutLocation, Tour } from '../types/scout';

export const INITIAL_SCOUT_LOCATIONS: ScoutLocation[] = [
  {
    id: 'loc-bai-xep',
    code: 'QN-LOC-001',
    name: 'Bãi Xép — Gành Bà',
    region: 'Quy Nhơn',
    coordinates: { lat: 13.6938, lng: 109.2312 },
    description: 'Bờ biển nguyên sơ với ghềnh đá đen, rạn san hô cạn và bãi cỏ xanh ngát nhìn ra biển Đông.',
    scouting_notes: 'Góc máy đẹp nhất hướng về bãi đá khi sóng vỗ bình minh. Phù hợp quay flycam lướt sát mặt nước và cảnh nhân vật độc thoại.',
    camera_angles: [
      'Flycam bay thấp dọc ghềnh đá (15m)',
      'Góc máy cận chân dung ngược sáng bình minh',
      'Toàn cảnh bãi cỏ trên vách nhìn xuống bãi cát'
    ],
    best_time_to_shoot: '05:00 - 06:45 (Bình Minh)',
    drone_permitted: true,
    drive_reference: {
      folder_id: '1aB2c3D4e5F6_bai_xep',
      folder_url: 'https://drive.google.com/drive/folders/1aB2c3D4e5F6_bai_xep',
      asset_count: 14,
      last_synced_at: '2026-10-01T15:00:00Z'
    },
    tags: ['Bờ Biển', 'Bình Minh', 'Flycam', 'Ghềnh Đá'],
    status: 'active',
    created_at: '2026-09-20T08:00:00Z',
    updated_at: '2026-10-01T15:00:00Z'
  },
  {
    id: 'loc-mui-rong',
    code: 'QN-LOC-002',
    name: 'Mũi Vi Rồng (Mũi Rồng)',
    region: 'Hoài Hải',
    coordinates: { lat: 14.3012, lng: 109.1124 },
    description: 'Mỏm đá hình miệng rồng nhô ra biển, sóng biển cuộn trào qua các hang hốc đá tự nhiên hùng vĩ.',
    scouting_notes: 'Âm thanh sóng vỗ cộng hưởng trong vách đá rất đặc trưng (tuyệt vời cho ASMR biển). Cần mang chân máy chống gió mạnh.',
    camera_angles: [
      'Góc rộng từ mõm đá nhìn bao quát vịnh Hoài Hải',
      'Slow motion 120fps cận bọt sóng đánh bung bờ đá',
      'Flycam quỹ đạo tròn quanh chỏm đá rồng'
    ],
    best_time_to_shoot: '15:30 - 17:30 (Hoàng Hôn)',
    drone_permitted: true,
    drive_reference: {
      folder_id: '2bC3d4E5f6G7_mui_rong',
      folder_url: 'https://drive.google.com/drive/folders/2bC3d4E5f6G7_mui_rong',
      asset_count: 22,
      last_synced_at: '2026-10-02T02:00:00Z'
    },
    tags: ['Hoài Hải', 'Sóng Biển', 'Hùng Vĩ', 'ASMR'],
    status: 'active',
    created_at: '2026-09-22T09:30:00Z',
    updated_at: '2026-10-02T02:00:00Z'
  },
  {
    id: 'loc-eo-gio',
    code: 'QN-LOC-003',
    name: 'Eo Gió — Nhơn Lý',
    region: 'Quy Nhơn',
    coordinates: { lat: 13.8962, lng: 109.2885 },
    description: 'Eo biển lộng gió được bao bọc bởi dãy núi đá uốn lượn ôm trọn bờ biển xanh biếc.',
    scouting_notes: 'Con đường đi bộ ven vách núi lên hình màu đất son nổi bật giữa nền biển xanh. Khung hình chiều cho ánh sáng vàng ấm.',
    camera_angles: [
      'Góc dài chạy theo cung đường đi bộ ven núi',
      'Góc nhìn từ đỉnh đồi nhìn thẳng ra rạn đá',
      'Medium shot góc nghiêng đón nắng xiên'
    ],
    best_time_to_shoot: '16:00 - 17:45 (Nắng Chiều)',
    drone_permitted: false,
    drive_reference: {
      folder_id: '3cD4e5F6g7H8_eo_gio',
      folder_url: 'https://drive.google.com/drive/folders/3cD4e5F6g7H8_eo_gio',
      asset_count: 31,
      last_synced_at: '2026-09-29T10:00:00Z'
    },
    tags: ['Cung Đường', 'Nắng Vàng', 'Quy Nhơn', 'Cảnh Biển'],
    status: 'active',
    created_at: '2026-09-21T11:00:00Z',
    updated_at: '2026-09-29T10:00:00Z'
  },
  {
    id: 'loc-cu-lao-xanh',
    code: 'QN-LOC-004',
    name: 'Hải Đăng Cù Lao Xanh',
    region: 'Quy Nhơn',
    coordinates: { lat: 13.6167, lng: 109.3500 },
    description: 'Ngọn hải đăng Pháp cổ hơn 100 năm tuổi trên đảo Cù Lao Xanh, bao quanh bởi rừng cây xanh và biển sâu.',
    scouting_notes: 'Cần cano ra đảo trước 1 ngày nếu muốn đón bình minh ngọn hải đăng. Cảnh bình minh trên tháp hải đăng là độc nhất vô nhị.',
    camera_angles: [
      'Góc máy ngước nhìn toàn bộ kiến trúc tháp đèn',
      'Pano 360 độ từ lan can hải đăng ra toàn cảnh đảo',
      'Flycam bay lùi ra biển từ bóng tháp'
    ],
    best_time_to_shoot: '04:45 - 06:15 (Rạng Đông)',
    drone_permitted: true,
    drive_reference: {
      folder_id: '4dE5f6G7h8I9_cu_lao_xanh',
      folder_url: 'https://drive.google.com/drive/folders/4dE5f6G7h8I9_cu_lao_xanh',
      asset_count: 18,
      last_synced_at: '2026-09-25T14:30:00Z'
    },
    tags: ['Đảo Xa', 'Hải Đăng', 'Bình Minh', 'Di Tích'],
    status: 'active',
    created_at: '2026-09-18T07:15:00Z',
    updated_at: '2026-09-25T14:30:00Z'
  },
  {
    id: 'loc-thap-banh-it',
    code: 'QN-LOC-005',
    name: 'Quần Thể Tháp Bánh Ít',
    region: 'Tuy Phước',
    coordinates: { lat: 13.9181, lng: 109.1364 },
    description: 'Cụm tháp Chăm pa cổ kính tọa lạc trên đỉnh đồi cao nhìn xuống vùng đồng bằng phù sa lúa nước xanh mướt.',
    scouting_notes: 'Hoa văn gạch Chăm cổ màu đất nung cổ kính. Phù hợp các cảnh quay văn hóa lịch sử, chiều sâu thời gian và nhạc trầm.',
    camera_angles: [
      'Góc máy cận các bức phù điêu vũ nữ Chăm',
      'Góc máy thấp đối xứng cổng tháp chính',
      'Góc máy toàn cảnh bậc thang đá dẫn lên đồi'
    ],
    best_time_to_shoot: '07:00 - 09:00 hoặc 15:30 - 17:00',
    drone_permitted: false,
    drive_reference: {
      folder_id: '5eF6g7H8i9J0_thap_banh_it',
      folder_url: 'https://drive.google.com/drive/folders/5eF6g7H8i9J0_thap_banh_it',
      asset_count: 27,
      last_synced_at: '2026-09-28T09:00:00Z'
    },
    tags: ['Văn Hóa', 'Tháp Chăm', 'Di Sản', 'Đồng Bằng'],
    status: 'active',
    created_at: '2026-09-15T10:00:00Z',
    updated_at: '2026-09-28T09:00:00Z'
  },
  {
    id: 'loc-dam-thi-nai',
    code: 'QN-LOC-006',
    name: 'Đầm Thị Nại & Rừng Ngập Mặn Cồn Chim',
    region: 'Tuy Phước',
    coordinates: { lat: 13.8167, lng: 109.2333 },
    description: 'Đầm nước lợ lớn nhất Bình Định, cảnh ghe thuyền len lỏi trong rừng ngập mặn khi hoàng hôn buông xuống.',
    scouting_notes: 'Nước đầm phẳng lặng tạo hiệu ứng gương phản chiếu rực rỡ lúc hoàng hôn. Cần thuyền nan nhỏ để tiếp cận cồn chim.',
    camera_angles: [
      'Góc máy ngang mặt nước phản chiếu bóng thuyền nan',
      'Flycam bay dọc luồng lạch rừng đước ngập mặn',
      'Timelapse hoàng hôn buông trên mặt đầm'
    ],
    best_time_to_shoot: '16:30 - 18:15 (Hoàng Hôn & Blue Hour)',
    drone_permitted: true,
    drive_reference: {
      folder_id: '6fG7h8I9j0K1_dam_thi_nai',
      folder_url: 'https://drive.google.com/drive/folders/6fG7h8I9j0K1_dam_thi_nai',
      asset_count: 19,
      last_synced_at: '2026-09-30T17:00:00Z'
    },
    tags: ['Đầm Phá', 'Rừng Ngập Mặn', 'Hoàng Hôn', 'Gương Nước'],
    status: 'active',
    created_at: '2026-09-24T06:00:00Z',
    updated_at: '2026-09-30T17:00:00Z'
  }
];

export const INITIAL_TOURS: Tour[] = [
  {
    id: 'tour-2026-w41-hoai-hai',
    code: 'QN-TOUR-2026-W41',
    title: 'Lộ Trình Khảo Sát Bình Minh Hoài Hải & Duyên Hải Bắc Bình Định',
    description: 'Lộ trình tiền trạm phục vụ đợt sản xuất Quài Nhơn Reel Tuần 41: đón bình minh Bãi Xép, di chuyển lên Mũi Vi Rồng Hoài Hải và kết thúc tại Eo Gió.',
    status: 'planning',
    production_week: '2026-W41',
    target_date: '2026-10-06',
    assigned_crew: ['Quyền (Đạo diễn / Giám sát)', 'Hiển (Biên kịch / Bối cảnh)', 'Quốc (Flycam/Camera)'],
    stops: [
      {
        id: 'stop-001',
        tour_id: 'tour-2026-w41-hoai-hai',
        location_id: 'loc-bai-xep',
        stop_order: 1,
        target_arrival_time: '05:00',
        planned_duration_minutes: 90,
        focus_scenes: 'Đón bình minh trên bãi cỏ Gành Bà và rạn đá đen Bãi Xép.',
        notes: 'Chuẩn bị filter ND cho flycam và chân máy cho máy A.',
        status: 'scheduled',
        approved_by_human: true
      },
      {
        id: 'stop-002',
        tour_id: 'tour-2026-w41-hoai-hai',
        location_id: 'loc-mui-rong',
        stop_order: 2,
        target_arrival_time: '14:30',
        planned_duration_minutes: 120,
        focus_scenes: 'Ghi âm ASMR tiếng sóng đập vách miệng rồng và flycam quỹ đạo.',
        notes: 'Gió biển mạnh, lưu ý pin flycam và an toàn đứng vách đá.',
        status: 'scheduled',
        approved_by_human: true
      },
      {
        id: 'stop-003',
        tour_id: 'tour-2026-w41-hoai-hai',
        location_id: 'loc-eo-gio',
        stop_order: 3,
        target_arrival_time: '16:45',
        planned_duration_minutes: 60,
        focus_scenes: 'Cung đường đi bộ uốn lượn ven núi đón nắng chiều son rực rỡ.',
        notes: 'Không được bay flycam ở Eo Gió; quay gimbal đi bộ mượt mà.',
        status: 'scheduled',
        approved_by_human: true
      }
    ],
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-02T09:00:00Z'
  },
  {
    id: 'tour-2026-w42-di-san',
    code: 'QN-TOUR-2026-W42',
    title: 'Lộ Trình Khảo Sát Di Sản Tháp Chăm & Đầm Nước Lợ Thị Nại',
    description: 'Chuyên đề văn hóa và thiên nhiên tĩnh: kết hợp ánh sáng sớm tại Tháp Bánh Ít và hoàng hôn gương nước Đầm Thị Nại.',
    status: 'draft',
    production_week: '2026-W42',
    target_date: '2026-10-13',
    assigned_crew: ['Quyền', 'Hiển'],
    stops: [
      {
        id: 'stop-004',
        tour_id: 'tour-2026-w42-di-san',
        location_id: 'loc-thap-banh-it',
        stop_order: 1,
        target_arrival_time: '07:30',
        planned_duration_minutes: 90,
        focus_scenes: 'Khảo sát góc nắng chiếu qua vòm tháp gạch nung.',
        status: 'scheduled',
        approved_by_human: true
      },
      {
        id: 'stop-005',
        tour_id: 'tour-2026-w42-di-san',
        location_id: 'loc-dam-thi-nai',
        stop_order: 2,
        target_arrival_time: '16:30',
        planned_duration_minutes: 90,
        focus_scenes: 'Hoàng hôn buông trên mặt đầm và cồn chim.',
        status: 'scheduled',
        approved_by_human: true
      }
    ],
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z'
  }
];
