# Tài liệu Dự án: ShipManage Pro V2.0 (Hệ thống Quản lý Vận tải biển)

Tài liệu này cung cấp toàn bộ thông tin chi tiết về kiến trúc ứng dụng, mô hình dữ liệu (State Schema), các quy tắc tính toán tài chính nghiệp vụ và cơ chế đồng bộ hóa dữ liệu. Đây là tài liệu chuẩn để tham chiếu và thực hiện các công việc bảo trì, tối ưu hóa và nâng cấp tiếp theo.

---

## 1. Kiến trúc & Cấu trúc Thư mục Dự án

Hệ thống được phát triển theo mô hình **Single Page Application (SPA)** thuần túy, không sử dụng các framework nặng như React/Angular/Vue nhằm tối ưu hóa hiệu năng, tính linh hoạt và khả năng chạy ngoại tuyến hoàn toàn trên môi trường trình duyệt.

```
ShipManageV3/
├── app/                        # Mã nguồn giao diện và logic chạy Web Client
│   ├── css/
│   │   └── style.css           # CSS hệ thống (Thiết kế Modern Dark/Glassmorphism, responsive di động/iPad)
│   ├── js/
│   │   ├── app.js              # Logic ứng dụng, điều hướng view, khởi tạo biểu đồ Chart.js, xuất Excel
│   │   ├── data.js             # Quản lý State DB, lưu trữ LocalStorage, các hàm tính toán nghiệp vụ
│   │   ├── firebase.js         # Kết nối Firebase SDK (Auth & Realtime Database), cơ chế đồng bộ đám mây
│   │   └── views.js            # Khai báo các view HTML dạng template JavaScript
│   └── index.html              # Điểm truy cập duy nhất, nạp thư viện CDN & UI Login Glassmorphism
├── .firebaserc                 # Cấu hình dự án Firebase mặc định (shipmanagev33333)
├── firebase.json               # Cấu hình Firebase Hosting
├── .gitignore                  # Loại trừ các file Excel nội bộ và thư mục node_modules
└── read.MD                     # Tài liệu này (Bản tóm tắt chuẩn của dự án)
```

### Thư viện bên ngoài (Tải qua CDN trong `index.html`):
- **Chart.js v4.4.1**: Hiển thị biểu đồ phân tích kinh doanh, xu hướng doanh thu và cơ cấu chi phí.
- **SheetJS (XLSX) v0.18.5**: Đọc/xuất báo cáo dữ liệu trực tiếp sang tệp tin Excel `.xlsx`.
- **FontAwesome v6.4.0**: Bộ icon giao diện chuyên nghiệp.
- **Firebase SDK v8.10.1 (App, Auth, Database)**: Hệ thống xác thực và đồng bộ dữ liệu thời gian thực.

---

## 2. Mô hình Dữ liệu Chi tiết (State Schema)

Hệ thống quản lý trạng thái tập trung thông qua một đối tượng JSON duy nhất lưu trong biến `AppData.state` và được tự động đồng bộ hóa với LocalStorage (khóa `shipManageDB_v2`) và đám mây Firebase Realtime Database (`shipmanage/state`).

Cấu trúc chi tiết của các thực thể dữ liệu trong `state`:

### 2.1. Thông tin Công ty (`company`)
- `name`: Tên doanh nghiệp.
- `taxId`: Mã số thuế.
- `bankInfo`: Thông tin tài khoản ngân hàng nhận thanh toán.
- `address`: Địa chỉ văn phòng công ty.
- `openingBalances`: Số dư đầu kỳ của các tài khoản tài chính:
  - `ABbank`, `Viettinbank`, `Tài khoản cá nhân`, `Tiền mặt`.

### 2.2. Đội tàu (`vessels`)
- `id`: Mã định danh tàu (Ví dụ: `VG05`, `VG09`, `VG15`, `VG18`, `VG36`).
- `name`: Tên tàu hiển thị (Ví dụ: Vũ Gia 05, Vũ Gia 09...).
- `capacity`: Trọng tải đăng kiểm (Tấn).
- `captain`: Họ tên thuyền trưởng hiện tại.
- `fuelRate`: Định mức nhiên liệu mặc định khi hoạt động (Lít/giờ chạy).

