"use strict";

/**
 * generate-devlog.js
 *
 * Dev Log JSON → 静的 HTML 詳細ページ + sitemap.xml 更新
 *
 * 実行方法: node scripts/generate-devlog.js
 *
 * Generated files:
 *   devlog/log/ja/{id}.html
 *   devlog/log/en/{id}.html
 *   sitemap.xml (既存エントリを保持して DevLog URL を追記)
 *
 * This file is part of the Greybrion Studio static site build.
 */

const fs   = require("fs");
const path = require("path");

const config = require("./config.js");

// ─── 定数 ────────────────────────────────────────────────────────────────────

const ROOT         = path.resolve(__dirname, "..");
const DATA_ROOT    = path.join(ROOT, "data", "devlog");
const CATEGORY_JSON = path.join(DATA_ROOT, "categories.json");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");
const OUTPUT_JA    = path.join(ROOT, config.OUTPUT_DIR_JA);
const OUTPUT_EN    = path.join(ROOT, config.OUTPUT_DIR_EN);
const BASE_URL     = config.SITE_BASE_URL;
const ORG          = config.ORGANIZATION;

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// ─── エラー/警告 収集 ────────────────────────────────────────────────────────

let errors   = [];
let warnings = [];

function addError(msg)   { errors.push("[ERROR] " + msg); }
function addWarning(msg) { warnings.push("[WARN]  " + msg); }

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

/** 本文 {ja|en} を段落 <p> 群へ変換 */
function bodyToHtml(text) {
  if (!text) return "";
  return text
    .split(/\n[ \t]*\n+/)          // 空行で段落分割
    .map(function (para) {
      var trimmed = para.trim();
      if (!trimmed) return "";
      return "<p>" + escapeHtml(trimmed).replace(/\n/g, "<br>") + "</p>";
    })
    .filter(Boolean)
    .join("\n        ");
}

/** meta description 生成（改行除去・指定文字数で切り詰め） */
function makeDescription(text, maxLen) {
  if (!text) return "";
  var flat = text.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (flat.length <= maxLen) return flat;
  // 英語は単語途中で切らない
  var cut = flat.slice(0, maxLen);
  var lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.75) cut = cut.slice(0, lastSpace);
  return cut + "…";
}

/** image URL/パスが安全か検証 */
function isSafeImagePath(val) {
  if (!val || typeof val !== "string") return false;
  var trimmed = val.trim();
  if (!trimmed) return false;
  // 相対パスは許可
  if (!trimmed.includes(":")) return true;
  // 絶対 URL はプロトコルチェック
  try {
    var u = new URL(trimmed);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch (_) {
    return false;
  }
}

/** 相対パスを絶対 URL へ変換（画像パス用） */
function resolveImageUrl(imgPath) {
  if (!imgPath) return null;
  if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
    return imgPath;
  }
  // "../assets/..." のような相対パスをルート相対に変換
  var cleaned = imgPath.replace(/^\.\.\//, "");
  return BASE_URL + "/" + cleaned;
}

/** JSON ファイルを安全に読み込む */
function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    addError("File not found: " + filePath);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    addError("JSON parse error in " + filePath + ": " + e.message);
    return null;
  }
}

// ─── JSON 読み込み & バリデーション ─────────────────────────────────────────

