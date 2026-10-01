// خادم فضاء الأساتذة — متوسطة الشهيد بلعكرمي أعمر
// الإصدار 2
//
// طريقة التركيب (مرة واحدة):
//   1. الصق هذا الملف كاملًا في مشروع جديد على script.google.com
//   2. اختر الدالة setup واضغط «تشغيل»، ثم اسمح بالأذونات
//   3. انسخ «رمز المدير» من سجل التنفيذ
//   4. نشر ← عملية نشر جديدة ← تطبيق ويب ← التنفيذ باسم: أنا ← الوصول: أي شخص
//   5. ضع رابط تطبيق الويب في ملف config.js في الموقع
//
// التحديث إلى إصدار جديد (الرابط لا يتغير):
//   الصق الكود الجديد مكان القديم ← حفظ ← نشر ← إدارة عمليات النشر ← ✏️ ← الإصدار: إصدار جديد ← نشر
//
// البيانات تُحفظ في جدول Google باسم «دروس الموقع» في حسابك،
// والملفات في مجلد «ملفات دروس الموقع» (مشارك للعرض فقط).

var SCHOOL = "متوسطة الشهيد بلعكرمي أعمر";
var TZ = "Africa/Algiers";
var MAX_FILE_MB = 20;
var MAX_FILES = 10;
var MAX_VIDEOS = 10;
var DAILY_UPLOAD_MB = 300;   // حد الرفع اليومي لكل أستاذ، لحماية مساحة Drive
var EXCERPT = 220;           // طول مقتطف الشرح في قائمة الدروس
var CACHE_TTL = 21600;       // 6 ساعات (الحد الأقصى في Google)
var CHUNK = 40000;           // حجم القطعة في الذاكرة المؤقتة (أقل من حد 100KB)

var ALLOWED = {
  "application/pdf": "pdf",
  "image/jpeg": "image", "image/png": "image", "image/webp": "image",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.ms-powerpoint": "slides",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "slides",
  "audio/mpeg": "audio", "audio/mp4": "audio", "audio/x-m4a": "audio", "audio/aac": "audio", "audio/wav": "audio"
};
var SUBJECTS = ["ar", "math", "fr", "en", "sci", "phy", "hist", "isl", "civ", "amz", "art", "mus", "info"];
var L_HEAD = ["id", "date", "year", "subject", "term", "title", "text", "files", "videos", "teacher", "teacherId", "status", "updated"];
var T_HEAD = ["id", "name", "subjects", "code", "role", "active"];
var L_SHEET = "الدروس", T_SHEET = "الأساتذة";

// ---------------- الإعداد ----------------

function setup() {
  var p = PropertiesService.getScriptProperties();
  var ss = null, ssId = p.getProperty("SS");
  if (ssId) { try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create("دروس الموقع - " + SCHOOL); p.setProperty("SS", ss.getId()); }

  var lsh = ss.getSheetByName(L_SHEET) || ss.insertSheet(L_SHEET);
  if (lsh.getLastRow() === 0) lsh.appendRow(L_HEAD);
  var tsh = ss.getSheetByName(T_SHEET) || ss.insertSheet(T_SHEET);
  if (tsh.getLastRow() === 0) tsh.appendRow(T_HEAD);
  ss.getSheets().forEach(function (s) {
    var n = s.getName();
    if (n !== L_SHEET && n !== T_SHEET && s.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(s);
  });

  var folderId = p.getProperty("FOLDER"), folder = null;
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = null; } }
  if (!folder) {
    folder = DriveApp.createFolder("ملفات دروس الموقع - " + SCHOOL);
    p.setProperty("FOLDER", folder.getId());
  }
  try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

  var admin = teachers_().filter(function (t) { return t.role === "admin"; })[0];
  if (!admin) {
    admin = { id: newId_(), name: "مدير الموقع", subjects: "", code: newCode_(), role: "admin", active: true };
    tsh.appendRow([admin.id, admin.name, admin.subjects, admin.code, admin.role, true]);
  }
  rebuild_();
  Logger.log("✅ تم الإعداد.");
  Logger.log("🔑 رمز المدير: " + admin.code);
  Logger.log("📄 جدول البيانات: " + ss.getUrl());
  return admin.code;
}