### 2.3. Quản lý Chuyến hàng (`shipments`)
Mỗi chuyến hàng ghi nhận toàn bộ thông tin vận hành và tập hợp đầy đủ doanh thu, chi phí của chuyến đó:
- `id`: Mã chuyến hàng tự sinh (`S` + timestamp).
- `vesselId`: Mã tàu thực hiện chuyến (Liên kết với `vessels.id`).
- `contractNo`: Số hợp đồng vận chuyển (Ví dụ: `HD01`, `HD02`...).
- `voyageNo`: Số chuyến thứ tự của tàu đó (Ví dụ: `C1`, `C2`...).
- `customer`: Tên khách hàng thuê tàu.
- `cargo`: Mặt hàng vận chuyển (quặng, clinker, than cám, cát, thạch cao...).
- `qty`: Khối lượng hàng xếp lên tàu thực tế (Tấn).
- `rate`: Đơn giá cước thỏa thuận thực tế (VNĐ/Tấn).
- `markup`: Tiền bông (chiết khấu môi giới trả lại khách hàng trên mỗi tấn cước).
- `revenueReal`: Doanh thu cước thực tế nhận về ($qty \times rate$).
- `revenueInvoice`: Doanh thu hóa đơn khai báo để xuất VAT.
- `refundAmount`: Tổng tiền gửi trả lại cho khách hàng (Tính tự động theo công thức nghiệp vụ).
- `dateStart` / `dateEnd`: Ngày tàu xếp hàng (đi) / dỡ hàng xong (đến).
- `reportMonth`: Tháng hạch toán kế toán chuyến đi (`YYYY-MM`).
- `fuelHours`: Số giờ chạy chuyến tàu tương ứng (đồng bộ từ chặng chạy dầu).
- `fuelPrice`: Đơn giá mua dầu DO của chuyến đó.
- `costs`: Bản ghi chứa chi tiết chi phí chuyến hàng:
  - `fuelDO`: Tiền dầu DO chuyến (Tính tự động từ nhật ký dầu).
  - `fuelLO`: Chi phí dầu nhờn LO chuyến.
  - `crewSalary`: Chi phí lương thuyền viên phân bổ theo ngày chạy.
  - `crewFood`: Chi phí tiền ăn thuyền viên phân bổ theo ngày chạy.
  - `crewInsurance`: Chi phí bảo hiểm xã hội thuyền viên phân bổ.
  - `materialCompany`: Vật tư do công ty cấp phân bổ.
  - `materialVessel`: Vật tư tự mua do tàu chi phân bổ.
  - `monthlyOther`: Chi phí cố định khác phân bổ từ văn phòng công ty.
  - `loanInterest`: Chi phí lãi vay ngân hàng phân bổ cho tàu theo ngày chạy.
  - `agent`: Chi phí phụ phí đại lý 2 đầu cảng (Lấy từ bảng cấu hình "Dai ly.xlsx").
  - `vessel2ends`: Chi phí tàu tự chi tại 2 đầu cảng (Đồng bộ từ báo cáo thuyền trưởng).
  - `brokerage`: Tiền hoa hồng môi giới chuyến đi (Đồng bộ từ báo cáo thuyền trưởng).
  - `vat`: Chi phí thuế giá trị gia tăng phải nộp chuyến hàng (Tính tự động).
  - `portFees`: Lệ phí cảng, hoa tiêu, tàu lai do công ty chi trả trực tiếp.
  - `others`: Các chi phí phát sinh khác do tàu tự chi tiêu được phân bổ.

### 2.4. Quản lý Nhiên liệu (`fuelVoyages` & `fuelLogs`)
- **Chuyến dầu (`fuelVoyages`):** Theo dõi cấp nhiên liệu từng đợt của tàu.
  - `id`: Mã chuyến dầu (`FV` + timestamp).
  - `vesselId`: Mã tàu.
  - `voyageNo`: Chuyến số tương ứng (Ví dụ: `C1`, `C2`...).
  - `cargoType`: Loại hàng chạy trong chuyến.
  - `initialFuel`: Tồn dầu đầu kỳ (Lít) nhận bàn giao từ chuyến trước.
  - `addedFuel`: Số lượng dầu DO được cấp thêm trong chuyến (Lít).
  - `fuelDate` / `fuelLocation` / `fuelVendor`: Ngày cấp, địa điểm nhận dầu, đơn vị cung cấp dầu DO.
  - `fuelUnitPrice`: Đơn giá mua dầu thực tế trong đợt cấp (VNĐ/Lít).
- **Chặng hành trình chi tiết (`fuelLogs`):** Nhật ký chạy tàu của chuyến dầu.
  - `id`: Mã chặng hành trình (`FL` + timestamp).
  - `fuelVoyageId`: Liên kết tới chuyến dầu cha (`fuelVoyages.id`).
  - `startPos` / `endPos`: Cảng xuất phát / Cảng đến.
  - `startTime` / `endTime`: Thời gian đi / dỡ hàng xong (Thời gian đến).
  - `fuelRate`: Định mức dầu DO tiêu hao thực tế chặng chạy (Lít/giờ).
  - `hours`: Số giờ hành trình thực tế của chặng chạy (Giờ).