function loadAllLogs() {
  var catData = readJson(CATEGORY_JSON);
  if (!catData) return null;
  if (!Array.isArray(catData.categories)) {
    addError("categories.json: 'categories' is not an array");
    return null;
  }

  var allLogs = []; // { log, categoryName, tabName }

  catData.categories.forEach(function (cat) {
    var catNameJa = (cat.name && cat.name.ja) || cat.id || "Unknown";

    if (cat.hasTabs) {
      if (!cat.tabsFile) {
        addError("Category '" + cat.id + "': hasTabs=true but tabsFile is missing");
        return;
      }
      var tabsPath = path.join(DATA_ROOT, cat.tabsFile);
      var tabsData = readJson(tabsPath);
      if (!tabsData) return;

      if (!Array.isArray(tabsData.tabs)) {
        addError(cat.tabsFile + ": 'tabs' is not an array");
        return;
      }

      tabsData.tabs.forEach(function (tab) {
        if (!tab.logFile) {
          addError("Tab '" + tab.id + "' in " + cat.tabsFile + ": logFile is missing");
          return;
        }
        var logPath = path.join(DATA_ROOT, tab.logFile);
        var logData = readJson(logPath);
        if (!logData) return;
        if (!Array.isArray(logData.logs)) {
          addError(tab.logFile + ": 'logs' is not an array");
          return;
        }
        var tabNameJa = (tab.name && tab.name.ja) || tab.id || "Unknown";
        logData.logs.forEach(function (log) {
          allLogs.push({ log: log, categoryName: catNameJa, tabName: tabNameJa });
        });
      });

    } else {
      if (!cat.logFile) {
        addError("Category '" + cat.id + "': hasTabs=false but logFile is missing");
        return;
      }
      var logPath2 = path.join(DATA_ROOT, cat.logFile);
      var logData2 = readJson(logPath2);
      if (!logData2) return;
      if (!Array.isArray(logData2.logs)) {
        addError(cat.logFile + ": 'logs' is not an array");
        return;
      }
      logData2.logs.forEach(function (log) {
        allLogs.push({ log: log, categoryName: catNameJa, tabName: null });
      });
    }
  });

  return allLogs;
}

function validateLogs(allLogs) {
  var seenIds = new Set();

  allLogs.forEach(function (entry) {
    var log = entry.log;
    var prefix = "Log";

    // id
    if (!log.id) {
      addError(prefix + ": id is missing or empty");
    } else if (!ID_PATTERN.test(log.id)) {
      addError("Log id '" + log.id + "': contains invalid characters (allowed: [a-zA-Z0-9_-])");
    } else if (seenIds.has(log.id)) {
      addError("Log id '" + log.id + "': duplicate id detected");
    } else {
      seenIds.add(log.id);
    }

    prefix = "Log '" + (log.id || "?") + "'";

    // date
    if (!log.date || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) {
      addError(prefix + ": date is missing or invalid (expected YYYY-MM-DD), got: " + log.date);
    }

    // title.ja (必須)
    if (!log.title || !log.title.ja || !log.title.ja.trim()) {
      addError(prefix + ": title.ja is empty or missing");
    }

    // body.ja (必須)
    if (!log.body || !log.body.ja || !log.body.ja.trim()) {
      addError(prefix + ": body.ja is empty or missing");
    }

    // title.en (Warning)
    if (!log.title || !log.title.en || !log.title.en.trim()) {
      addWarning(prefix + ": title.en is empty — falling back to title.ja");
    }

    // body.en (Warning)
    if (!log.body || !log.body.en || !log.body.en.trim()) {
      addWarning(prefix + ": body.en is empty — falling back to body.ja");
    }

    // tags (Warning)
    if (!Array.isArray(log.tags) || log.tags.length === 0) {
      addWarning(prefix + ": tags array is empty");
    }

    // image (Warning if path is unsafe)
    if (log.image !== null && log.image !== undefined && log.image !== "") {
      if (!isSafeImagePath(log.image)) {
        addWarning(prefix + ": image path is invalid or uses unsafe protocol — skipping: " + log.image);
      }
    }
  });
}

// ─── HTML テンプレート ────────────────────────────────────────────────────────

