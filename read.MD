# Tài liệu Dự án: ShipManage Pro V2.0 (Hệ thống Quản lý Vận tải biển)

Tài liệu này cung cấp cái nhìn tổng quan về cấu trúc thư mục, mô hình cơ sở dữ liệu, các quy tắc tính toán tài chính - vận hành của phần mềm **ShipManage Pro V2.0**. Đây là nguồn dữ liệu chuẩn để AI tham chiếu cho các công việc nâng cấp tiếp theo.

---

## 1. Cấu trúc Thư mục Dự án

```
ShipManageV3/
├── app/                      # Thư mục chứa mã nguồn chạy web
│   ├── css/
│   │   └── style.css         # CSS chính (Đã tối ưu Responsive & Giao diện Login)
│   ├── js/
│   │   ├── app.js            # Xử lý luồng nghiệp vụ & Điều phối Views
│   │   ├── data.js           # Khởi tạo dữ liệu gốc & Các hàm Getter/Setter (State)
│   │   ├── firebase.js       # Đồng bộ Realtime Database & Quản lý Đăng nhập Auth
│   │   └── views.js          # Chứa mã nguồn giao diện HTML dạng template hàm
│   └── index.html            # Trang chính (Đã nạp Firebase SDK & UI Login)
├── .firebaserc               # Cấu hình dự án Firebase mặc định (shipmanagev33333)
├── firebase.json             # Cấu hình phân phối Firebase Hosting
├── .gitignore                # Chỉ định loại trừ các file dữ liệu Excel nhạy cảm
└── read.MD                   # Tài liệu mô tả dự án này
```

---

## 2. Mô hình Dữ liệu (State Database Schema)

Cơ sở dữ liệu của hệ thống lưu trữ tập trung dưới dạng tệp tin JSON (`state`) gồm các bảng thông tin chính như sau:

### 2.1. Đội tàu (`vessels`)
- `id`: Mã tàu (Ví dụ: `VG05`, `VG09`, `VG15`, `VG18`, `VG36`).
- `name`: Tên tàu (Ví dụ: Vũ Gia 05, Vũ Gia 09...).
- `capacity`: Trọng tải (tính bằng Tấn).
- `captain`: Thuyền trưởng hiện tại.
- `fuelRate`: Định mức tiêu hao nhiên liệu DO mặc định (Lít/giờ).

### 2.2. Chuyến hàng (`shipments`)
- `id`: Mã chuyến hàng tự sinh.
- `vesselId`: Mã tàu thực hiện chuyến.
- `contractNo`: Số hợp đồng vận chuyển.
- `voyageNo`: Số chuyến của tàu (Ví dụ: `C1`, `C2`...).
- `customer`: Tên khách hàng thuê tàu.
- `cargo`: Tên mặt hàng vận chuyển (quặng, Clinker, xỉ...).
- `qty`: Khối lượng hàng (Tấn).
- `rate`: Đơn giá cước thực tế (VND/tấn).
- `markup`: Tiền gửi lại cho khách (nếu có, VND/tấn).
- `revenueReal`: Doanh thu thực tế cước vận chuyển.
- `revenueInvoice`: Doanh thu hóa đơn (để tính thuế VAT).
- `refundAmount`: Tổng tiền gửi trả lại cho khách.
- `dateStart` / `dateEnd`: Ngày tàu xếp hàng (đi) / dỡ hàng xong (đến).
- `reportMonth`: Tháng hạch toán kế toán (`YYYY-MM`).
- `costs`: Tập hợp chi phí chuyến hàng:
  - `fuelDO`: Tiền dầu DO chuyến.
  - `fuelLO`: Tiền dầu nhờn LO chuyến.
  - `crewSalary`: Lương thuyền viên chuyến đó.
  - `crewFood`: Tiền ăn của thuyền viên.
  - `crewInsurance`: Bảo hiểm.
  - `materialCompany`: Vật tư công ty cấp.
  - `materialVessel`: Vật tư tàu tự mua.
  - `monthlyOther`: Chi phí khác công ty chi.
  - `agent`: Phí đại lý 2 đầu cảng.
  - `vessel2ends`: Tàu chi 2 đầu cảng.
  - `brokerage`: Tiền bông (môi giới).
  - `vat`: Thuế VAT chuyến.
  - `portFees`: Lệ phí cảng, hoa tiêu, tàu lai.
  - `others`: Chi phí phát sinh khác do tàu chi.

### 2.3. Quản lý Nhiên liệu (`fuelVoyages` & `fuelLogs`)
- **Chuyến dầu (`fuelVoyages`):** Theo dõi cấp dầu theo đợt.
  - `id`: Mã chuyến dầu.
  - `vesselId`: Mã tàu.
  - `voyageNo`: Chuyến số.
  - `initialFuel`: Tồn dầu đầu kỳ (Lít).
  - `addedFuel`: Số lượng dầu cấp thêm trong chuyến (Lít).
  - `fuelDate` / `fuelLocation` / `fuelVendor`: Ngày cấp, nơi cấp, nhà cung cấp dầu.
  - `fuelUnitPrice`: Đơn giá mua dầu (VND/Lít).
- **Chặng hành trình (`fuelLogs`):** Chi tiết hành trình trong chuyến để tính lượng tiêu hao.
  - `id`: Mã chặng.
  - `fuelVoyageId`: Liên kết tới chuyến dầu.
  - `startTime` / `endTime`: Thời gian đi / đến.
  - `startPos` / `endPos`: Cảng đi / cảng đến.
  - `fuelRate`: Định mức dầu chặng đó (Lít/giờ).
  - `hours`: Số giờ chạy thực tế của chặng (Giờ).

