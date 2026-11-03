// Builds audio/tracks.json (the Listen playlist + the text each MP3 is made from) from qbank.js.
// Run: node tools/make-tracks.js   (then GitHub Actions turns every track into an MP3)
const fs = require("fs"), crypto = require("crypto"), path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "qbank.js"), "utf8");
const D = JSON.parse(src.slice(src.indexOf("=") + 1).trim().replace(/;$/, ""));
const { SCEN, Q, DOMAINS, GLOSS, LESSONS, GUIDE } = D;
const L = "ABCDE";

// Turn study text (HTML, [[gloss]], `code`, arrows) into plain text that reads well aloud.
function speak(t) {
  return String(t)
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, " và ").replace(/&quot;/g, '"')
    .replace(/\[\[([^\]]+)\]\]/g, ", nghĩa là $1,")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s*(→|->|⇒)\s*/g, ", thì ")
    .replace(/[<>]/g, " ")
    .replace(/\s*&\s*/g, " và ")
    .replace(/(\w)_(\w)/g, "$1 $2").replace(/(\w)_(\w)/g, "$1 $2")
    .replace(/\s*–\s*/g, " đến ")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s\+\s/g, " và ")
    .replace(/\s+([,.;:])/g, "$1").replace(/,\s*([:;.])/g, "$1").replace(/,\s*,/g, ",").replace(/,\s*\./g, ".")
    .trim();
}
const dn = d => `Domain ${d}, ${DOMAINS[d][1].replace("&", "và")}`;
const tracks = [];
function add(t) {
  t.file = "audio/mp3/" + crypto.createHash("sha1").update(JSON.stringify(t.segs)).digest("hex").slice(0, 12) + ".mp3";
  tracks.push(t);
}

// 0) Exam guide Section 6: one track per task statement. English bullet (verbatim), then Vietnamese explanation.
const en = t => String(t).replace(/_/g, " ").replace(/"/g, "");
add({ id: "guide-intro", cat: "guide", d: 1, title: "Giới thiệu kỳ thi CCAR-F",
  segs: [["vi", "Giới thiệu kỳ thi Claude Certified Architect, Foundations, mã CCAR-F. Bài thi có 60 câu, làm trong 120 phút. Điểm đậu là 720 trên thang 1000. Đề lấy ngẫu nhiên 4 trong 6 scenario, tức tình huống: Customer Support Resolution Agent, Code Generation with Claude Code, Multi-Agent Research System, Developer Productivity with Claude, Claude Code for Continuous Integration, và Structured Data Extraction. Có 5 domain. Domain 1, kiến trúc agent và điều phối, chiếm 27 phần trăm, lớn nhất. Domain 2, thiết kế tool và MCP, 18 phần trăm. Domain 3, cấu hình và quy trình Claude Code, 20 phần trăm. Domain 4, viết prompt và output có cấu trúc, 20 phần trăm. Domain 5, quản lý context và độ tin cậy, 15 phần trăm. Mỗi domain gồm nhiều task statement, tức nhiệm vụ được kiểm tra. Mỗi task statement có phần Knowledge of, tức kiến thức cần biết, và Skills in, tức kỹ năng cần làm được. Trong các bài nghe tiếp theo, bạn sẽ nghe câu gốc tiếng Anh trong exam guide, rồi nghe giải thích tiếng Việt."], ["pause", 1]] });
GUIDE.forEach(g => {
  const segs = [["vi", `Exam guide, ${dn(g.d)}. Task statement ${g.id}.`], ["en", en(g.title)], ["vi", g.vt + ". " + g.sum], ["pause", 1],
    ["vi", "Phần Knowledge of, kiến thức cần biết."]];
  g.k.forEach(([e, v], i) => segs.push(["vi", `Ý ${i + 1}.`], ["en", en(e)], ["pause", 0.6], ["vi", v], ["pause", 0.8]));
  segs.push(["vi", "Phần Skills in, kỹ năng cần làm được."]);
  g.s.forEach(([e, v], i) => segs.push(["vi", `Kỹ năng ${i + 1}.`], ["en", en(e)], ["pause", 0.6], ["vi", v], ["pause", 0.8]));
  segs.push(["vi", `Nhắc lại ý chính của task statement ${g.id}: ${g.sum.replace(/^Ý chính: /, "")}`], ["pause", 1]);
  add({ id: `guide-${g.id}`, cat: "guide", d: g.d, title: `${g.id} · ${g.vt}`, segs });
});

// 1) Lessons: one track per note section of study days 1-5.
LESSONS.forEach(l => l.secs.forEach((s, i) => {
  const title = s.h.replace(/\[\[[^\]]+\]\]/g, "").replace(/\s+/g, " ").trim();
  add({ id: `les-${l.day}-${i + 1}`, cat: "lesson", d: l.d, title: `Day ${l.day} · ${title}`,
    segs: [["vi", `Bài học ${dn(l.d)}. Phần: ${speak(s.h)}.`], ["pause", 1],
      ...s.items.map(x => ["vi", speak(x)]), ["pause", 1]] });
}));

// 2) Flashcards: one track per study day; English term in an English voice, meaning in Vietnamese.
for (let day = 1; day <= 5; day++) {
  const cards = GLOSS.filter(g => g[0] === day), d = LESSONS[day - 1].d;
  const segs = [["vi", `Flashcards Day ${day}, ${dn(d)}. Nghe thuật ngữ tiếng Anh, tự nói nghĩa trước, rồi nghe đáp án.`], ["pause", 1]];
  cards.forEach(([, term, vi]) => segs.push(["en", term], ["pause", 2.5], ["vi", speak(vi)], ["pause", 1.2]));
  add({ id: `card-${day}`, cat: "cards", d, title: `Flashcards Day ${day} (${cards.length} thẻ)`, segs });
}

// 3) Questions: one track per mock question, with a think pause before the answer.
Object.keys(Q).forEach(e => Q[e].forEach((q, i) => {
  const multi = q.a.length > 1;
  add({ id: `q-${e}-${i}`, cat: "quiz", d: q.d, exam: +e, n: i + 1, title: `Mock ${e} · Câu ${i + 1} · ${SCEN[q.s].n}`,
    segs: [["vi", `Mock ${e}, câu ${i + 1}. ${dn(q.d)}. ${speak(q.vi)}${multi ? " Chọn hai đáp án." : ""}`],
      ...q.ov.map((o, k) => ["vi", `${L[k]}. ${speak(o)}`]),
      ["pause", 5],
      ["vi", `Đáp án đúng: ${q.a.map(k => L[k]).join(" và ")}. ${speak(q.ev)}`], ["pause", 1]] });
}));

fs.mkdirSync(path.join(root, "audio"), { recursive: true });
fs.writeFileSync(path.join(root, "audio/tracks.json"), JSON.stringify({ voice: { vi: "vi-VN-HoaiMyNeural", en: "en-US-AriaNeural" }, tracks }));
console.log(tracks.length, "tracks:", ["guide", "lesson", "cards", "quiz"].map(c => c + "=" + tracks.filter(t => t.cat === c).length).join(" "));