function buildDetailPage(opts) {
  var lang       = opts.lang;        // "ja" | "en"
  var log        = opts.log;
  var catName    = opts.catName;
  var tabName    = opts.tabName || null;   // タブ名（ツール開発/Unity等）
  var jaUrl      = opts.jaUrl;
  var enUrl      = opts.enUrl;

  var isJa = lang === "ja";

  var titleText = (isJa
    ? (log.title.ja || log.title.en || "")
    : (log.title.en || log.title.ja || ""));

  var bodyText  = (isJa
    ? (log.body.ja || log.body.en || "")
    : (log.body.en || log.body.ja || ""));

  var pageTitle   = escapeAttr(titleText) + " | Greybrion Studio Dev Log";
  var maxDesc     = isJa ? 120 : 160;
  var descText    = makeDescription(bodyText, maxDesc);
  var pageDesc    = escapeAttr(descText);
  var canonicalUrl = isJa ? jaUrl : enUrl;
  var ogLocale    = isJa ? "ja_JP" : "en_US";
  var bodyHtml    = bodyToHtml(bodyText);
  var dateStr     = escapeHtml(log.date || "");
  var h1Text      = escapeHtml(titleText);
  var catDisplay  = escapeHtml(catName);
  // タブ名があればパンくずに追加（例: ツール開発 › Manual Grid Authoring Tool）
  var tabDisplay  = tabName ? escapeHtml(tabName) : "";
  var backLabel   = isJa ? "← Dev Log 一覧へ" : "← Back to Dev Log";
  var altLangLabel = isJa ? "English" : "日本語";
  var altLangUrl  = isJa ? enUrl : jaUrl;

  // OGP image
  var ogImageTag = "";
  if (log.image && isSafeImagePath(log.image)) {
    var imgAbsUrl = resolveImageUrl(log.image);
    if (imgAbsUrl) {
      ogImageTag = '  <meta property="og:image" content="' + escapeAttr(imgAbsUrl) + '">\n';
    }
  }

  // JSON-LD image
  var jsonldImage = "";
  if (log.image && isSafeImagePath(log.image)) {
    var imgAbsUrlLd = resolveImageUrl(log.image);
    if (imgAbsUrlLd) {
      jsonldImage = ',\n    "image": "' + imgAbsUrlLd.replace(/"/g, '\\"') + '"';
    }
  }

  // tags
  var tagsHtml = "";
  if (Array.isArray(log.tags) && log.tags.length > 0) {
    tagsHtml = "        <ul class=\"dls-tags\" aria-label=\"tags\">\n";
    log.tags.forEach(function (tag) {
      tagsHtml += "          <li class=\"dls-tag\">" + escapeHtml(tag) + "</li>\n";
    });
    tagsHtml += "        </ul>";
  }

  // breadcrumb
  var breadcrumbJa = isJa
    ? "Development Log > " + escapeHtml(catName)
    : "Development Log > " + escapeHtml(catName);

  // JSON-LD
  var jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": titleText,
    "datePublished": log.date || "",
    "description": descText,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "author": {
      "@type": "Organization",
      "name": ORG.name,
      "url": ORG.url
    },
    "publisher": {
      "@type": "Organization",
      "name": ORG.name,
      "url": ORG.url
    }
  }, null, 2);

  // image を JSON-LD に追加（JSON.stringify 後に安全挿入）
  if (log.image && isSafeImagePath(log.image)) {
    var imgAbsUrlLd2 = resolveImageUrl(log.image);
    if (imgAbsUrlLd2) {
      var parsed = JSON.parse(jsonLd);
      parsed["image"] = imgAbsUrlLd2;
      jsonLd = JSON.stringify(parsed, null, 2);
    }
  }

  return (
"<!--\n" +
"  Generated from Dev Log JSON.\n" +
"  Do not edit this file manually.\n" +
"  Source: data/devlog/**/*.json\n" +
"  Regenerate: node scripts/generate-devlog.js\n" +
"-->\n" +
"<!DOCTYPE html>\n" +
'<html lang="' + lang + '">\n' +
"<head>\n" +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>' + pageTitle + "</title>\n" +
'  <meta name="description" content="' + pageDesc + '">\n' +
"\n" +
"  <!-- canonical -->\n" +
'  <link rel="canonical" href="' + escapeAttr(canonicalUrl) + '">\n' +
"\n" +
"  <!-- hreflang -->\n" +
'  <link rel="alternate" hreflang="ja" href="' + escapeAttr(jaUrl) + '">\n' +
'  <link rel="alternate" hreflang="en" href="' + escapeAttr(enUrl) + '">\n' +
'  <link rel="alternate" hreflang="x-default" href="' + escapeAttr(jaUrl) + '">\n' +
"\n" +
"  <!-- Open Graph -->\n" +
'  <meta property="og:type"        content="article">\n' +
'  <meta property="og:title"       content="' + pageTitle + '">\n' +
'  <meta property="og:description" content="' + pageDesc + '">\n' +
'  <meta property="og:url"         content="' + escapeAttr(canonicalUrl) + '">\n' +
'  <meta property="og:site_name"   content="Greybrion Studio">\n' +
'  <meta property="og:locale"      content="' + ogLocale + '">\n' +
ogImageTag +
"\n" +
"  <!-- JSON-LD -->\n" +
'  <script type="application/ld+json">\n' +
jsonLd + "\n" +
"  </script>\n" +
"\n" +
"  <!-- Fonts -->\n" +
'  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet">\n' +
"\n" +
'  <link rel="icon" href="' + BASE_URL + '/favicon.ico" type="image/x-icon">\n' +
'  <link rel="stylesheet" href="' + BASE_URL + '/css/style.css">\n' +
'  <link rel="stylesheet" href="' + BASE_URL + '/css/devlog-static.css">\n' +
"</head>\n" +
"<body class=\"dls-body\">\n" +
"\n" +
"  <!-- ナビゲーション -->\n" +
"  <header class=\"dls-header\">\n" +
'    <a class="dls-site-title" href="' + BASE_URL + '/">Greybrion Studio</a>\n' +
"    <nav class=\"dls-header-nav\" aria-label=\"site navigation\">\n" +
'      <a href="' + BASE_URL + '/devlog/index.html">Dev Log</a>\n' +
'      <a href="' + BASE_URL + '/works/manual-grid-authoring-tool.html">Works</a>\n' +
"    </nav>\n" +
"  </header>\n" +
"\n" +
"  <main class=\"dls-main\">\n" +
"\n" +
"    <!-- パンくず -->\n" +
"    <nav class=\"dls-breadcrumb\" aria-label=\"breadcrumb\">\n" +
'      <a href="' + BASE_URL + '/devlog/index.html">Dev Log</a>\n' +
"      <span aria-hidden=\"true\">›</span>\n" +
'      <span>' + catDisplay + "</span>\n" +
(tabDisplay
  ? "      <span aria-hidden=\"true\">›</span>\n" +
    '      <span>' + tabDisplay + "</span>\n"
  : "") +
"    </nav>\n" +
"\n" +
"    <article class=\"dls-article\">\n" +
'      <time class="dls-date" datetime="' + escapeAttr(log.date || "") + '">' + dateStr + "</time>\n" +
'      <h1 class="dls-title">' + h1Text + "</h1>\n" +
"\n" +
"      <div class=\"dls-body\">\n" +
"        " + bodyHtml + "\n" +
"      </div>\n" +
"\n" +
(tagsHtml ? tagsHtml + "\n\n" : "") +
"    </article>\n" +
"\n" +
"    <!-- ページ下部ナビ -->\n" +
"    <nav class=\"dls-page-nav\" aria-label=\"page navigation\">\n" +
'      <a class="dls-back-link" href="' + BASE_URL + '/devlog/index.html">' + backLabel + "</a>\n" +
'      <a class="dls-lang-link" href="' + escapeAttr(altLangUrl) + '">' + altLangLabel + "</a>\n" +
"    </nav>\n" +
"\n" +
"  </main>\n" +
"\n" +
"</body>\n" +
"</html>\n"
  );
}

