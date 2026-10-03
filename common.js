/* أدوات مشتركة بين صفحات الموقع */
var D = (function () {
  var SUBJ = [
    {k:"ar",n:"اللغة العربية",g:"ع"},{k:"math",n:"الرياضيات",g:"ر"},{k:"fr",n:"اللغة الفرنسية",g:"Fr"},
    {k:"en",n:"اللغة الإنجليزية",g:"En"},{k:"sci",n:"العلوم الطبيعية",g:"ط"},{k:"phy",n:"العلوم الفيزيائية",g:"ف"},
    {k:"hist",n:"التاريخ والجغرافيا",g:"تج"},{k:"isl",n:"التربية الإسلامية",g:"إ"},{k:"civ",n:"التربية المدنية",g:"م"},
    {k:"amz",n:"اللغة الأمازيغية",g:"ⵣ"},{k:"art",n:"التربية التشكيلية",g:"ت"},{k:"mus",n:"التربية الموسيقية",g:"♪"},
    {k:"info",n:"المعلوماتية",g:"IT"}];
  var YEARS = [{n:1,name:"الأولى متوسط"},{n:2,name:"الثانية متوسط"},{n:3,name:"الثالثة متوسط"},{n:4,name:"الرابعة متوسط"}];
  var TERMS = ["الفصل الأول","الفصل الثاني","الفصل الثالث"];
  var KINDS = {pdf:"PDF",image:"صورة",word:"Word",slides:"عرض",audio:"صوت",file:"ملف"};
  /* نوع المحتوى (خادم الإصدار 3). الدروس القديمة بدون نوع = «درس» */
  var TYPES = [{k:"lesson",n:"درس"},{k:"ex",n:"تمارين"},{k:"devoir",n:"فرض"},{k:"exam",n:"اختبار"},{k:"corr",n:"تصحيح"},{k:"bem",n:"موضوع BEM"},{k:"bemc",n:"تصحيح BEM"}];
  var ERRORS = {
    AUTH: "الرمز غير صحيح أو موقوف. تأكد منه أو اطلبه من مدير الموقع.",
    FORBIDDEN: "هذا الإجراء خاص بصاحب الدرس أو بالمدير.",
    FILE_TYPE: "نوع الملف غير مقبول. المقبول: PDF، صور، Word، PowerPoint، ملفات صوتية.",
    FILE_SIZE: "الملف أكبر من 20 ميغابايت. قسّمه أو ضع الفيديو على YouTube.",
    BAD_FILE: "أحد الملفات لم يعد موجودًا. احذفه من القائمة وأعد رفعه.",
    EMPTY: "أضف شرحًا أو ملفًا أو رابط فيديو على الأقل.",
    BAD_INPUT: "تحقق من الحقول: السنة والمادة والعنوان مطلوبة.",
    NOT_FOUND: "هذا الدرس لم يعد موجودًا.",
    NOT_SETUP: "الخادم لم يُجهَّز بعد. على المدير تشغيل setup مرة واحدة.",
    QUOTA: "بلغت حد الرفع لهذا اليوم (300 م.ب). أكمل غدًا، أو ضع الفيديوهات على YouTube بدل رفعها.",
    NETWORK: "تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.",
    SERVER: "حدث خطأ في الخادم. أعد المحاولة بعد قليل."
  };

  function typeName(k) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].k === k) return TYPES[i].n; return "درس"; }
  function typeOf(l) { var t = l && l.type; for (var i = 0; i < TYPES.length; i++) if (TYPES[i].k === t) return t; return "lesson"; }
  /* ترتيب المقاطع حسب أول رقم فيها: «المقطع 2» قبل «المقطع 10» */
  function unitKey(u) { var m = String(u || "").replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); }).match(/\d+/); return m ? +m[0] : 9999; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function activeNews(list) { var t = today(); return (Array.isArray(list) ? list : []).filter(function (n) { return n && n.title && (!n.until || n.until >= t); }); }
  /* مشاركة رابط: قائمة المشاركة في الهاتف إن وُجدت، وإلا واتساب */
  function waLink(text, url) { return "https://wa.me/?text=" + encodeURIComponent(text + "\n" + url); }
  function share(text, url) {
    if (navigator.share) return navigator.share({ title: text, text: text, url: url }).then(function () { return "shared"; }, function () { return "cancel"; });
    window.open(waLink(text, url), "_blank", "noopener"); return Promise.resolve("wa");
  }
  function siteUrl(path) { return new URL(path || "./", location.href).href; }
  function subj(k) { for (var i = 0; i < SUBJ.length; i++) if (SUBJ[i].k === k) return SUBJ[i]; return null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function fmt(d) { var p = String(d || "").split("-"); return p.length === 3 ? (+p[2]) + "/" + (+p[1]) + "/" + p[0] : ""; }
  function isNew(d) { if (!d) return false; var t = Date.parse(d); return t && (Date.now() - t) < 8 * 864e5 && t <= Date.now() + 864e5; }
  function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " م.ب" : Math.max(1, Math.round(n / 1024)) + " ك.ب"; }
  function errText(e) { return ERRORS[(e && e.code) || "SERVER"] || ERRORS.SERVER; }

  function ytId(u) {
    var m = String(u || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function driveId(u) { var m = String(u || "").match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([A-Za-z0-9_-]{20,})/); return m ? m[1] : null; }
  function filePreview(f) { return "https://drive.google.com/file/d/" + encodeURIComponent(f.id) + "/preview"; }
  function fileDownload(f) { return "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(f.id); }
  function fileImage(f) { return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(f.id) + "&sz=w1600"; }

  function apiOn() { return !!(window.SITE && SITE.apiUrl); }
  function call(payload) {
    return fetch(SITE.apiUrl, { method: "POST", body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); }, function () { var e = new Error("NETWORK"); e.code = "NETWORK"; throw e; })
      .then(function (j) { if (!j || !j.ok) { var e = new Error((j && j.error) || "SERVER"); e.code = (j && j.error) || "SERVER"; throw e; } return j; });
  }
  /* رفع ملف. ملاحظة: لا نتتبّع نسبة التقدّم لأن ذلك يجعل المتصفح يرسل طلب فحص (preflight)
     يرفضه خادم Google، فيفشل الرفع. نستعمل طلبًا بسيطًا (text/plain) يقبله الخادم. */
  function upload(code, file) {
    return new Promise(function (ok, bad) {
      var rd = new FileReader();
      rd.onerror = function () { var e = new Error("FILE"); e.code = "SERVER"; bad(e); };
      rd.onload = function () { ok(String(rd.result).split(",")[1] || ""); };
      rd.readAsDataURL(file);
    }).then(function (b64) {
      return call({ action: "upload", code: code, file: { name: file.name, type: mime(file), data: b64 } });
    }).then(function (j) { return j.file; });
  }
  var EXT = { pdf:"application/pdf", jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp",
    doc:"application/msword", docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt:"application/vnd.ms-powerpoint", pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp3:"audio/mpeg", m4a:"audio/mp4", aac:"audio/aac", wav:"audio/wav" };
  function mime(f) { var e = String(f.name).split(".").pop().toLowerCase(); return EXT[e] || f.type || ""; }

  /* ---- القراءة: محاولات متكررة بفواصل عشوائية + نسخة محفوظة في الهاتف ----
     إذا كان الخادم مشغولًا (زحام)، نعيد المحاولة بعد ثوانٍ عشوائية حتى لا يعود الجميع في اللحظة نفسها،
     ونعرض آخر قائمة محفوظة في هاتف التلميذ خلال ذلك. */
  var CK = "doros-lessons-v1", lastNews = null;
  function news() { if (lastNews) return lastNews; var c = cached(); return c && Array.isArray(c.news) ? c.news : []; }
  function getUrl(q) { return SITE.apiUrl + (SITE.apiUrl.indexOf("?") >= 0 ? "&" : "?") + q + "&t=" + Date.now(); }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function getJson(q, tries) {
    var n = 0;
    function attempt() {
      n++;
      return fetch(getUrl(q)).then(function (r) {
        return r.text().then(function (t) {
          var j; try { j = JSON.parse(t); } catch (e) { j = null; }
          if (!j) {
            /* صفحة «الخادم يعمل» = خادم قديم لا يعرف هذا الطلب. أي صفحة أخرى = زحام أو خطأ مؤقت عند Google */
            var old = /خادم دروس/.test(t), e = new Error(old ? "UNSUPPORTED" : "BUSY"); e.code = e.message; throw e;
          }
          if (!j.ok && j.error === "SERVER") { var x = new Error("BUSY"); x.code = "BUSY"; throw x; }
          return j;
        });
      }).catch(function (e) {
        if (e && e.code === "UNSUPPORTED") throw e;
        if (n >= tries) { var x = new Error("NETWORK"); x.code = "NETWORK"; throw x; }
        return wait((n === 1 ? 1200 : 3500) + Math.random() * 2500).then(attempt);
      });
    }
    return attempt();
  }
  function cached() {
    try { var c = JSON.parse(localStorage.getItem(CK) || "null"); return c && Array.isArray(c.lessons) ? c : null; } catch (e) { return null; }
  }
  /* نسخة حديثة (أقل من دقيقة) تُستعمل مباشرة بدون سؤال الخادم: التلميذ الذي يتنقل بين الصفحات
     لا يكرر الطلب، فتتضاعف قدرة الخادم عند الزحام */
  var FRESH = 60000;
  /* بعد النشر أو التعديل: نجبر الصفحات على طلب القائمة الجديدة */
  function invalidate() { try { var c = cached(); if (c) { c.at = 0; localStorage.setItem(CK, JSON.stringify(c)); } } catch (e) {} }
  function fresh() { var c = cached(); return c && c.at && Date.now() - c.at < FRESH ? c : null; }
  function lessons(force) {
    if (!apiOn()) return Promise.resolve([]);
    var f = !force && fresh();
    if (f) { lastNews = Array.isArray(f.news) ? f.news : []; return Promise.resolve(f.lessons); }
    return getJson("api=lessons", 3).then(function (j) {
      if (!j.ok) { var e = new Error(j.error || "SERVER"); e.code = j.error || "SERVER"; throw e; }
      lastNews = Array.isArray(j.news) ? j.news : null;
      try { localStorage.setItem(CK, JSON.stringify({ at: Date.now(), lessons: j.lessons, news: j.news || [], v: j.v || 1 })); } catch (e) {}
      return j.lessons;
    });
  }
  /* درس واحد بشرحه الكامل (خادم الإصدار 2). إن فشل الطلب لأي سبب — خادم قديم لا يعرفه
     (Google يرسل صفحته بدون إذن قراءة عبر المواقع فيبدو كخطأ شبكة)، أو زحام — نرجع إلى القائمة. */
  function lesson(id) {
    var f = fresh(), hit = f && f.lessons.filter(function (x) { return x.id === id; })[0];
    if (hit && !hit.more) return Promise.resolve(hit);   /* الدرس كامل في النسخة الحديثة */
    function fromList() { return lessons().then(function (L) { return L.filter(function (x) { return x.id === id; })[0] || null; }); }
    return getJson("api=lesson&id=" + encodeURIComponent(id), 1).then(function (j) {
      if (j.ok) return j.lesson;
      if (j.error === "NOT_FOUND" && j.v === undefined) return fromList();
      if (j.error === "NOT_FOUND") return null;
      return fromList();
    }, fromList);
  }

  /* تطبيق قابل للتثبيت: تسجيل عامل الخدمة (يحفظ الصفحات والدروس للعمل بدون إنترنت) */
  var installEvt = null, installCbs = [];
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; installCbs.forEach(function (f) { f(); }); });
  function canInstall() { return !!installEvt; }
  function onInstallable(f) { installCbs.push(f); if (installEvt) f(); }
  function install() { if (!installEvt) return Promise.resolve(false); var e = installEvt; installEvt = null; e.prompt(); return e.userChoice.then(function (c) { return c && c.outcome === "accepted"; }); }
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

  return { SUBJ:SUBJ, YEARS:YEARS, TERMS:TERMS, KINDS:KINDS, TYPES:TYPES, subj:subj, esc:esc, fmt:fmt, isNew:isNew, size:size, errText:errText,
    typeName:typeName, typeOf:typeOf, unitKey:unitKey, today:today, activeNews:activeNews, waLink:waLink, share:share, siteUrl:siteUrl,
    ytId:ytId, driveId:driveId, filePreview:filePreview, fileDownload:fileDownload, fileImage:fileImage,
    apiOn:apiOn, call:call, upload:upload, mime:mime, lessons:lessons, lesson:lesson, cached:cached, news:news, invalidate:invalidate,
    canInstall:canInstall, onInstallable:onInstallable, install:install, standalone:standalone, isIOS:isIOS };
})();
