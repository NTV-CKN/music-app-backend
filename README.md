# Music App Backend (Firebase Cloud Functions)

Một backend Node.js triển khai dưới dạng Google Firebase Cloud Functions cho ứng dụng nghe nhạc. Hệ thống hỗ trợ:
- API REST cho songs, albums, artists, subscription, stream...
- Tích hợp thanh toán VNPAY (sandbox) để xử lý thanh toán đăng ký.
- Tích hợp AI phân tích / gợi ý (sử dụng thư viện @google/genai).
- Dùng Firestore làm cơ sở dữ liệu và firebase-admin để thao tác.

## Điểm nổi bật
- Triển khai dưới dạng Firebase Cloud Functions => không cần server riêng, dễ mở rộng.
- Hỗ trợ môi trường local qua Firebase Emulator (scripts sẵn trong `functions/package.json`).
- Có seed dữ liệu (file `functions/seed.js`) để khởi tạo bộ dữ liệu mẫu.
- Hệ thống auth đơn giản (có `auth.js` và `authMiddleware.js`).

## Stack
- Language: JavaScript (Node.js 24)
- Runtime: Firebase Cloud Functions (functions SDK)
- Notable libraries:
  - firebase-admin, firebase-functions (Firestore access & functions)
  - @google/genai (Google GenAI integration)
  - vnpay (VNPAY integration)
  - dotenv (env handling)

## Cấu trúc repository (top-level)
```
.
├─ .firebaserc                # firebase project alias
├─ firebase.json              # firebase config (functions, emulators...)
├─ firestore.rules            # security rules
├─ firestore.indexes.json
├─ package.json               # repo-level deps (helper)
├─ package-lock.json
└─ functions/                 # Firebase Cloud Functions
   ├─ package.json            # scripts: serve, shell, deploy, logs
   ├─ index.js                # entrypoint: mount các route chính (/v1, /v1/admin, /v1/auth/...)
   ├─ auth.js                 # logic login / user mapping
   ├─ authMiddleware.js       # middleware xác thực token
   ├─ seed.js                 # script seed dữ liệu vào Firestore
   ├─ genreSong.js            # enum/const cho genre
   ├─ routes/                 # (folder) route handlers (songs, albums, ai_rcm, subscriptionPayment, stream...)
   ├─ controllers/            # (folder) business logic (nơi chứa controller nếu có)
   ├─ services/               # (folder) các service helper (VNPAY, AI, ...)
   └─ utils/                  # (folder) tiện ích
```

Lưu ý: Các folder `routes`, `controllers`, `services`, `utils` chứa code route và logic — index.js đã mount các router:
- /v1/auth (ví dụ `POST /v1/auth/login`)
- /v1/admin (admin routes)
- /v1 (song, album, artist, subscription, subscription payment, ai recommendation routes, stream)

## Cách chạy (local)
1. Chuẩn bị:
   - Node.js 24 (theo functions/package.json)
   - Firebase CLI (cài đặt toàn cục)
   - Tạo Service Account JSON nếu muốn thao tác Firestore hoặc deploy (để dùng khi chạy seed hoặc deploy)

2. Cài đặt dependencies
```bash
# tại thư mục functions
cd functions
npm install
```

3. Chạy emulator functions (local)
```bash
# trong functions/
npm run serve
# tương đương: firebase emulators:start --only functions
```

4. Dùng Firebase Functions shell (tương tác)
```bash
npm run shell
```

5. Seed dữ liệu mẫu (ví dụ)
- Đảm bảo bạn đã cấu hình credentials (GOOGLE_APPLICATION_CREDENTIALS) hoặc đang chạy emulator với Firestore emulator.
- Chạy seed:
```bash
# từ repo root hoặc trong functions/
node functions/seed.js
# hoặc
cd functions
node seed.js
```

(Seed script dùng firebase-admin / firestore-export-import — đọc nội dung `functions/seed.js` để biết chi tiết.)