// ─── Archive ページ生成 ───────────────────────────────────────────────────────

/**
 * カテゴリ構造を保持した索引データを構築する。
 * allEntries を categories.json の順序で整理し直す。
 * 各カテゴリ内は日付降順。
 */
function buildArchiveIndex(allEntries) {
  // カテゴリ → タブ → ログ の順序を categories.json の順で再現
  var catData = readJson(CATEGORY_JSON);
  if (!catData) return [];

  var result = []; // [{ catName, tabs: [{ tabName, logs: [...] }] }]

  catData.categories.forEach(function (cat) {
    var catNameJa = (cat.name && cat.name.ja) || cat.id || "Unknown";
    var catNameEn = (cat.name && cat.name.en) || catNameJa;

    var tabs = [];

    if (cat.hasTabs) {
      var tabsPath = path.join(DATA_ROOT, cat.tabsFile);
      var tabsData = readJson(tabsPath);
      if (!tabsData || !Array.isArray(tabsData.tabs)) return;

      tabsData.tabs.forEach(function (tab) {
        var tabNameJa = (tab.name && tab.name.ja) || tab.id || "Unknown";
        var tabNameEn = (tab.name && tab.name.en) || tabNameJa;
        // allEntries からこのタブのログを抽出（tabName が一致するもの）
        var tabLogs = allEntries
          .filter(function (e) { return e.tabName === tabNameJa; })
          .sort(function (a, b) {
            return (b.log.date || "").localeCompare(a.log.date || "");
          });
        tabs.push({ tabNameJa: tabNameJa, tabNameEn: tabNameEn, logs: tabLogs });
      });

    } else {
      // タブなし → カテゴリ直下のログ
      var directLogs = allEntries
        .filter(function (e) { return e.categoryName === catNameJa && !e.tabName; })
        .sort(function (a, b) {
          return (b.log.date || "").localeCompare(a.log.date || "");
        });
      // タブなしカテゴリは tabName=null のまま1タブとして表現
      tabs.push({ tabNameJa: null, tabNameEn: null, logs: directLogs });
    }

    result.push({
      catNameJa: catNameJa,
      catNameEn: catNameEn,
      tabs: tabs
    });
  });

  return result;
}