### 2.5. Giao dịch Tài chính Thu/Chi (`transactions`)
Sổ cái kế toán ghi nhận tất cả dòng tiền chuyển dịch trong hệ thống:
- `id`: Mã giao dịch kế toán (`TR` + timestamp hoặc từ nhập liệu Excel).
- `date`: Ngày phát sinh giao dịch (`YYYY-MM-DD`).
- `vessel`: Mã tàu chịu chi phí (Hoặc `VP` nếu là chi phí dùng chung của Văn phòng Công ty).
- `category`: Hạng mục thu chi (Ví dụ: `4.Dầu DO`, `1.Tàu Ứng`, `CVC` (Cước vận chuyển), `3.Lương`, `9.Vật Tư`, `6.Lãi Vay`...).
- `voyageNo` / `contractNo`: Mã chuyến / số hợp đồng liên kết (nếu có).
- `partner`: Tên đối tác nhận tiền hoặc trả tiền.
- `content`: Diễn giải chi tiết nội dung giao dịch.
- `thu`: Số tiền thu vào công ty (VNĐ).
- `chi`: Số tiền chi ra từ công ty (VNĐ).
- `account`: Tài khoản giao dịch (`Tiền mặt`, `ABbank`, `Viettinbank`, `Tài khoản cá nhân`).

### 2.6. Nhân sự, Chấm công & Lương (`employees` & `timesheets`)
- **Nhân viên (`employees`):**
  - `id`: Mã nhân viên (`EMP-` + random).
  - `name`: Họ và tên đầy đủ.
  - `role`: Chức danh phục vụ (Thuyền trưởng, Máy trưởng, Thủy thủ, Bếp...).
  - `department`: Nơi làm việc (Tên tàu phục vụ: `VG05`, `VG18`... hoặc `VP` nếu là văn phòng).
  - `basicSalary`: Lương cơ bản làm căn cứ đóng BHXH bắt buộc.
  - `actualSalary`: Lương thỏa thuận thực tế nhận hàng tháng.
  - `insurance`: Tiền trích đóng bảo hiểm xã hội trực tiếp vào lương cá nhân.
  - Các khoản phụ cấp hàng tháng:
    - `mealAllowance` (Tiền ăn ca), `phoneAllowance` (Điện thoại), `clothingAllowance` (Trang phục), `transportAllowance` (Xăng xe/đi lại), `deliveryAllowance` (Phụ cấp giải phóng tàu/giao nhận), `completionBonus` (Thưởng hoàn thành chuyến).
  - `personalDeduction`: Giảm trừ gia cảnh bản thân (Mặc định: 15.500.000 VNĐ).
  - `dependents`: Số người phụ thuộc đăng ký để giảm trừ gia cảnh thuế TNCN.
- **Bảng chấm công (`timesheets`):**
  - Lưu trữ ngày công làm việc thực tế hàng tháng theo bộ phận hoặc theo từng tàu để phục vụ việc tính bảng lương tự động.

### 2.7. Chi phí tháng của tàu (`monthlyCosts`)
Bản ghi chi phí cố định phát sinh hàng tháng của mỗi tàu để phân bổ cước:
- `month`: Tháng hạch toán (`YYYY-MM`).
- `vesselId`: Mã tàu.
- `salary`: Tổng lương của toàn bộ thuyền viên trên tàu tháng đó.
- `insurance`: Tổng tiền đóng bảo hiểm xã hội của đội tàu.
- `food`: Tổng tiền ăn của đội tàu.
- `materialCompany`: Tổng vật tư do công ty cấp trong tháng.
- `materialVessel`: Tổng vật tư tàu tự mua trong tháng.
- `loanInterest`: Tiền lãi vay ngân hàng phân bổ riêng cho tàu.
- `other`: Các chi phí cố định văn phòng phân bổ cho tàu.

### 2.8. Báo cáo của Thuyền trưởng (`captainReports`)
Báo cáo chi tiêu tại tàu hàng tháng do Thuyền trưởng gửi về:
- `month`: Tháng báo cáo (`YYYY-MM`).
- `vesselId`: Mã tàu.
- `food`: Tổng chi phí tiền ăn thực tế đã chi tiêu tại tàu trong tháng.
- `material`: Tổng tiền mua vật tư sửa chữa do tàu tự chi tiêu trực tiếp trong tháng.
- `portExpenses`: Mảng các khoản chi phí cảng do tàu tự thanh toán (Lưu: `voyageNo`, `amount`, `content`).
- `brokerages`: Mảng các khoản tiền bông thuyền trưởng tự chi (Lưu: `voyageNo`, `amount`, `content`).

