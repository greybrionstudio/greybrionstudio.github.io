/**
 * Development Log - データ駆動UIコントローラ
 * カテゴリ・サブタブ・ログすべてをJSONから生成する。
 * JavaScript内にカテゴリ名・タブ名・ログタイトル等を固定実装しない。
 */

(function () {
  "use strict";

  // =========================
  // 言語ヘルパー（language.js から取得）
  // =========================
  var getLocalized = window.GreybrionLang.getLocalized;
  var getCurrentLanguage = window.GreybrionLang.getCurrentLanguage;
  var setLanguage = window.GreybrionLang.setLanguage;

  // =========================
  // パス定義（集約）
  // =========================
  var SITE_ROOT     = "../";
  var DEVLOG_ROOT   = SITE_ROOT + "data/devlog/";
  var CATEGORY_JSON = DEVLOG_ROOT + "categories.json";
  var SITE_JSON     = SITE_ROOT + "data/site.json";

  // =========================
  // ページング定数・状態
  // =========================
  var LOGS_PER_PAGE = 5;
  var currentLogPage = 1;
  var currentLogs    = [];

  // preview 文字数（これ以上なら「…」を付与）
  var PREVIEW_LEN_JA = 30;
  var PREVIEW_LEN_EN = 80;

  // =========================
  // 一覧モード状態
  // =========================
  var isListMode    = false;  // true = カテゴリ見出しクリックで全件表示
  var listModeTabIndex = 0;   // 一覧モード中のアクティブタブ

  // =========================
  // UI文言
  // =========================
  var UI_STRINGS = {
    emptyLog:       { ja: "ログはまだありません。",    en: "No logs yet." },
    pageTitle:      { ja: "Development Log",          en: "Development Log" },
    metaDescription: {
      ja: "Greybrion Studioの開発ログ。ゲーム開発・ツール開発・AscenderAI開発の進捗を公開しています。",
      en: "Development log for Greybrion Studio. Updates on game development, tool development, and AscenderAI."
    },
    paginationPrev:   { ja: "← 前の頁",   en: "← Previous" },
    paginationNext:   { ja: "次の頁 →",   en: "Next →"      },
    listModeHint:     { ja: "クリックして全件一覧を表示", en: "Click to show all logs" },
    backToNormal:     { ja: "← 通常表示へ戻る",        en: "← Back to card view" }
  };

  // =========================
  // DOM要素
  // =========================
  var categoryContainer   = null;
  var subtabContainer     = null;
  var logContainer        = null;
  var paginationContainer = null;
  var categoryTitle       = null;
  var pageTitleEl         = null;

  // =========================
  // 状態
  // =========================
  var categories     = [];
  var activeCategory = null;
  var activeTabs     = [];
  var activeTabIndex = 0;

  // サイトデータ（ナビ文言用）
  var siteNavData = null;

  // =========================
  // ユーティリティ
  // =========================
  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  /**
   * 本文テキストから preview 文字列を生成する。
   * 改行を除去してから指定文字数で切り詰め、超えた場合は「…」を付与。
   */
  function makePreview(text, maxLen) {
    if (!text) return "";
    var flat = text.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
    if (flat.length <= maxLen) return flat;
    return flat.slice(0, maxLen) + "…";
  }

  // =========================
  // ナビゲーション文言更新
  // =========================
  function updateNavLabels(nav) {
    if (!nav) return;

    var items = {
      navWorks:       nav.works,
      navGames:       nav.games,
      navTools:       nav.tools,
      navDevlog:      nav.devlog,
      navStudio:      nav.studio,
      navAbout:       nav.about,
      navPhilosophy:  nav.philosophy,
      navProfile:     nav.profile,
      navContact:     nav.contact,
      navContactLink: nav.contact,
      navBluesky:     nav.bluesky,
      navLanguage:    nav.language
    };

    Object.keys(items).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && items[id]) {
        el.textContent = getLocalized(items[id]);
      }
    });

    // Language選択肢のラベル
    var langOptions = document.querySelectorAll(".lang-option");
    langOptions.forEach(function (btn) {
      var lang = btn.getAttribute("data-lang");
      if (lang === "ja" && nav.langJa) {
        btn.textContent = getLocalized(nav.langJa);
      } else if (lang === "en" && nav.langEn) {
        btn.textContent = getLocalized(nav.langEn);
      }
    });

    // メニューボタンのaria-label
    var menuToggle = document.getElementById("menuToggle");
    if (menuToggle && siteNavData && siteNavData.ui && siteNavData.ui.menuOpen) {
      menuToggle.setAttribute("aria-label", getLocalized(siteNavData.ui.menuOpen));
    }
  }

  // =========================
  // 外部リンク設定
  // =========================
  function updateExternalLinks(links) {
    var item = document.getElementById("navBlueskyItem");
    var link = document.getElementById("navBlueskyLink");
    if (!item || !link) {
      return;
    }
    var url =
      links && typeof links.bluesky === "string"
        ? links.bluesky.trim()
        : "";
    var valid = url.startsWith("https://") || url.startsWith("http://");
    if (!valid) {
      item.hidden = true;
      link.removeAttribute("href");
      return;
    }
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    item.hidden = false;
  }

  // =========================
  // Language選択イベント設定
  // =========================
  function setupLanguageSelector() {
    var langOptions = document.querySelectorAll(".lang-option");
    langOptions.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var lang = btn.getAttribute("data-lang");
        if (lang) {
          setLanguage(lang);
        }
      });

      var lang = btn.getAttribute("data-lang");
      if (lang === getCurrentLanguage()) {
        btn.classList.add("active");
      }
    });
  }

  // =========================
  // サイト設定読み込み（ナビ文言・メタ情報用）
  // =========================
  async function loadSiteNav() {
    try {
      var res = await fetch(SITE_JSON, { cache: "no-store" });
      if (!res.ok) return;
      siteNavData = await res.json();
      updateNavLabels(siteNavData.nav || {});
      updateExternalLinks(siteNavData.links || {});
    } catch (err) {
      console.error("site.json (nav) error:", err);
    }
  }

  // =========================
  // データ読込
  // =========================
  async function fetchJson(path) {
    try {
      var res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status + ": " + path);
      return await res.json();
    } catch (err) {
      console.error("fetchJson error:", err);
      return null;
    }
  }

  // =========================
  // カテゴリ生成
  // =========================
  function renderCategories() {
    if (!categoryContainer) return;
    categoryContainer.innerHTML = "";

    categories.forEach(function (cat, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "devlog-category-btn";
      btn.textContent = getLocalized(cat.name);
      btn.setAttribute("data-category-index", String(index));

      if (activeCategory && activeCategory.id === cat.id) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", function () {
        // カテゴリボタン押下 → 通常モードへ戻してからカテゴリ選択
        exitListMode();
        selectCategory(index);
      });

      categoryContainer.appendChild(btn);
    });
  }

  // =========================
  // カテゴリ見出し描画
  // =========================
  function renderCategoryHeading(name) {
    if (!categoryTitle) return;

    // h2 を button 風に作り直す（中身を置き換える）
    categoryTitle.innerHTML = "";
    categoryTitle.className = "devlog-category-heading";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "devlog-category-heading-btn";
    btn.setAttribute("aria-label",
      escapeHtml(name) + " — " + getLocalized(UI_STRINGS.listModeHint));
    btn.textContent = name;

    btn.addEventListener("click", function () {
      if (isListMode) {
        exitListMode();
      } else {
        enterListMode();
      }
    });

    categoryTitle.appendChild(btn);
  }

  // =========================
  // カテゴリ選択
  // =========================
  async function selectCategory(index) {
    activeCategory = categories[index];
    activeTabIndex = 0;
    activeTabs     = [];
    currentLogPage = 1;

    renderCategories();

    var catName = getLocalized(activeCategory.name);
    renderCategoryHeading(catName);

    if (activeCategory.hasTabs) {
      var tabsPath = DEVLOG_ROOT + activeCategory.tabsFile;
      var tabsData = await fetchJson(tabsPath);

      if (tabsData && Array.isArray(tabsData.tabs)) {
        activeTabs = tabsData.tabs;
        renderSubtabs();
        await selectTab(0);
      } else {
        renderSubtabs();
        setLogsAndRender([]);
      }
    } else {
      subtabContainer.innerHTML = "";
      subtabContainer.classList.add("hidden");

      var logPath = DEVLOG_ROOT + activeCategory.logFile;
      var logData = await fetchJson(logPath);

      setLogsAndRender(
        logData && Array.isArray(logData.logs) ? logData.logs : []
      );
    }
  }

  // =========================
  // サブタブ生成
  // =========================
  function renderSubtabs() {
    if (!subtabContainer) return;

    subtabContainer.innerHTML = "";

    if (activeTabs.length === 0) {
      subtabContainer.classList.add("hidden");
      return;
    }

    subtabContainer.classList.remove("hidden");

    activeTabs.forEach(function (tab, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "devlog-subtab-btn";
      btn.textContent = getLocalized(tab.name);
      btn.setAttribute("data-tab-index", String(index));

      if (index === activeTabIndex) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", function () {
        // タブ切り替えでも一覧モードを引き継ぐ（同カテゴリ内の切り替えなので維持）
        currentLogPage = 1;
        selectTab(index);
      });

      subtabContainer.appendChild(btn);
    });
  }

  // =========================
  // サブタブ選択
  // =========================
  async function selectTab(index) {
    activeTabIndex = index;
    currentLogPage = 1;
    renderSubtabs();

    var tab = activeTabs[index];
    if (!tab) {
      setLogsAndRender([]);
      return;
    }

    var logPath = DEVLOG_ROOT + tab.logFile;
    var logData = await fetchJson(logPath);

    setLogsAndRender(
      logData && Array.isArray(logData.logs) ? logData.logs : []
    );
  }

  // =========================
  // ログをソートして保持し、現ページを描画
  // =========================
  function setLogsAndRender(logs) {
    currentLogs = Array.isArray(logs)
      ? logs.slice().sort(function (a, b) {
          return (b.date || "").localeCompare(a.date || "");
        })
      : [];

    if (isListMode) {
      renderAllLogs(currentLogs);
      renderPagination(0); // ページャー非表示
    } else {
      renderCurrentPage();
    }
  }

  // =========================
  // 現在ページのログを描画（通常モード）
  // =========================
  function renderCurrentPage() {
    var start    = (currentLogPage - 1) * LOGS_PER_PAGE;
    var end      = start + LOGS_PER_PAGE;
    var pageLogs = currentLogs.slice(start, end);

    renderLogs(pageLogs, currentLogs.length);
    renderPagination(currentLogs.length);
  }

  // =========================
  // ログ一覧描画（通常モード・preview表示）
  // =========================
  function renderLogs(pageLogs, totalCount) {
    if (!logContainer) return;
    logContainer.innerHTML = "";

    if (!totalCount || totalCount === 0) {
      logContainer.innerHTML =
        '<p class="devlog-empty">' +
        escapeHtml(getLocalized(UI_STRINGS.emptyLog)) +
        "</p>";
      return;
    }

    var lang    = getCurrentLanguage();
    var isJa    = lang === "ja";
    var prevLen = isJa ? PREVIEW_LEN_JA : PREVIEW_LEN_EN;

    pageLogs.forEach(function (log) {
      var entry = document.createElement("article");
      entry.className = "devlog-entry";

      if (log.id) {
        entry.setAttribute("data-log-id", log.id);
      }

      var dateStr   = escapeHtml(log.date || "");
      var titleText = getLocalized(log.title);
      var bodyText  = getLocalized(log.body);
      var titleStr  = escapeHtml(titleText);

      // Preview（改行除去・文字数制限）
      var previewStr = escapeHtml(makePreview(bodyText, prevLen));

      // 詳細ページURL
      var detailUrl = "log/" + lang + "/" + escapeHtml(log.id || "") + ".html";

      var imageHtml = "";
      if (log.image) {
        imageHtml =
          '<div class="devlog-image-wrapper">' +
          '<img class="devlog-image" src="' +
          escapeHtml(log.image) +
          '" alt="' + titleStr + '">' +
          "</div>";
      }

      var tagsHtml = "";
      if (Array.isArray(log.tags) && log.tags.length > 0) {
        tagsHtml =
          '<div class="devlog-tags">' +
          log.tags
            .map(function (tag) {
              return '<span class="devlog-tag">' + escapeHtml(tag) + "</span>";
            })
            .join("") +
          "</div>";
      }

      entry.innerHTML =
        '<time class="devlog-date">' + dateStr + "</time>" +
        '<h3 class="devlog-title">' +
          '<a class="devlog-title-link" href="' + detailUrl + '">' + titleStr + "</a>" +
        "</h3>" +
        '<p class="devlog-body devlog-body--preview">' + previewStr + "</p>" +
        imageHtml +
        tagsHtml;

      logContainer.appendChild(entry);
    });
  }

  // =========================
  // 一覧モード：全件を箇条書き表示
  // =========================
  function renderAllLogs(logs) {
    if (!logContainer) return;
    logContainer.innerHTML = "";

    if (!logs || logs.length === 0) {
      logContainer.innerHTML =
        '<p class="devlog-empty">' +
        escapeHtml(getLocalized(UI_STRINGS.emptyLog)) +
        "</p>";
      return;
    }

    var lang = getCurrentLanguage();

    var ul = document.createElement("ul");
    ul.className = "devlog-list-mode";

    logs.forEach(function (log) {
      var id        = log.id || "";
      var dateStr   = escapeHtml(log.date || "");
      var titleText = getLocalized(log.title);
      var titleStr  = escapeHtml(titleText);
      var detailUrl = "log/" + lang + "/" + escapeHtml(id) + ".html";

      var li = document.createElement("li");
      li.className = "devlog-list-item";
      if (id) li.setAttribute("data-log-id", id);

      li.innerHTML =
        '<time class="devlog-list-date">' + dateStr + "</time>" +
        '<a class="devlog-list-link" href="' + detailUrl + '">' + titleStr + "</a>";

      ul.appendChild(li);
    });

    // 戻るボタン
    var backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "devlog-list-back-btn";
    backBtn.textContent = getLocalized(UI_STRINGS.backToNormal);
    backBtn.addEventListener("click", function () {
      exitListMode();
    });

    logContainer.appendChild(backBtn);
    logContainer.appendChild(ul);
  }

  // =========================
  // 一覧モード 開始
  // =========================
  function enterListMode() {
    isListMode = true;

    // 見出しボタンにactive状態を付与
    var headBtn = categoryTitle && categoryTitle.querySelector(".devlog-category-heading-btn");
    if (headBtn) headBtn.classList.add("is-list-mode");

    // ページャーを隠す
    if (paginationContainer) paginationContainer.innerHTML = "";

    // 現在保持しているログで一覧描画
    renderAllLogs(currentLogs);
  }

  // =========================
  // 一覧モード 終了（通常表示へ戻る）
  // =========================
  function exitListMode() {
    isListMode     = false;
    currentLogPage = 1;

    // 見出しボタンのactive状態を解除
    var headBtn = categoryTitle && categoryTitle.querySelector(".devlog-category-heading-btn");
    if (headBtn) headBtn.classList.remove("is-list-mode");

    // 通常カード表示に戻す
    renderCurrentPage();
  }

  // =========================
  // ページャー描画
  // =========================
  function renderPagination(totalCount) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";

    var totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);

    if (totalPages <= 1) {
      return;
    }

    var prevText = getLocalized(UI_STRINGS.paginationPrev);
    var nextText = getLocalized(UI_STRINGS.paginationNext);

    var prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "devlog-page-btn";
    prevBtn.textContent = prevText;
    prevBtn.disabled = (currentLogPage === 1);
    prevBtn.addEventListener("click", function () {
      if (currentLogPage > 1) {
        currentLogPage--;
        renderCurrentPage();
        scrollToLogArea();
      }
    });

    var pageInfo = document.createElement("span");
    pageInfo.className = "devlog-page-info";
    pageInfo.textContent = currentLogPage + " / " + totalPages;

    var nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "devlog-page-btn";
    nextBtn.textContent = nextText;
    nextBtn.disabled = (currentLogPage === totalPages);
    nextBtn.addEventListener("click", function () {
      if (currentLogPage < totalPages) {
        currentLogPage++;
        renderCurrentPage();
        scrollToLogArea();
      }
    });

    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextBtn);
  }

  // =========================
  // ページ切替後のスクロール
  // =========================
  function scrollToLogArea() {
    if (!logContainer) return;
    logContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // =========================
  // 初期化
  // =========================
  async function init() {
    categoryContainer   = document.getElementById("devlogCategories");
    subtabContainer     = document.getElementById("devlogSubtabs");
    logContainer        = document.getElementById("devlogEntries");
    paginationContainer = document.getElementById("devlogPagination");
    categoryTitle       = document.getElementById("devlogCategoryTitle");
    pageTitleEl         = document.getElementById("devlogPageTitle");

    setupLanguageSelector();

    if (pageTitleEl) {
      pageTitleEl.textContent = getLocalized(UI_STRINGS.pageTitle);
    }
    document.title = getLocalized(UI_STRINGS.pageTitle) + " - Greybrion Studio";

    var metaEl = document.getElementById("metaDescription");
    if (metaEl) {
      metaEl.setAttribute("content", getLocalized(UI_STRINGS.metaDescription));
    }

    await loadSiteNav();

    var data = await fetchJson(CATEGORY_JSON);
    if (!data || !Array.isArray(data.categories)) {
      console.error("categories.json の読み込みに失敗しました");
      return;
    }

    categories = data.categories;
    renderCategories();

    if (categories.length > 0) {
      await selectCategory(0);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
