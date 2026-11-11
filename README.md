# CCAR-F Practice (iPhone web app)

Ứng dụng luyện thi **Claude Certified Architect – Foundations (CCAR-F)**, cài lên iPhone dưới dạng PWA (web app thêm vào Home Screen).

> Câu hỏi là câu tự soạn để luyện tập, **không phải câu hỏi thi thật**. Phần exam guide là trích nguyên văn Section 6 của exam guide chính thức v1.0, kèm giải thích tiếng Việt.

## Tính năng
- **Game mode (cày level)**: XP cho mỗi câu đúng, combo 🔥, level + rank (Prompt Newbie → Claude Architect Legend), 3 daily quests + rương 🎁, 20 huy hiệu (badges), World map 5 vùng = 5 domain (★ 1–3 sao), 6 boss = 6 mock exam (≥ 720 là hạ boss). Tiến độ cũ được đổi thành XP khi mở bản mới.
- **Theme lofi**: ⚙︎ → Theme: Game, Latte ☕, Rainy night 🌧️, Matcha 🍵, Sunset café 🌅.
- **Pomodoro 🍅**: focus 15/25/45/50 phút + break, chạy tiếp khi khoá màn hình, xong 1 pomodoro +30 XP.
- **Luyện (practice)**: chọn 1 hoặc nhiều domain để trộn (vd D1 + D4 + D5), chọn số câu mỗi domain (5/10/15/20), gợi ý task statement cần ôn (vd D2.1, D2.2) dưới domain yếu, lọc scenario, xem đáp án + giải thích EN/VN ngay.
- **Ôn câu sai**: spaced repetition (ôn lại sau 1, 3, 7, 14 ngày).
- **Thi thử (mock)**: 6 đề × 60 câu (Mock 5–6 thêm ngày 2026-11-11), 120 phút, điểm /1000, pass 720, biểu đồ theo domain.
- **Thẻ (flashcards)**: 75 thuật ngữ EN → VN, vuốt trái/phải.
- **Nghe (listen)**: MP3 tiếng Việt: exam guide (30 task statements), bài học, flashcards, 360 câu hỏi. Nghe được khi khoá màn hình, tải về để nghe offline.
- **Home**: streak, % đúng theo domain, readiness (Mock 3 và 4 ≥ 800, không domain < 70%), export/import backup.

## Cấu trúc
| File | Vai trò |
|---|---|
| `index.html` | Toàn bộ app (HTML + CSS + JS), gồm game layer (`S.g` trong localStorage, nằm trong file export backup) |
| `qbank.js` | Dữ liệu: câu hỏi, glossary, bài học, exam guide + giải thích VN |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA: offline, icon Home Screen |
| `tools/make-tracks.js` | Tạo `audio/tracks.json` (danh sách bài nghe + lời đọc) từ `qbank.js` |
| `tools/build_audio.py` | Tạo MP3 bằng edge-tts (giọng `vi-VN-HoaiMyNeural`, `en-US-AriaNeural`) + ffmpeg |
| `tools/guide_vi_*.py` | Giải thích tiếng Việt cho từng task statement |
| `.github/workflows/deploy.yml` | Mỗi lần push lên `main`: tạo MP3 (có cache) rồi deploy GitHub Pages |

## Sửa nội dung
1. Sửa `qbank.js` (hoặc file `tools/guide_vi_*.py` rồi chạy lại bước merge).
2. `node tools/make-tracks.js`
3. Commit + push. GitHub Actions tự tạo lại MP3 cho bài thay đổi.

## Bật GitHub Pages (một lần)
Settings → Pages → Build and deployment → Source: **GitHub Actions**.