// تنظيف: يحذف (إلى سلة المهملات) الملفات المرفوعة قبل أكثر من يومين ولم تُستعمل في أي درس.
// شغّلها يدويًا من المحرر مرة كل بضعة أشهر.
function cleanup() {
  var used = {};
  lessons_().forEach(function (l) { if (l.status === "published") l.files.forEach(function (f) { used[f.id] = 1; }); });
  var it = folder_().getFiles(), old = Date.now() - 2 * 864e5, n = 0, checked = 0;
  while (it.hasNext() && checked < 2000) {
    var f = it.next(); checked++;
    if (!used[f.getId()] && f.getDateCreated().getTime() < old) { try { f.setTrashed(true); n++; } catch (e) {} }
  }
  Logger.log("🧹 تم فحص " + checked + " ملف، ونُقل " + n + " ملف غير مستعمل إلى سلة المهملات.");
}

// ---------------- نقاط الوصول ----------------

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.api === "lessons") return json_({ ok: true, v: 2, lessons: publicList_() });
    if (p.api === "lesson") {
      var l = publicLesson_(String(p.id || ""));
      return json_(l ? { ok: true, v: 2, lesson: l } : { ok: false, v: 2, error: "NOT_FOUND" });
    }
  } catch (err) { return json_({ ok: false, error: errCode_(err) }); }
  return HtmlService.createHtmlOutput('<p dir="rtl" style="font:16px sans-serif">خادم دروس ' + SCHOOL + ' يعمل ✓</p>');
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var who = auth_(req.code), out;
    switch (req.action) {
      case "login": out = { name: who.name, role: who.role, subjects: who.subjects }; break;
      case "upload": out = { file: upload_(who, req.file) }; break;
      case "save": out = { id: save_(who, req.lesson) }; break;
      case "mine": out = { lessons: mine_(who) }; break;
      case "delete": del_(who, req.id); out = {}; break;
      case "teachers": admin_(who); out = { teachers: teachers_() }; break;
      case "addTeacher": admin_(who); out = { teacher: addTeacher_(req.name, req.subjects) }; break;
      case "removeTeacher": admin_(who); removeTeacher_(req.id); out = {}; break;
      case "resetCode": admin_(who); out = { code: resetCode_(req.id) }; break;
      default: throw new Error("BAD_ACTION");
    }
    out.ok = true;
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: errCode_(err) });
  }
}

// ---------------- الأساتذة ----------------

function auth_(code) {
  code = String(code || "").trim().toUpperCase();
  if (code.length < 6) throw new Error("AUTH");
  var t = teachers_().filter(function (x) { return x.code === code && x.active; })[0];
  if (!t) throw new Error("AUTH");
  return t;
}
function admin_(who) { if (who.role !== "admin") throw new Error("FORBIDDEN"); }

function teachers_() {
  return rows_(sheet_(T_SHEET), T_HEAD).map(function (r) {
    return { id: String(r.id), name: String(r.name), subjects: String(r.subjects || ""), code: String(r.code).toUpperCase(),
             role: r.role === "admin" ? "admin" : "teacher", active: r.active !== false && String(r.active).toUpperCase() !== "FALSE", _row: r._row };
  });
}

function addTeacher_(name, subjects) {
  name = clean_(name, 60);
  if (name.length < 2) throw new Error("BAD_INPUT");
  subjects = String(subjects || "").split(",").filter(function (s) { return SUBJECTS.indexOf(s) >= 0; }).join(",");
  var lock = lock_();
  try {
    var code = uniqueCode_(teachers_());
    var t = { id: newId_(), name: name, subjects: subjects, code: code, role: "teacher", active: true };
    sheet_(T_SHEET).appendRow([t.id, safe_(t.name), t.subjects, t.code, t.role, true]);
    return t;
  } finally { lock.releaseLock(); }
}

function removeTeacher_(id) {
  var lock = lock_();
  try {
    var t = teachers_().filter(function (x) { return x.id === String(id); })[0];
    if (!t) throw new Error("NOT_FOUND");
    if (t.role === "admin") throw new Error("FORBIDDEN");
    sheet_(T_SHEET).getRange(t._row, T_HEAD.indexOf("active") + 1).setValue(false);
  } finally { lock.releaseLock(); }
}