---

## 3. Các Quy tắc Tính toán & Nghiệp vụ Kinh doanh

Hệ thống tích hợp sẵn các công thức tự động hóa nghiệp vụ cốt lõi sau:

### 3.1. Tính Hiệu quả Kinh tế Chuyến hàng (`Views.report`)
Mỗi chuyến đi được lập báo cáo hiệu quả tài chính riêng biệt:
1. **Doanh thu cước thực tế (`revenueReal`):**
   $$\text{Doanh thu thực tế} = \text{Khối lượng thực (qty)} \times \text{Đơn giá thực tế (rate)}$$
2. **Tổng Chi phí Chuyến hàng:** Là tổng toàn bộ các khoản mục chi phí được liệt kê chi tiết trong `costs`.
3. **Chi phí Thuế VAT chuyến đi (Động):**
   Tính dựa trên mức thuế suất 8% cho doanh thu hóa đơn và được khấu trừ đầu vào 10% từ tiền dầu DO mua chuyến hàng đó:
   $$\text{Thuế VAT chuyến} = \text{round}\left( 8\% \times \text{revenueInvoice} - 10\% \times \text{costs.fuelDO} \right)$$
   *(Nếu kết quả nhỏ hơn 0, thuế VAT chuyến đi mặc định ghi nhận bằng 0)*.
4. **Lợi nhuận ròng chuyến hàng:**
   $$\text{Lợi nhuận ròng} = \text{Doanh thu thực tế (revenueReal)} - \text{Tổng chi phí chuyến}$$

### 3.2. Nghiệp vụ hoàn trả tiền cước cho khách hàng (Tiền bông / Môi giới)
Tự động tính chiết khấu trả lại khách hàng thông qua hàm `calcRefund` trong `data.js`:
- Tính chênh lệch doanh thu hóa đơn và doanh thu thực tế:
  $$\text{diff} = \text{revenueInvoice} - \text{revenueReal}$$
- Nếu hợp đồng là `HD25` hoặc `HD54`: Tỷ lệ hoàn trả là `20%` ($0.20$).
- Với tất cả hợp đồng khác: Tỷ lệ hoàn trả mặc định là `28%` ($0.28$).
- Công thức tính số tiền trả lại:
  $$\text{refundAmount} = \text{diff} - \left( \frac{\text{diff}}{1.08} \times \text{tỉ lệ hoàn trả} \right)$$

### 3.3. Thuật toán phân bổ chi phí cố định theo ngày chuyến (`calcExactAllocation`)
Các chi phí như lương thuyền viên, tiền ăn, bảo hiểm xã hội, vật tư công ty, vật tư tàu chi tiêu và tiền lãi vay phát sinh theo tháng, nhưng được phân bổ động cho từng chuyến hàng dựa trên số ngày thực tế chuyến hàng chạy trong tháng đó.
- Nếu chuyến hàng chạy vắt qua 2 tháng (Ví dụ: từ 25/01 đến 05/02): Hệ thống tự chia nhỏ chuyến đi thành 2 chặng: chặng tháng 1 (6 ngày) và chặng tháng 2 (5 ngày).
- Với mỗi ngày chạy $d$, chi phí được tính bằng:
  $$\text{Chi phí ngày } d = \frac{\text{Chi phí tháng của tàu đó}}{\text{Số ngày của tháng đó}}$$
- Chi phí phân bổ cho chuyến hàng = Tổng chi phí ngày của tất cả các ngày từ `dateStart` đến `dateEnd`.
- Công thức này giúp hạch toán lãi lỗ của chuyến hàng chính xác tuyệt đối theo thời gian thực vận hành.

### 3.4. Quản lý Nhiên liệu DO & Lũy kế Tồn dầu
- **Tiêu thụ nhiên liệu chặng chạy:**
  $$\text{Tiêu thụ chặng (Lít)} = \text{Số giờ hành trình (hours)} \times \text{Định mức tiêu thụ (fuelRate)}$$
- **Tổng tiêu thụ chuyến dầu (`totalFuel`):** Tổng tiêu thụ của tất cả các chặng hành trình (`fuelLogs`) liên kết tới chuyến dầu.
- **Tồn cuối kỳ chuyến dầu (`runningBalance`):**
  $$\text{Tồn cuối chuyến} = \text{Tồn đầu chuyến (initialFuel)} + \text{Dầu cấp thêm (addedFuel)} - \text{Tổng tiêu thụ chuyến (totalFuel)}$$