## Biến môi trường (ENV) cần thiết
- Với VNPay - Tiến hành truy cập trang https://sandbox.vnpayment.vn/devreg/ để đăng kí.
  + VNP_TMN_CODE (Nằm trong mail được gửi từ VNPay)
  + VNP_HASH_SECRET (Nằm trong mail được gửi từ VNPay)
  + VNP_HOST (Nằm trong mail được gửi từ VNPay)
  + RETURN_URL (Đường dẫn kết nối đến API server xử lí sự kiện thanh toán người dùng)
- GEMINI_API_KEY (Lấy tại: https://aistudio.google.com/api-keys)
- MODEL_AI (Model sử dụng trong dự án: gemini-3.6-flash)

## VNPAY (Sandbox) — lưu ý thiết lập
- Dự án đã dùng package `vnpay` (tham khảo `functions/package.json`).
- Đăng ký sandbox VNPAY để lấy `tmnCode` và `hashSecret` (hoặc dùng giá trị test do VNPAY cung cấp).
- Configure `VNPAY_RETURN_URL` để VNPAY redirect về sau thanh toán — backend cần có route callback để verify chữ ký và cập nhật trạng thái giao dịch.
- Luôn test với chế độ sandbox trước khi chuyển sang production.

## AI (Google GenAI) — tích hợp phân tích / gợi ý
- Thư viện: `@google/genai` đã được thêm vào `functions/package.json`.
- Phần AI được đặt trong router (ví dụ `routes/ai_rcm/*`) — chức năng có thể là phân tích nội dung bài hát/metadata hoặc gợi ý bài hát.
- Yêu cầu cấu hình quyền truy cập Google Cloud AI (API key hoặc service account + bật API tương ứng).
- Khi chạy trên Cloud Functions, đảm bảo service account có quyền gọi Google GenAI.

## Deploy lên Firebase
Từ thư mục functions hoặc root (khi firebase.json tồn tại):
```bash
cd functions
npm run deploy
# tương đương: firebase deploy --only functions
```
Trước khi deploy:
- Đăng nhập firebase: `firebase login`
- Chọn project: `firebase use <project-id>` hoặc check `.firebaserc` (mặc định project được đặt là `music-app-fcd10` trong repo).

## Các endpoint chính (tổng quan)
(index.js mount routers, danh sách dưới đây là các nhóm route chính)
- POST /v1/auth/login — login (xác thực/token)
- /v1/admin/* — group các admin API
- /v1/songs, /v1/albums, /v1/artists — resource chính cho nội dung âm nhạc
- /v1/subscriptions, /v1/subscriptions/payment — logic thanh toán / đăng ký (VNPAY)
- /v1/stream/* — streaming / tracking stream events
- /v1/ai-rcm/* (hoặc tương tự) — AI recommendation / phân tích

(Để biết chi tiết từng route, mở các file trong `functions/routes`.)

## Gợi ý chạy test & debug
- Dùng Firebase Emulator để debug local (logs hiển thị trên terminal).
- Xem logs: `cd functions && npm run logs` (script dùng `firebase functions:log`).
- Kiểm tra console/Firestore trực tiếp trong Firebase Console khi cần.

## Tệp hữu ích
- functions/index.js — entrypoint của functions và nơi mount router
- functions/auth.js — xử lý mapping user / login
- functions/authMiddleware.js — middleware kiểm tra token
- functions/seed.js — seed dữ liệu mẫu
- functions/package.json — scripts & dependencies cho functions

## Contributing
- Giữ coding style consistent (eslint config Google có trong `functions/.eslintrc.js`).
- Khi thêm secrets: không commit vào git — dùng Secret Manager hoặc set env trên Firebase Console.
- Kiểm tra local emulator trước khi deploy.

## FAQ / Các việc cần làm tiếp (gợi ý)
- Thiết lập rõ các biến môi trường và hướng dẫn lấy VNPAY sandbox credentials.
- Hoàn thiện README cho các route cụ thể (mô tả request/response cho mỗi endpoint).
- Thêm mô tả chi tiết cách cấu hình Google GenAI (API scopes, permission, ví dụ prompt).

## License & Contacts
- (Nếu muốn) Thêm file LICENSE vào repo.
- Người phát triển / maintainer: cập nhật thông tin liên hệ trong README nếu cần.
