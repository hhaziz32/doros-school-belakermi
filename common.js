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
    NETWORK: "تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.",
    SERVER: "حدث خطأ في الخادم. أعد المحاولة بعد قليل."
  };

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
  /* رفع ملف مع نسبة التقدّم */
  function upload(code, file, onProgress) {
    return new Promise(function (ok, bad) {
      var rd = new FileReader();
      rd.onerror = function () { var e = new Error("FILE"); e.code = "SERVER"; bad(e); };
      rd.onload = function () {
        var b64 = String(rd.result).split(",")[1] || "";
        var x = new XMLHttpRequest(); x.open("POST", SITE.apiUrl);
        x.upload.onprogress = function (ev) { if (ev.lengthComputable && onProgress) onProgress(ev.loaded / ev.total); };
        x.onload = function () { var j; try { j = JSON.parse(x.responseText); } catch (e) { j = null; }
          if (j && j.ok) ok(j.file); else { var e = new Error((j && j.error) || "SERVER"); e.code = (j && j.error) || "SERVER"; bad(e); } };
        x.onerror = function () { var e = new Error("NETWORK"); e.code = "NETWORK"; bad(e); };
        x.send(JSON.stringify({ action: "upload", code: code, file: { name: file.name, type: mime(file), data: b64 } }));
      };
      rd.readAsDataURL(file);
    });
  }
  var EXT = { pdf:"application/pdf", jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp",
    doc:"application/msword", docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt:"application/vnd.ms-powerpoint", pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mp3:"audio/mpeg", m4a:"audio/mp4", aac:"audio/aac", wav:"audio/wav" };
  function mime(f) { var e = String(f.name).split(".").pop().toLowerCase(); return EXT[e] || f.type || ""; }

  function lessons() {
    if (!apiOn()) return Promise.resolve([]);
    var u = SITE.apiUrl + (SITE.apiUrl.indexOf("?") >= 0 ? "&" : "?") + "api=lessons&t=" + Date.now();
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j.lessons : []; });
  }

  return { SUBJ:SUBJ, YEARS:YEARS, TERMS:TERMS, KINDS:KINDS, subj:subj, esc:esc, fmt:fmt, isNew:isNew, size:size, errText:errText,
    ytId:ytId, driveId:driveId, filePreview:filePreview, fileDownload:fileDownload, fileImage:fileImage,
    apiOn:apiOn, call:call, upload:upload, mime:mime, lessons:lessons };
})();