- **Nguyên tắc lũy kế:** Chuyến đi sau sẽ lấy tồn dầu cuối kỳ của chuyến đi trước của tàu làm số dư tồn dầu đầu kỳ.
- **Tính chi phí Dầu DO chuyến hàng (`costs.fuelDO`):**
  $$\text{costs.fuelDO} = \text{Tổng tiêu thụ chuyến (totalFuel)} \times \text{Đơn giá mua dầu của chuyến (fuelUnitPrice)}$$
  *(Nếu đơn giá mua dầu chuyến đó bằng 0, hệ thống tự động tìm đơn giá của chuyến gần nhất trước đó có giá mua, nếu vẫn không tìm thấy mặc định lấy đơn giá 20.000 VNĐ/Lít)*.

### 3.5. Cơ chế quản lý Quỹ Tàu (Thuyền trưởng quản lý)
- **Tiền tạm ứng nhận về (Thu):** Tổng số tiền công ty chi ra có danh mục chi phí `1.Tàu Ứng` và liên kết với mã tàu trong tháng hạch toán.
- **Tiền chi tiêu tại tàu (Chi):**
  $$\text{Tiền chi tại tàu} = \text{Tiền ăn (food)} + \text{Vật tư tự mua (material)} + \text{Chi phí cảng tự trả (portExpenses)} + \text{Tiền bông tự trả (brokerages)}$$
  *(Các số liệu này được nhập từ Báo cáo Thuyền trưởng hàng tháng)*.
- **Số dư Quỹ Tàu:** Lũy kế số tiền ứng thừa/thiếu của thuyền trưởng chuyển tiếp qua các tháng:
  $$\text{Tồn quỹ cuối tháng} = \text{Tồn quỹ đầu tháng} + \text{Tiền tạm ứng nhận về} - \text{Tiền chi tiêu thực tế tại tàu}$$

### 3.6. Công thức Tính Lương & Thuế TNCN Thuyền viên
- **Tổng thu nhập chịu thuế TNCN:**
  $$\text{Tổng thu nhập} = \text{Lương thực tế (actualSalary)} + \text{Phụ cấp chịu thuế (điện thoại, xăng xe...)}$$
- **Các khoản giảm trừ hợp lệ:**
  - Giảm trừ bản thân người nộp thuế: $15.500.000\text{ VNĐ}$ / tháng.
  - Giảm trừ người phụ thuộc: $4.400.000\text{ VNĐ} \times \text{Số người phụ thuộc}$.
  - Tiền bảo hiểm xã hội cá nhân trích nộp: Trừ trực tiếp theo số liệu trường `insurance`.
- **Thuế TNCN phải nộp:** Áp dụng biểu thuế lũy tiến từng phần theo quy định pháp luật Việt Nam dựa trên phần thu nhập tính thuế sau giảm trừ.

---

## 4. Đồng bộ hóa Đám mây & Backup An toàn

Ứng dụng hỗ trợ đồng bộ dữ liệu đa thiết bị thời gian thực thông qua Firebase Realtime Database (Singapore Server) với các quy tắc sau:

1. **Real-time Listener (Đồng bộ hai chiều):**
   Ứng dụng đăng ký lắng nghe sự kiện thay đổi dữ liệu từ nhánh `shipmanage/state` trên Realtime Database. Khi có thiết bị khác thay đổi dữ liệu, hệ thống tự động tải trạng thái mới nhất về, lưu vào LocalStorage và hiển thị cập nhật tức thời trên màn hình của người dùng.
2. **Offline-first (Lưu trữ ngoại tuyến trước):**
   Mọi thao tác thêm/sửa/xóa của người dùng đều ghi đè LocalStorage trước tiên. Khi thiết bị có mạng internet và đã đăng nhập tài khoản, hệ thống sẽ tự động đẩy bản cập nhật lên nhánh dữ liệu đám mây trong nền.
3. **Cơ chế Ép đồng bộ (Force Sync):**
   Tại góc phải Header có nút **Ép đồng bộ lên Đám mây** (<i class="fa-solid fa-cloud-arrow-up"></i>). Nút này cho phép người dùng ghi đè thủ công toàn bộ dữ liệu hiện tại trên trình duyệt cục bộ lên đám mây Firebase Realtime Database thông qua kết nối WebSocket bảo mật của SDK.
4. **Bảo mật và đăng xuất:**
   Khi người dùng thực hiện **Đăng xuất (Logout)**, hệ thống sẽ tự động xóa sạch dữ liệu cache lưu trong LocalStorage để bảo vệ an toàn thông tin kinh doanh nhạy cảm, tránh rò rỉ dữ liệu khi sử dụng chung máy tính.
