/**
 * خادم فضاء الأساتذة — متوسطة الشهيد بلعكرمي أعمر
 *
 * طريقة التركيب (مرة واحدة):
 *   1. الصق هذا الملف كاملًا في مشروع جديد على script.google.com
 *   2. اختر الدالة setup واضغط «تشغيل»، ثم اسمح بالأذونات
 *   3. انسخ «رمز المدير» من سجل التنفيذ
 *   4. نشر ← عملية نشر جديدة ← تطبيق ويب ← التنفيذ باسم: أنا ← الوصول: أي شخص
 *   5. ضع رابط تطبيق الويب في ملف config.js في الموقع
 *
 * البيانات تُحفظ في جدول Google باسم «دروس الموقع» في حسابك،
 * والملفات في مجلد «ملفات دروس الموقع» (مشارك للعرض فقط).
 */

var SCHOOL = "متوسطة الشهيد بلعكرمي أعمر";
var TZ = "Africa/Algiers";
var MAX_FILE_MB = 20;
var MAX_FILES = 10;
var MAX_VIDEOS = 10;

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

/* ---------------- الإعداد ---------------- */

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
  Logger.log("✅ تم الإعداد.");
  Logger.log("🔑 رمز المدير: " + admin.code);
  Logger.log("📄 جدول البيانات: " + ss.getUrl());
  return admin.code;
}

/* ---------------- نقاط الوصول ---------------- */

function doGet(e) {
  var api = e && e.parameter ? e.parameter.api : "";
  if (api === "lessons") {
    try { return json_({ ok: true, lessons: publicLessons_() }); }
    catch (err) { return json_({ ok: false, error: errCode_(err) }); }
  }
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
      default: throw new Error("BAD_ACTION");
    }
    out.ok = true;
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: errCode_(err) });
  }
}

/* ---------------- الأساتذة ---------------- */

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
    var used = teachers_().map(function (t) { return t.code; }), code;
    do { code = newCode_(); } while (used.indexOf(code) >= 0);
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

/* ---------------- الملفات ---------------- */

function upload_(who, f) {
  if (!f || !f.data || !f.type) throw new Error("BAD_INPUT");
  var kind = ALLOWED[f.type];
  if (!kind) throw new Error("FILE_TYPE");
  var bytes = Utilities.base64Decode(f.data);
  if (bytes.length > MAX_FILE_MB * 1024 * 1024) throw new Error("FILE_SIZE");
  var name = clean_(f.name, 120) || ("ملف." + kind);
  var file = folder_().createFile(Utilities.newBlob(bytes, f.type, name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  try { file.setDescription("رفعه: " + who.name); } catch (e) {}
  return { id: file.getId(), name: name, type: f.type, kind: kind, size: bytes.length };
}

function ownFile_(id) {
  try {
    var file = DriveApp.getFileById(String(id)), it = file.getParents(), fid = folder_().getId();
    while (it.hasNext()) if (it.next().getId() === fid) return file;
  } catch (e) {}
  return null;
}

/* ---------------- الدروس ---------------- */

function save_(who, L) {
  if (!L) throw new Error("BAD_INPUT");
  var year = parseInt(L.year, 10), term = parseInt(L.term, 10) || 0;
  var subject = String(L.subject || ""), title = clean_(L.title, 140), text = String(L.text || "").replace(/\r\n/g, "\n").slice(0, 6000).trim();
  if (!(year >= 1 && year <= 4) || SUBJECTS.indexOf(subject) < 0 || term < 0 || term > 3 || !title) throw new Error("BAD_INPUT");

  var videos = (Array.isArray(L.videos) ? L.videos : []).map(function (v) { return String(v || "").trim(); })
    .filter(function (v) { return /^https:\/\/\S+$/i.test(v) && v.length < 500; }).slice(0, MAX_VIDEOS);
  var files = (Array.isArray(L.files) ? L.files : []).slice(0, MAX_FILES).map(function (f) {
    if (!f || !ownFile_(f.id)) throw new Error("BAD_FILE");
    return { id: String(f.id), name: clean_(f.name, 120), type: String(f.type || ""), kind: ALLOWED[f.type] || "file", size: Number(f.size) || 0 };
  });
  if (!text && !files.length && !videos.length) throw new Error("EMPTY");

  var lock = lock_();
  try {
    var sh = sheet_(L_SHEET), now = Date.now();
    if (L.id) {
      var old = lessons_().filter(function (x) { return x.id === String(L.id) && x.status === "published"; })[0];
      if (!old) throw new Error("NOT_FOUND");
      if (who.role !== "admin" && old.teacherId !== who.id) throw new Error("FORBIDDEN");
      var keep = files.map(function (f) { return f.id; });
      old.files.forEach(function (f) { if (keep.indexOf(f.id) < 0) trash_(f.id); });
      sh.getRange(old._row, 1, 1, L_HEAD.length).setValues([[old.id, old.ts || now, year, subject, term, safe_(title), safe_(text),
        JSON.stringify(files), JSON.stringify(videos), safe_(old.teacher), old.teacherId, "published", now]]);
      bust_();
      return old.id;
    }
    var id = newId_();
    sh.appendRow([id, now, year, subject, term, safe_(title), safe_(text), JSON.stringify(files), JSON.stringify(videos),
      safe_(who.name), who.id, "published", now]);
    bust_();
    return id;
  } finally { lock.releaseLock(); }
}

function del_(who, id) {
  var lock = lock_();
  try {
    var l = lessons_().filter(function (x) { return x.id === String(id) && x.status === "published"; })[0];
    if (!l) throw new Error("NOT_FOUND");
    if (who.role !== "admin" && l.teacherId !== who.id) throw new Error("FORBIDDEN");
    sheet_(L_SHEET).getRange(l._row, L_HEAD.indexOf("status") + 1).setValue("deleted");
    l.files.forEach(function (f) { trash_(f.id); });
    bust_();
  } finally { lock.releaseLock(); }
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

function publicLessons_() {
  var cache = CacheService.getScriptCache(), hit = cache.get("lessons");
  if (hit) return JSON.parse(hit);
  var list = lessons_().filter(function (l) { return l.status === "published"; }).map(function (l) { return view_(l, false); });
  var s = JSON.stringify(list);
  if (s.length < 90000) cache.put("lessons", s, 300);
  return list;
}

function mine_(who) {
  return lessons_().filter(function (l) { return l.status === "published" && (who.role === "admin" || l.teacherId === who.id); })
    .map(function (l) { return view_(l, true); }).sort(function (a, b) { return b.ts - a.ts; });
}

/* ---------------- أدوات ---------------- */

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
function bust_() { try { CacheService.getScriptCache().remove("lessons"); } catch (e) {} }
function lock_() { var l = LockService.getScriptLock(); l.waitLock(20000); return l; }
function parse_(s) { try { var v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function day_(v) {
  var d = typeof v === "number" ? new Date(v) : (v instanceof Date ? v : new Date(Number(v) || 0));
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
}
function clean_(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
function safe_(s) { s = String(s == null ? "" : s); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function newId_() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function newCode_() {
  var a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = "";
  for (var i = 0; i < 8; i++) s += a.charAt(Math.floor(Math.random() * a.length));
  return s.slice(0, 4) + "-" + s.slice(4);
}
function errCode_(err) {
  var m = String((err && err.message) || err);
  return /^[A-Z_]+$/.test(m) ? m : "SERVER";
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