/**
 * archive.html の HTML 文字列を生成する。
 */
function buildArchivePage(archiveIndex) {
  var archiveUrl    = BASE_URL + "/devlog/archive.html";
  var indexUrl      = BASE_URL + "/devlog/index.html";
  var pageDesc      = "Greybrion Studio Development Log の全ログ索引。" +
                      "AscenderAI・ゲーム開発・ツール開発のすべてのログに直接アクセスできます。";
  var pageDescEn    = "Full archive of Greybrion Studio Development Log. " +
                      "Access all logs for AscenderAI, game development, and tool development.";

  // カテゴリ別セクション HTML を構築
  var sectionsHtml = "";
  var totalLogs    = 0;

  archiveIndex.forEach(function (cat) {
    var catSection = "";

    cat.tabs.forEach(function (tab) {
      if (!tab.logs.length) return;

      var listItems = "";
      tab.logs.forEach(function (entry) {
        var log    = entry.log;
        var id     = log.id;
        var date   = escapeHtml(log.date || "");
        var titleJa = escapeHtml((log.title && log.title.ja) || "");
        var titleEn = escapeHtml((log.title && log.title.en) || titleJa);
        var jaHref  = "log/ja/" + id + ".html";
        var enHref  = "log/en/" + id + ".html";

        // タグ（任意表示）
        var tagsStr = "";
        if (Array.isArray(log.tags) && log.tags.length > 0) {
          tagsStr = log.tags.map(function (t) {
            return '<span class="dla-tag">' + escapeHtml(t) + "</span>";
          }).join(" ");
        }

        listItems +=
          "        <li class=\"dla-item\">\n" +
          "          <time class=\"dla-date\" datetime=\"" + escapeAttr(log.date || "") + "\">" + date + "</time>\n" +
          "          <div class=\"dla-links\">\n" +
          "            <a class=\"dla-link-ja\" href=\"" + escapeAttr(jaHref) + "\">" + titleJa + "</a>\n" +
          "            <a class=\"dla-link-en\" href=\"" + escapeAttr(enHref) + "\" lang=\"en\" hreflang=\"en\">English</a>\n" +
          "          </div>\n" +
          (tagsStr ? "          <div class=\"dla-tags\">" + tagsStr + "</div>\n" : "") +
          "        </li>\n";

        totalLogs++;
      });

      if (tab.tabNameJa) {
        catSection +=
          "      <section class=\"dla-tab-section\">\n" +
          "        <h3 class=\"dla-tab-name\">" + escapeHtml(tab.tabNameJa) + "</h3>\n" +
          "        <ul class=\"dla-list\">\n" +
          listItems +
          "        </ul>\n" +
          "      </section>\n";
      } else {
        catSection +=
          "      <ul class=\"dla-list\">\n" +
          listItems +
          "      </ul>\n";
      }
    });

    if (!catSection) return;

    sectionsHtml +=
      "    <section class=\"dla-category-section\">\n" +
      "      <h2 class=\"dla-category-name\">" + escapeHtml(cat.catNameJa) + "</h2>\n" +
      catSection +
      "    </section>\n\n";
  });

  // JSON-LD ItemList
  var itemListElements = [];
  var pos = 1;
  archiveIndex.forEach(function (cat) {
    cat.tabs.forEach(function (tab) {
      tab.logs.forEach(function (entry) {
        var log = entry.log;
        itemListElements.push({
          "@type": "ListItem",
          "position": pos++,
          "url": BASE_URL + "/devlog/log/ja/" + log.id + ".html",
          "name": (log.title && log.title.ja) || log.id
        });
      });
    });
  });

  var jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Development Log Archive — Greybrion Studio",
    "description": pageDesc,
    "url": archiveUrl,
    "isPartOf": {
      "@type": "Blog",
      "url": indexUrl,
      "name": "Greybrion Studio Development Log"
    },
    "publisher": {
      "@type": "Organization",
      "name": ORG.name,
      "url": ORG.url
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": itemListElements.length,
      "itemListElement": itemListElements
    }
  }, null, 2);

  return (
"<!--\n" +
"  Generated from Dev Log JSON.\n" +
"  Do not edit this file manually.\n" +
"  Source: data/devlog/**/*.json\n" +
"  Regenerate: node scripts/generate-devlog.js\n" +
"-->\n" +
"<!DOCTYPE html>\n" +
'<html lang="ja">\n' +
"<head>\n" +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>Development Log Archive | Greybrion Studio</title>\n' +
'  <meta name="description" content="' + escapeAttr(pageDesc) + '">\n' +
"\n" +
"  <!-- canonical -->\n" +
'  <link rel="canonical" href="' + escapeAttr(archiveUrl) + '">\n' +
"\n" +
"  <!-- Open Graph -->\n" +
'  <meta property="og:type"        content="website">\n' +
'  <meta property="og:title"       content="Development Log Archive | Greybrion Studio">\n' +
'  <meta property="og:description" content="' + escapeAttr(pageDesc) + '">\n' +
'  <meta property="og:url"         content="' + escapeAttr(archiveUrl) + '">\n' +
'  <meta property="og:site_name"   content="Greybrion Studio">\n' +
'  <meta property="og:locale"      content="ja_JP">\n' +
"\n" +
"  <!-- JSON-LD -->\n" +
'  <script type="application/ld+json">\n' +
jsonLd + "\n" +
"  </script>\n" +
"\n" +
"  <!-- Fonts -->\n" +
'  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet">\n' +
"\n" +
'  <link rel="icon" href="' + BASE_URL + '/favicon.ico" type="image/x-icon">\n' +
'  <link rel="stylesheet" href="' + BASE_URL + '/css/style.css">\n' +
'  <link rel="stylesheet" href="' + BASE_URL + '/css/devlog-static.css">\n' +
"</head>\n" +
"<body class=\"dls-body\">\n" +
"\n" +
"  <header class=\"dls-header\">\n" +
'    <a class="dls-site-title" href="' + BASE_URL + '/">Greybrion Studio</a>\n' +
"    <nav class=\"dls-header-nav\" aria-label=\"site navigation\">\n" +
'      <a href="' + BASE_URL + '/devlog/index.html">Dev Log</a>\n' +
'      <a href="' + BASE_URL + '/works/manual-grid-authoring-tool.html">Works</a>\n' +
"    </nav>\n" +
"  </header>\n" +
"\n" +
"  <main class=\"dls-main\">\n" +
"\n" +
"    <nav class=\"dls-breadcrumb\" aria-label=\"breadcrumb\">\n" +
'      <a href="' + BASE_URL + '/devlog/index.html">Dev Log</a>\n' +
"      <span aria-hidden=\"true\">›</span>\n" +
"      <span>Archive</span>\n" +
"    </nav>\n" +
"\n" +
"    <section class=\"dla-archive\">\n" +
"      <h1 class=\"dla-heading\">Development Log Archive</h1>\n" +
'      <p class="dla-desc">全 ' + totalLogs + ' 件のDev Logを掲載しています。' +
         'タイトルをクリックすると詳細ページを読めます。</p>\n' +
"\n" +
sectionsHtml +
"    </section>\n" +
"\n" +
"    <nav class=\"dls-page-nav\" aria-label=\"page navigation\">\n" +
'      <a class="dls-back-link" href="' + BASE_URL + '/devlog/index.html">← Dev Log 一覧へ</a>\n' +
"    </nav>\n" +
"\n" +
"  </main>\n" +
"\n" +
"</body>\n" +
"</html>\n"
  );
}