### 2.4. Theo dõi Giao dịch Thu/Chi (`transactions`)
- `id`: Mã giao dịch.
- `date`: Ngày giao dịch (`YYYY-MM-DD`).
- `vessel`: Tàu chịu phí (hoặc `VP` nếu là chi phí văn phòng).
- `category`: Hạng mục thu chi (ví dụ: `4.Dầu DO`, `1.Tàu Ứng`, `CVC` (Cước vận chuyển), `3.Lương`...).
- `voyageNo`: Liên kết chuyến tàu (nếu có).
- `contractNo`: Liên kết số hợp đồng (nếu có).
- `partner`: Đối tác giao dịch.
- `content`: Nội dung chi tiết giao dịch.
- `thu`: Khoản tiền thu vào (VND).
- `chi`: Khoản tiền chi ra (VND).
- `account`: Tài khoản giao dịch (gồm: `Tiền mặt`, `ABbank`, `Viettinbank`, `Tài khoản cá nhân`).

### 2.5. Nhân sự & Chấm công (`employees` & `timesheets`)
- **Thông tin nhân sự (`employees`):**
  - `id`: Mã nhân viên.
  - `name` / `role` / `department`: Họ tên, chức vụ, bộ phận (hoặc tên tàu phục vụ).
  - `actualSalary`: Lương thực tế thoả thuận nhận hàng tháng.
  - `basicSalary`: Lương cơ bản làm căn cứ đóng BHXH.
  - `insurance`: Tiền đóng bảo hiểm xã hội trích lương.
  - Các khoản phụ cấp: `mealAllowance` (ăn ca), `phoneAllowance` (điện thoại), `clothingAllowance` (trang phục), `transportAllowance` (đi lại/xăng xe), `deliveryAllowance` (phụ cấp giao nhận), `completionBonus` (thưởng hoàn thành).
  - Giảm trừ: `personalDeduction` (giảm trừ bản thân), `dependents` (số người phụ thuộc).
- **Bảng chấm công (`timesheets`):** Chấm ngày công làm việc hàng tháng theo bộ phận/tàu.

---

## 3. Các Công thức & Quy tắc Nghiệp vụ Kinh doanh

### 3.1. Tính Hiệu quả Kinh tế Chuyến hàng
- **Doanh thu thực tế chuyến hàng (`revenueReal`):**
  $$\text{Doanh thu thực tế} = \text{Khối lượng hàng (qty)} \times \text{Đơn giá thực (rate)}$$
- **Tổng Chi phí Chuyến hàng:** Là tổng của toàn bộ các khoản mục chi phí nằm trong trường `costs` của chuyến hàng (gồm dầu DO, LO, lương, ăn ca, phí cảng, hoa hồng...).
- **Thuế VAT chuyến hàng:** Được tính toán động trên giao diện (nếu không nhập thủ công):
  $$\text{VAT Chuyến} = 8\% \times \text{Doanh thu hóa đơn (revenueInvoice)} - 10\% \times \text{Tiền dầu DO (fuelDO)}$$
- **Lợi nhuận ròng chuyến hàng:**
  $$\text{Lợi nhuận} = \text{Doanh thu thực tế} - \text{Tổng Chi phí Chuyến}$$

### 3.2. Tính toán Nhiên liệu Tàu
- **Tiêu thụ nhiên liệu chặng (`legConsumption`):**
  $$\text{Tiêu thụ chặng} = \text{Số giờ chạy (hours)} \times \text{Định mức tiêu thụ chặng (fuelRate)}$$
- **Tồn cuối kỳ chuyến dầu (`runningBalance`):**
  $$\text{Tồn cuối chuyến} = \text{Tồn đầu chuyến (initialFuel)} + \text{Dầu cấp thêm (addedFuel)} - \text{Tổng tiêu thụ các chặng của chuyến (totalFuel)}$$
- **Quy tắc lũy kế:** Tồn cuối của chuyến trước được chuyển làm Tồn đầu của chuyến kế tiếp theo thứ tự thời gian.

### 3.3. Quy tắc Tính Lương và Thuế Thu nhập Cá nhân
- **Tổng thu nhập chịu thuế:**
  $$\text{Tổng thu nhập} = \text{Lương thực tế} + \text{Các khoản phụ cấp chịu thuế (ăn ca, điện thoại...)}$$
- **Các khoản giảm trừ:**
  - Giảm trừ bản thân: Mặc định $15,500,000\text{ VND}$.
  - Giảm trừ người phụ thuộc: $4,400,000\text{ VND} \times \text{Số người phụ thuộc}$.
  - Bảo hiểm xã hội: Trích theo mức `insurance`.
- **Thuế TNCN:** Tính theo biểu thuế lũy tiến từng phần của Việt Nam dựa trên phần thu nhập còn lại sau khi trừ đi các khoản giảm trừ.

---

## 4. Cơ chế Đồng bộ hóa Đám mây
1. **Real-time Sync (Hai chiều):** Ứng dụng theo dõi trực tiếp nút `shipmanage/state` trên Realtime Database. Khi có bất kỳ thay đổi nào từ các thiết bị khác, dữ liệu sẽ tự động tải về, lưu vào LocalStorage và render lại giao diện màn hình tức thời.
2. **Offline-first:** Khi mất mạng, mọi chỉnh sửa được lưu tạm ở LocalStorage. Khi kết nối lại, hệ thống sẽ đẩy dữ liệu lên lại đám mây.
3. **Manual Force Sync:** Người dùng có thể nhấn nút **Ép đồng bộ lên Cloud** (<i class="fa-solid fa-cloud-arrow-up"></i>) ở header để ép ghi đè dữ liệu cục bộ lên đám mây thông qua Firebase SDK WebSocket.
