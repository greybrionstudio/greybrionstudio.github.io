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
  var SITE_ROOT = "../";
  var DEVLOG_ROOT = SITE_ROOT + "data/devlog/";
  var CATEGORY_JSON = DEVLOG_ROOT + "categories.json";
  var SITE_JSON = SITE_ROOT + "data/site.json";

  // =========================
  // UI文言（フォールバック用）
  // =========================
  var UI_STRINGS = {
    emptyLog: { ja: "ログはまだありません。", en: "No logs yet." },
    pageTitle: { ja: "Development Log", en: "Development Log" },
    metaDescription: {
      ja: "Greybrion Studioの開発ログ。ゲーム開発・ツール開発・AscenderAI開発の進捗を公開しています。",
      en: "Development log for Greybrion Studio. Updates on game development, tool development, and AscenderAI."
    }
  };

  // =========================
  // DOM要素
  // =========================
  var categoryContainer = null;
  var subtabContainer = null;
  var logContainer = null;
  var categoryTitle = null;
  var pageTitleEl = null;

  // =========================
  // 状態
  // =========================
  var categories = [];
  var activeCategory = null;
  var activeTabs = [];
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

  // =========================
  // ナビゲーション文言更新
  // =========================
  function updateNavLabels(nav) {
    if (!nav) return;

    var items = {
      navWorks: nav.works,
      navGames: nav.games,
      navTools: nav.tools,
      navDevlog: nav.devlog,
      navStudio: nav.studio,
      navAbout: nav.about,
      navPhilosophy: nav.philosophy,
      navProfile: nav.profile,
      navContact: nav.contact,
      navContactLink: nav.contact,
      navBluesky: nav.bluesky,
      navLanguage: nav.language
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
      links &&
      typeof links.bluesky === "string"
        ? links.bluesky.trim()
        : "";
    var valid =
      url.startsWith("https://") ||
      url.startsWith("http://");
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

      // 現在の言語にactiveクラスを付与
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
      var nav = siteNavData.nav || {};
      updateNavLabels(nav);
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
        selectCategory(index);
      });

      categoryContainer.appendChild(btn);
    });
  }

  // =========================
  // カテゴリ選択
  // =========================
  async function selectCategory(index) {
    activeCategory = categories[index];
    activeTabIndex = 0;
    activeTabs = [];

    renderCategories();

    if (categoryTitle) {
      categoryTitle.textContent = getLocalized(activeCategory.name);
    }

    if (activeCategory.hasTabs) {
      var tabsPath = DEVLOG_ROOT + activeCategory.tabsFile;
      var tabsData = await fetchJson(tabsPath);

      if (tabsData && Array.isArray(tabsData.tabs)) {
        activeTabs = tabsData.tabs;
        renderSubtabs();
        await selectTab(0);
      } else {
        renderSubtabs();
        renderLogs([]);
      }
    } else {
      subtabContainer.innerHTML = "";
      subtabContainer.classList.add("hidden");

      var logPath = DEVLOG_ROOT + activeCategory.logFile;
      var logData = await fetchJson(logPath);

      if (logData && Array.isArray(logData.logs)) {
        renderLogs(logData.logs);
      } else {
        renderLogs([]);
      }
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
    renderSubtabs();

    var tab = activeTabs[index];
    if (!tab) {
      renderLogs([]);
      return;
    }

    var logPath = DEVLOG_ROOT + tab.logFile;
    var logData = await fetchJson(logPath);

    if (logData && Array.isArray(logData.logs)) {
      renderLogs(logData.logs);
    } else {
      renderLogs([]);
    }
  }

  // =========================
  // ログ一覧生成（日付降順）
  // =========================
  function renderLogs(logs) {
    if (!logContainer) return;
    logContainer.innerHTML = "";

    if (!Array.isArray(logs) || logs.length === 0) {
      logContainer.innerHTML = '<p class="devlog-empty">' + escapeHtml(getLocalized(UI_STRINGS.emptyLog)) + '</p>';
      return;
    }

    var sorted = logs.slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });

    sorted.forEach(function (log) {
      var entry = document.createElement("article");
      entry.className = "devlog-entry";

      if (log.id) {
        entry.setAttribute("data-log-id", log.id);
      }

      var dateStr = escapeHtml(log.date || "");
      var titleStr = escapeHtml(getLocalized(log.title));
      var bodyStr = escapeHtml(getLocalized(log.body));

      var imageHtml = "";
      if (log.image) {
        imageHtml =
          '<div class="devlog-image-wrapper">' +
            '<img class="devlog-image" src="' +
            escapeHtml(log.image) +
            '" alt="' +
            titleStr +
            '">' +
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
        '<h3 class="devlog-title">' + titleStr + "</h3>" +
        '<p class="devlog-body">' + bodyStr + "</p>" +
        imageHtml +
        tagsHtml;

      logContainer.appendChild(entry);
    });
  }

  // =========================
  // 初期化
  // =========================
  async function init() {
    categoryContainer = document.getElementById("devlogCategories");
    subtabContainer = document.getElementById("devlogSubtabs");
    logContainer = document.getElementById("devlogEntries");
    categoryTitle = document.getElementById("devlogCategoryTitle");
    pageTitleEl = document.getElementById("devlogPageTitle");

    // Language選択セットアップ
    setupLanguageSelector();

    // ページタイトル・メタ情報更新
    if (pageTitleEl) {
      pageTitleEl.textContent = getLocalized(UI_STRINGS.pageTitle);
    }
    document.title = getLocalized(UI_STRINGS.pageTitle) + " - Greybrion Studio";

    var metaEl = document.getElementById("metaDescription");
    if (metaEl) {
      metaEl.setAttribute("content", getLocalized(UI_STRINGS.metaDescription));
    }

    // サイトナビ文言読み込み
    await loadSiteNav();

    // カテゴリ読み込み
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