/**
 * archive.html を生成して書き出す。
 * 戻り値: { filePath, totalLogs }
 */
function generateArchive(allEntries) {
  var archiveIndex = buildArchiveIndex(allEntries);
  var html         = buildArchivePage(archiveIndex);
  var filePath     = path.join(ROOT, "devlog", "archive.html");
  return { filePath: filePath, content: html, archiveIndex: archiveIndex };
}



/**
 * 既存 sitemap.xml を読んで非 DevLog エントリを保持し、
 * DevLog エントリを全件再構築して書き出す。
 */
function updateSitemap(allLogs) {
  // 既存 sitemap から非 DevLog <url> ブロックを抽出
  var existingXml = fs.existsSync(SITEMAP_PATH)
    ? fs.readFileSync(SITEMAP_PATH, "utf8")
    : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>';

  // <url>...</url> ブロックを分解（改行付き）
  var urlBlockRegex = /\s*<url>[\s\S]*?<\/url>/g;
  var blocks = existingXml.match(urlBlockRegex) || [];

  // devlog 関連ではないブロックだけ保持
  var nonDevlogBlocks = blocks.filter(function (block) {
    return !block.includes("/devlog/");
  });

  // devlog/index.html エントリ
  var allDates = allLogs
    .map(function (e) { return (e.log.date || ""); })
    .filter(Boolean)
    .sort();
  var latestDate = allDates.length ? allDates[allDates.length - 1] : "";

  var devlogBlocks = [];
  devlogBlocks.push(
    "\n  <url>" +
    "\n    <loc>" + BASE_URL + "/devlog/index.html</loc>" +
    (latestDate ? "\n    <lastmod>" + latestDate + "</lastmod>" : "") +
    "\n    <changefreq>" + config.SITEMAP.devlogIndex.changefreq + "</changefreq>" +
    "\n    <priority>"   + config.SITEMAP.devlogIndex.priority   + "</priority>" +
    "\n  </url>"
  );

  // devlog/archive.html エントリ
  devlogBlocks.push(
    "\n  <url>" +
    "\n    <loc>" + BASE_URL + "/devlog/archive.html</loc>" +
    (latestDate ? "\n    <lastmod>" + latestDate + "</lastmod>" : "") +
    "\n    <changefreq>" + config.SITEMAP.devlogIndex.changefreq + "</changefreq>" +
    "\n    <priority>0.7</priority>" +
    "\n  </url>"
  );

  // 日付降順で各ログの ja/en ページ
  var sorted = allLogs.slice().sort(function (a, b) {
    return (b.log.date || "").localeCompare(a.log.date || "");
  });

  sorted.forEach(function (entry) {
    var log = entry.log;
    var lastmod = (log.lastUpdated || log.date || "");
    ["ja", "en"].forEach(function (lang) {
      var loc = BASE_URL + "/devlog/log/" + lang + "/" + log.id + ".html";
      devlogBlocks.push(
        "\n  <url>" +
        "\n    <loc>" + loc + "</loc>" +
        (lastmod ? "\n    <lastmod>" + lastmod + "</lastmod>" : "") +
        "\n    <changefreq>" + config.SITEMAP.logDetail.changefreq + "</changefreq>" +
        "\n    <priority>"   + config.SITEMAP.logDetail.priority   + "</priority>" +
        "\n  </url>"
      );
    });
  });

  var allBlocks = nonDevlogBlocks.concat(devlogBlocks);
  var newXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    allBlocks.join("") +
    "\n</urlset>\n";

  fs.writeFileSync(SITEMAP_PATH, newXml, "utf8");
  return devlogBlocks.length;  // devlog エントリ追加数
}