// رمز جديد لأستاذ (مثلًا إذا ضاع هاتفه). الرمز القديم يتوقف فورًا.
function resetCode_(id) {
  var lock = lock_();
  try {
    var all = teachers_(), t = all.filter(function (x) { return x.id === String(id); })[0];
    if (!t || !t.active) throw new Error("NOT_FOUND");
    if (t.role === "admin") throw new Error("FORBIDDEN");
    var code = uniqueCode_(all);
    sheet_(T_SHEET).getRange(t._row, T_HEAD.indexOf("code") + 1).setValue(code);
    return code;
  } finally { lock.releaseLock(); }
}

// ---------------- الملفات ----------------

function upload_(who, f) {
  if (!f || !f.data || !f.type) throw new Error("BAD_INPUT");
  var kind = ALLOWED[f.type];
  if (!kind) throw new Error("FILE_TYPE");
  var bytes = Utilities.base64Decode(f.data);
  if (bytes.length > MAX_FILE_MB * 1024 * 1024) throw new Error("FILE_SIZE");
  if (who.role !== "admin") quota_(who, bytes.length);
  var name = clean_(f.name, 120) || ("ملف." + kind);
  var file = folder_().createFile(Utilities.newBlob(bytes, f.type, name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  try { file.setDescription("u:" + who.id + " · " + who.name); } catch (e) {}
  return { id: file.getId(), name: name, type: f.type, kind: kind, size: bytes.length };
}

// حد الرفع اليومي لكل أستاذ
function quota_(who, n) {
  var p = PropertiesService.getScriptProperties(), key = "q:" + who.id, today = day_(Date.now());
  var q; try { q = JSON.parse(p.getProperty(key) || "{}"); } catch (e) { q = {}; }
  if (q.d !== today) q = { d: today, b: 0 };
  if (q.b + n > DAILY_UPLOAD_MB * 1024 * 1024) throw new Error("QUOTA");
  q.b += n;
  p.setProperty(key, JSON.stringify(q));
}

function ownFile_(id) {
  try {
    var file = DriveApp.getFileById(String(id)), it = file.getParents(), fid = folder_().getId();
    while (it.hasNext()) if (it.next().getId() === fid) return file;
  } catch (e) {}
  return null;
}
function uploader_(file) {
  var m = String(file.getDescription() || "").match(/^u:([a-z0-9]+)/);
  return m ? m[1] : "";
}

// ---------------- الدروس ----------------

function save_(who, L) {
  if (!L) throw new Error("BAD_INPUT");
  var year = parseInt(L.year, 10), term = parseInt(L.term, 10) || 0;
  var subject = String(L.subject || ""), title = clean_(L.title, 140), text = String(L.text || "").replace(/\r\n/g, "\n").slice(0, 6000).trim();
  if (!(year >= 1 && year <= 4) || SUBJECTS.indexOf(subject) < 0 || term < 0 || term > 3 || !title) throw new Error("BAD_INPUT");

  var videos = (Array.isArray(L.videos) ? L.videos : []).map(function (v) { return String(v || "").trim(); })
    .filter(function (v) { return /^https:\/\/\S+$/i.test(v) && v.length < 500; }).slice(0, MAX_VIDEOS);
  var wanted = (Array.isArray(L.files) ? L.files : []).slice(0, MAX_FILES);
  if (!text && !wanted.length && !videos.length) throw new Error("EMPTY");

  var lock = lock_();
  try {
    var sh = sheet_(L_SHEET), now = Date.now(), all = lessons_(), old = null;
    if (L.id) {
      old = all.filter(function (x) { return x.id === String(L.id) && x.status === "published"; })[0];
      if (!old) throw new Error("NOT_FOUND");
      if (who.role !== "admin" && old.teacherId !== who.id) throw new Error("FORBIDDEN");
    }
    var had = old ? old.files.map(function (f) { return f.id; }) : [];
    // الأستاذ لا يستطيع إرفاق إلا ملفاته هو (أو الملفات الموجودة أصلًا في هذا الدرس)
    var files = wanted.map(function (f) {
      var file = f && ownFile_(f.id);
      if (!file) throw new Error("BAD_FILE");
      var id = String(f.id);
      if (who.role !== "admin" && had.indexOf(id) < 0 && uploader_(file) !== who.id) throw new Error("BAD_FILE");
      return { id: id, name: clean_(f.name, 120), type: String(f.type || ""), kind: ALLOWED[f.type] || "file", size: Number(f.size) || 0 };
    });

    if (old) {
      var keep = files.map(function (f) { return f.id; });
      trashUnused_(old.files.filter(function (f) { return keep.indexOf(f.id) < 0; }), all, old.id);
      sh.getRange(old._row, 1, 1, L_HEAD.length).setValues([[old.id, old.ts || now, year, subject, term, safe_(title), safe_(text),
        JSON.stringify(files), JSON.stringify(videos), safe_(old.teacher), old.teacherId, "published", now]]);
      rebuild_();
      return old.id;
    }
    var id = newId_();
    sh.appendRow([id, now, year, subject, term, safe_(title), safe_(text), JSON.stringify(files), JSON.stringify(videos),
      safe_(who.name), who.id, "published", now]);
    rebuild_();
    return id;
  } finally { lock.releaseLock(); }
}

function del_(who, id) {
  var lock = lock_();
  try {
    var all = lessons_(), l = all.filter(function (x) { return x.id === String(id) && x.status === "published"; })[0];
    if (!l) throw new Error("NOT_FOUND");
    if (who.role !== "admin" && l.teacherId !== who.id) throw new Error("FORBIDDEN");
    sheet_(L_SHEET).getRange(l._row, L_HEAD.indexOf("status") + 1).setValue("deleted");
    trashUnused_(l.files, all, l.id);
    rebuild_();
  } finally { lock.releaseLock(); }
}

// لا يُحذف ملف ما دام درس آخر منشور يستعمله
function trashUnused_(files, all, exceptId) {
  var used = {};
  all.forEach(function (x) { if (x.status === "published" && x.id !== exceptId) x.files.forEach(function (f) { used[f.id] = 1; }); });
  files.forEach(function (f) { if (!used[f.id]) trash_(f.id); });
}

function lessons_() {
  return rows_(sheet_(L_SHEET), L_HEAD).map(function (r) {
    return {
      id: String(r.id), ts: Number(r.date) || 0, date: day_(r.date), year: Number(r.year), subject: String(r.subject), term: Number(r.term) || 0,
      title: String(r.title), text: String(r.text || ""), files: parse_(r.files), videos: parse_(r.videos),
      teacher: String(r.teacher || ""), teacherId: String(r.teacherId || ""), status: String(r.status), _row: r._row
    };
  });
}

function view_(l, withOwner) {
  var o = { id: l.id, ts: l.ts, date: l.date, year: l.year, subject: l.subject, term: l.term, title: l.title, text: l.text,
            files: l.files, videos: l.videos, teacher: l.teacher };
  if (withOwner) o.teacherId = l.teacherId;
  return o;
}

function mine_(who) {
  return lessons_().filter(function (l) { return l.status === "published" && (who.role === "admin" || l.teacherId === who.id); })
    .map(function (l) { return view_(l, true); }).sort(function (a, b) { return b.ts - a.ts; });
}

// ---------------- القراءة العامة (سريعة، من الذاكرة المؤقتة) ----------------
// كل زيارة تلميذ تُقرأ من الذاكرة المؤقتة ولا تلمس الجدول، مهما كثرت الدروس.
// القائمة تحمل مقتطفًا من الشرح فقط، والشرح الكامل يُطلب عند فتح الدرس.

function publicList_() {
  var hit = cacheGet_("list");
  if (hit) { refreshIfOld_(); return JSON.parse(hit); }
  return rebuild_().list;
}

function publicLesson_(id) {
  if (!id) return null;
  var listS = cacheGet_("list"), textS = listS && cacheGet_("texts"), list, texts;
  if (listS && textS) { list = JSON.parse(listS); texts = JSON.parse(textS); }
  else { var b = rebuild_(); list = b.list; texts = b.texts; }
  var l = list.filter(function (x) { return x.id === id; })[0];
  if (!l) return null;
  if (l.more) { l.text = texts[id] || l.text; delete l.more; }
  return l;
}

function rebuild_() {
  var list = [], texts = {};
  lessons_().forEach(function (l) {
    if (l.status !== "published") return;
    var v = view_(l, false);
    if (v.text.length > EXCERPT) { texts[v.id] = v.text; v.text = v.text.slice(0, EXCERPT); v.more = 1; }
    list.push(v);
  });
  list.sort(function (a, b) { return b.ts - a.ts; });
  try {
    cachePut_("texts", JSON.stringify(texts));
    cachePut_("list", JSON.stringify(list));
    CacheService.getScriptCache().put("built", String(Date.now()), CACHE_TTL);
  } catch (e) {}
  return { list: list, texts: texts };
}

// تجديد الذاكرة قبل انتهاء صلاحيتها (6 ساعات)، مرة واحدة فقط وبدون انتظار الآخرين
function refreshIfOld_() {
  var c = CacheService.getScriptCache(), built = Number(c.get("built") || 0);
  if (built && Date.now() - built < 5 * 3600e3) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return;
  try { rebuild_(); } catch (e) {} finally { lock.releaseLock(); }
}

// تخزين نص طويل في عدة قطع (حد Google: 100KB لكل مفتاح)
function cachePut_(key, s) {
  var c = CacheService.getScriptCache(), ver = newId_(), map = {}, n = 0;
  for (var i = 0; i < s.length; i += CHUNK) map[key + ":" + ver + ":" + (n++)] = s.slice(i, i + CHUNK);
  if (n === 0) map[key + ":" + ver + ":" + (n++)] = "";
  c.putAll(map, CACHE_TTL);
  var prev = c.get(key + ":ptr");
  c.put(key + ":ptr", ver + ":" + n, CACHE_TTL);
  if (prev) {
    var pv = prev.split(":"), old = [];
    for (var j = 0; j < Number(pv[1]); j++) old.push(key + ":" + pv[0] + ":" + j);
    try { c.removeAll(old); } catch (e) {}
  }
}
function cacheGet_(key) {
  var c = CacheService.getScriptCache(), ptr = c.get(key + ":ptr");
  if (!ptr) return null;
  var pv = ptr.split(":"), keys = [];
  for (var i = 0; i < Number(pv[1]); i++) keys.push(key + ":" + pv[0] + ":" + i);
  var got = c.getAll(keys), s = "";
  for (var k = 0; k < keys.length; k++) { if (got[keys[k]] == null) return null; s += got[keys[k]]; }
  return s;
}

// ---------------- أدوات ----------------

function sheet_(name) {
  var id = PropertiesService.getScriptProperties().getProperty("SS");
  if (!id) throw new Error("NOT_SETUP");
  var sh = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sh) throw new Error("NOT_SETUP");
  return sh;
}
function folder_() {
  var id = PropertiesService.getScriptProperties().getProperty("FOLDER");
  if (!id) throw new Error("NOT_SETUP");
  return DriveApp.getFolderById(id);
}
function rows_(sh, head) {
  var v = sh.getDataRange().getValues();
  return v.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (k, j) { o[k] = r[j]; });
    return o;
  }).filter(function (o) { return o.id !== "" && o.id != null; });
}
function trash_(id) { var f = ownFile_(id); if (f) try { f.setTrashed(true); } catch (e) {} }
function lock_() { var l = LockService.getScriptLock(); l.waitLock(20000); return l; }
function parse_(s) { try { var v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function day_(v) {
  var d = typeof v === "number" ? new Date(v) : (v instanceof Date ? v : new Date(Number(v) || 0));
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
}
function clean_(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
function safe_(s) { s = String(s == null ? "" : s); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function newId_() { return Date.now().toString(36) + Utilities.getUuid().replace(/-/g, "").slice(0, 6); }
// رمز من 8 أحرف (أكثر من 850 مليار احتمال)، من مولّد عشوائي آمن
function newCode_() {
  var a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = "", hex = "";
  while (s.length < 8) {
    if (hex.length < 2) { var u = Utilities.getUuid().replace(/-/g, ""); hex += u.slice(0, 12) + u.slice(13, 16) + u.slice(17); } // بدون خانات الإصدار الثابتة
    var b = parseInt(hex.slice(0, 2), 16); hex = hex.slice(2);
    if (b < 248) s += a.charAt(b % 31);
  }
  return s.slice(0, 4) + "-" + s.slice(4);
}
function uniqueCode_(all) {
  var used = all.map(function (t) { return t.code; }), code;
  do { code = newCode_(); } while (used.indexOf(code) >= 0);
  return code;
}
function errCode_(err) {
  var m = String((err && err.message) || err);
  return /^[A-Z_]+$/.test(m) ? m : "SERVER";
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---- نهاية الكود ----
