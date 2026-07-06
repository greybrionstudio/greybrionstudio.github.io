/**
 * Development Log - データ駆動UIコントローラ
 * カテゴリ・サブタブ・ログすべてをJSONから生成する。
 * JavaScript内にカテゴリ名・タブ名・ログタイトル等を固定実装しない。
 */

(function () {
  "use strict";

  // =========================
  // パス定義（集約）
  // =========================
  const SITE_ROOT = "../";
  const DEVLOG_ROOT = SITE_ROOT + "data/devlog/";
  const CATEGORY_JSON = DEVLOG_ROOT + "categories.json";

  // =========================
  // 言語設定
  // =========================
  const DEFAULT_LANGUAGE = "ja";
  const LANGUAGE_STORAGE_KEY = "greybrion.language";

  function getCurrentLanguage() {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE;
  }

  // =========================
  // DOM要素
  // =========================
  let categoryContainer = null;
  let subtabContainer = null;
  let logContainer = null;
  let categoryTitle = null;

  // =========================
  // 状態
  // =========================
  let categories = [];
  let activeCategory = null;
  let activeTabs = [];
  let activeTabIndex = 0;

  // =========================
  // ユーティリティ
  // =========================
  function getLocalized(obj) {
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object") {
      var lang = getCurrentLanguage();
      return obj[lang] || obj["ja"] || obj["en"] || "";
    }
    return "";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  // =========================
  // データ読込
  // =========================
  async function fetchJson(path) {
    try {
      const res = await fetch(path, { cache: "no-store" });
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
      const btn = document.createElement("button");
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
      const tabsPath = DEVLOG_ROOT + activeCategory.tabsFile;
      const tabsData = await fetchJson(tabsPath);

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

      const logPath = DEVLOG_ROOT + activeCategory.logFile;
      const logData = await fetchJson(logPath);

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
      const btn = document.createElement("button");
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

    const tab = activeTabs[index];
    if (!tab) {
      renderLogs([]);
      return;
    }

    const logPath = DEVLOG_ROOT + tab.logFile;
    const logData = await fetchJson(logPath);

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
      logContainer.innerHTML = '<p class="devlog-empty">ログはまだありません。</p>';
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