// ─── メイン ───────────────────────────────────────────────────────────────────

function main() {
  console.log("=== Greybrion Studio Dev Log Static Generator ===\n");

  // 1. JSON 読み込み
  console.log("Loading Dev Log JSON...");
  var allEntries = loadAllLogs();
  if (allEntries === null || errors.length > 0) {
    console.error("\n--- ERRORS (load phase) ---");
    errors.forEach(function (e) { console.error(e); });
    console.error("\nGeneration aborted due to errors.");
    process.exit(1);
  }
  console.log("  Loaded " + allEntries.length + " log entries.\n");

  // 2. バリデーション
  console.log("Validating...");
  validateLogs(allEntries);

  if (errors.length > 0) {
    console.error("\n--- ERRORS ---");
    errors.forEach(function (e) { console.error(e); });
    console.error("\nGeneration aborted due to validation errors.");
    process.exit(1);
  }
  console.log("  Validation passed.\n");

  // 3. 出力ディレクトリ準備
  [OUTPUT_JA, OUTPUT_EN].forEach(function (dir) {
    fs.mkdirSync(dir, { recursive: true });
  });

  // 4. HTML 生成（一時バッファ方式: 全件生成してからファイル書き出し）
  console.log("Generating HTML...");
  var generatedJa = [];
  var generatedEn = [];
  var htmlBuffer  = []; // { filePath, content }

  allEntries.forEach(function (entry) {
    var log     = entry.log;
    var id      = log.id;
    var jaUrl   = BASE_URL + "/devlog/log/ja/" + id + ".html";
    var enUrl   = BASE_URL + "/devlog/log/en/" + id + ".html";
    var catName = entry.categoryName;
    var tabName = entry.tabName || null;

    // 日本語
    var jaHtml = buildDetailPage({
      lang: "ja", log: log, catName: catName, tabName: tabName, jaUrl: jaUrl, enUrl: enUrl
    });
    htmlBuffer.push({ filePath: path.join(OUTPUT_JA, id + ".html"), content: jaHtml });
    generatedJa.push(id);

    // 英語
    var enHtml = buildDetailPage({
      lang: "en", log: log, catName: catName, tabName: tabName, jaUrl: jaUrl, enUrl: enUrl
    });
    htmlBuffer.push({ filePath: path.join(OUTPUT_EN, id + ".html"), content: enHtml });
    generatedEn.push(id);
  });

  // 全件バッファ完了 → ファイル書き出し
  htmlBuffer.forEach(function (item) {
    fs.writeFileSync(item.filePath, item.content, "utf8");
  });
  console.log("  ja: " + generatedJa.length + " files");
  console.log("  en: " + generatedEn.length + " files\n");

  // 5. Archive 索引ページ生成
  console.log("Generating archive.html...");
  var archiveResult = generateArchive(allEntries);
  htmlBuffer.push({ filePath: archiveResult.filePath, content: archiveResult.content });
  fs.writeFileSync(archiveResult.filePath, archiveResult.content, "utf8");
  // archive 内の総ログ数をカウント
  var archiveTotalLogs = allEntries.length;
  console.log("  archive.html: " + archiveTotalLogs + " logs indexed\n");

  // 6. sitemap 更新
  console.log("Updating sitemap.xml...");
  var addedCount = updateSitemap(allEntries);
  console.log("  Added " + addedCount + " DevLog entries to sitemap.\n");

  // 6. warnings 出力
  if (warnings.length > 0) {
    console.log("--- WARNINGS (" + warnings.length + ") ---");
    warnings.forEach(function (w) { console.log(w); });
    console.log("");
  }

  // 7. サマリ
  console.log("=== Summary ===");
  console.log("  Logs loaded       : " + allEntries.length);
  console.log("  JA pages generated: " + generatedJa.length);
  console.log("  EN pages generated: " + generatedEn.length);
  console.log("  Archive logs      : " + archiveTotalLogs);
  console.log("  Warnings          : " + warnings.length);
  console.log("  Errors            : 0");
  console.log("\nDone.");
}

main();
