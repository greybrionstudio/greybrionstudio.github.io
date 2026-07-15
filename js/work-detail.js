// =========================
// 言語ヘルパー（language.js から取得）
// =========================
var getLocalized = window.GreybrionLang.getLocalized;
var getCurrentLanguage = window.GreybrionLang.getCurrentLanguage;
var setLanguage = window.GreybrionLang.setLanguage;

let workData = null;
let currentPage = 0;
let currentImageIndex = 0;

const jsonPath = "../data/manual-grid-authoring-tool.json";

// サイト設定データ（ナビ文言用）
let siteNavData = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function toYouTubeEmbedUrl(video) {
  if (!video) return "";

  if (video.id) {
    return `https://www.youtube.com/embed/${encodeURIComponent(video.id)}`;
  }

  const url = video.url || "";
  if (!url) return "";

  if (url.includes("youtube.com/embed/")) {
    return url;
  }

  if (url.includes("youtube.com/watch?v=")) {
    const id = url.split("watch?v=")[1].split("&")[0];
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  }

  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  }

  return url;
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
// サイト設定読み込み（ナビ文言用）
// =========================
async function loadSiteNav() {
  try {
    const res = await fetch("../data/site.json", { cache: "no-store" });
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
// 作品データ読み込み
// =========================
async function loadWorkDetail() {
  try {
    const res = await fetch(jsonPath, {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`work detail json error: ${res.status}`);
    }

    workData = await res.json();

    const page1 = workData.page1 || {};
    var titleText = page1.title || "Manual Grid Authoring Tool";
    document.title = `${titleText} - Greybrion Studio`;

    // 戻るリンク更新
    var backLink = document.getElementById("backLink");
    if (backLink && workData.ui && workData.ui.backToTop) {
      backLink.textContent = getLocalized(workData.ui.backToTop);
    }

    renderPage();
  } catch (err) {
    console.error(err);

    var ui = (workData && workData.ui) || {};
    var errorTitle = getLocalized(ui.loadError || "読み込みエラー");
    var errorBody = getLocalized(ui.loadErrorBody || "作品情報を読み込めませんでした。");

    const paperInner = document.getElementById("workPaperInner");
    if (paperInner) {
      paperInner.innerHTML = `
        <h1>${escapeHtml(errorTitle)}</h1>
        <p>${escapeHtml(errorBody)}</p>
      `;
    }
  }
}

function renderPage() {
  const paper = document.getElementById("workPaper");
  const paperInner = document.getElementById("workPaperInner");

  if (!paper || !paperInner || !workData) return;

  paper.classList.add("turning");

  setTimeout(() => {
    currentImageIndex = 0;

    if (currentPage === 0) {
      renderIntroPage(paperInner);
    } else {
      renderDetailPage(paperInner);
    }

    paper.classList.remove("turning");
  }, 220);
}

/* ========================= */
/* 画像スライダー */
/* ========================= */

function createImageSlider(images, title) {
  if (!Array.isArray(images) || images.length === 0) {
    return "";
  }

  const slidesHtml = images
    .map(
      (src) => `
        <div class="image-slide">
          <img
            src="${escapeHtml(src)}"
            alt="${escapeHtml(title || "screenshot")}" />
        </div>
      `
    )
    .join("");

  const dotsHtml = images
    .map(
      (_, index) => `
        <span class="image-slider-dot ${index === 0 ? "active" : ""}"></span>
      `
    )
    .join("");

  const navHtml =
    images.length > 1
      ? `
        <div class="image-slider-nav">
          <button type="button" id="prevImageBtn">←</button>
          <div class="image-slider-dots">
            ${dotsHtml}
          </div>
          <button type="button" id="nextImageBtn">→</button>
        </div>
      `
      : "";

  return `
    <div class="image-slider">
      <div class="image-slider-window">
        <div class="image-slider-track" id="imageSliderTrack">
          ${slidesHtml}
        </div>
      </div>
      ${navHtml}
    </div>
  `;
}

function setupImageSlider(images) {
  if (!Array.isArray(images) || images.length <= 1) return;

  const track = document.getElementById("imageSliderTrack");
  const prevBtn = document.getElementById("prevImageBtn");
  const nextBtn = document.getElementById("nextImageBtn");
  const dots = document.querySelectorAll(".image-slider-dot");

  if (!track || !prevBtn || !nextBtn) return;

  function updateImageSlider() {
    track.style.transform = `translateX(-${currentImageIndex * 100}%)`;

    dots.forEach((dot, index) => {
      dot.classList.toggle("active", index === currentImageIndex);
    });
  }

  prevBtn.addEventListener("click", () => {
    currentImageIndex =
      currentImageIndex <= 0
        ? images.length - 1
        : currentImageIndex - 1;

    updateImageSlider();
  });

  nextBtn.addEventListener("click", () => {
    currentImageIndex =
      currentImageIndex >= images.length - 1
        ? 0
        : currentImageIndex + 1;

    updateImageSlider();
  });

  updateImageSlider();
}

/* ========================= */
/* 画像click表示 */
/* ========================= */

function setupImageModal() {
  const modal = document.createElement("div");
  modal.className = "image-modal";

  var ui = (workData && workData.ui) || {};
  var altText = getLocalized(ui.enlargeAlt || "拡大画像");

  modal.innerHTML = `
    <button type="button" class="image-modal-close">×</button>
    <img src="" alt="${escapeHtml(altText)}" />
  `;

  document.body.appendChild(modal);

  const modalImage = modal.querySelector("img");
  const closeBtn = modal.querySelector(".image-modal-close");

  document.addEventListener("click", (e) => {
    const img = e.target.closest(".image-slide img");
    if (!img) return;

    modalImage.src = img.src;
    modalImage.alt = img.alt || altText;
    modal.classList.add("active");
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      modal.classList.remove("active");
    }
  });
}

/* ========================= */
/* 1ページ目 */
/* ========================= */

function renderIntroPage(container) {
  const page1 = workData.page1 || {};
  const ui = workData.ui || {};

  const images =
    Array.isArray(page1.screenshots) && page1.screenshots.length > 0
      ? page1.screenshots
      : page1.mainImage
        ? [page1.mainImage]
        : [];

  // overview: 多言語配列対応
  var overviewLines = [];
  if (page1.overview) {
    if (typeof page1.overview === "object" && !Array.isArray(page1.overview)) {
      var lang = getCurrentLanguage();
      overviewLines = page1.overview[lang] || page1.overview["ja"] || page1.overview["en"] || [];
    } else if (Array.isArray(page1.overview)) {
      overviewLines = page1.overview.map(function (line) { return getLocalized(line); });
    }
  }

  const overviewHtml = overviewLines.length > 0
    ? `
      <div class="work-overview">
        ${overviewLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>
    `
    : "";

  const embedUrl = toYouTubeEmbedUrl(page1.video);

  var videoHeading = getLocalized(ui.videoHeading || "紹介動画");
  var videoNotReady = getLocalized(ui.videoNotReady || "紹介動画は準備中です。");

  const videoHtml =
    embedUrl
      ? `
        <div id="video-area">
          <iframe
            src="${escapeHtml(embedUrl)}"
            title="${escapeHtml(page1.title || videoHeading)}"
            allowfullscreen>
          </iframe>
        </div>
      `
      : `<p>${escapeHtml(videoNotReady)}</p>`;

  var prevPageText = getLocalized(ui.prevPage || "← 前の頁");
  var nextPageText = getLocalized(ui.nextPage || "次の頁 →");

  container.innerHTML = `
    <span class="work-type">${escapeHtml(workData.type || "Work")}</span>

    <h1>${escapeHtml(page1.title || "Untitled")}</h1>

    <p class="work-catch">
      ${escapeHtml(getLocalized(page1.catch || ""))}
    </p>

    ${overviewHtml}

    ${createImageSlider(images, page1.title)}

    <h2>${escapeHtml(videoHeading)}</h2>
    ${videoHtml}

    <div class="page-nav">
      <button type="button" disabled>${escapeHtml(prevPageText)}</button>
      <button type="button" id="nextPageBtn">${escapeHtml(nextPageText)}</button>
    </div>
  `;

  setupImageSlider(images);

  const nextBtn = document.getElementById("nextPageBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentPage = 1;
      renderPage();
    });
  }
}

/* ========================= */
/* 2ページ目 */
/* ========================= */

function renderDetailPage(container) {
  const page2 = workData.page2 || {};
  const ui = workData.ui || {};

  // features: 多言語配列対応
  var featuresList = [];
  if (page2.features) {
    if (typeof page2.features === "object" && !Array.isArray(page2.features)) {
      var lang = getCurrentLanguage();
      featuresList = page2.features[lang] || page2.features["ja"] || page2.features["en"] || [];
    } else if (Array.isArray(page2.features)) {
      featuresList = page2.features.map(function (f) { return getLocalized(f); });
    }
  }

  var featuresHeading = getLocalized(ui.featuresHeading || "機能一覧");
  var featuresNotReady = getLocalized(ui.featuresNotReady || "機能一覧は準備中です。");

  const featuresHtml =
    featuresList.length > 0
      ? `
        <ul id="features">
          ${featuresList
            .map((feature) => `<li>${escapeHtml(feature)}</li>`)
            .join("")}
        </ul>
      `
      : `<p>${escapeHtml(featuresNotReady)}</p>`;

  var priceHeading = getLocalized(ui.priceHeading || "価格");
  var priceText = getLocalized(page2.price || "未定");

  var storesHeading = getLocalized(ui.storesHeading || "販売サイト");
  var storesNotReady = getLocalized(ui.storesNotReady || "販売サイトは準備中です。");

  const storesHtml =
    Array.isArray(page2.stores) && page2.stores.length > 0
      ? page2.stores
          .filter((store) => store.url)
          .map(
            (store) => `
              <a
                href="${escapeHtml(store.url)}"
                target="_blank"
                rel="noopener noreferrer">
                ${escapeHtml(store.name || "Store")}
              </a>
            `
          )
          .join("")
      : "";

  var updatesHeading = getLocalized(ui.updatesHeading || "更新履歴");
  var updatesNotReady = getLocalized(ui.updatesNotReady || "更新履歴はまだありません。");

  const updatesHtml =
    Array.isArray(page2.updates) && page2.updates.length > 0
      ? `
        <ul id="updates">
          ${page2.updates
            .map((update) => {
              const date = escapeHtml(update.date || "");
              const version = update.version
                ? `${escapeHtml(update.version)}：`
                : "";
              const text = escapeHtml(getLocalized(update.text || ""));

              return `<li>${date}：${version}${text}</li>`;
            })
            .join("")}
        </ul>
      `
      : `<p>${escapeHtml(updatesNotReady)}</p>`;

  var prevPageText = getLocalized(ui.prevPage || "← 前の頁");
  var nextPageText = getLocalized(ui.nextPage || "次の頁 →");

  container.innerHTML = `
    <h2>${escapeHtml(featuresHeading)}</h2>
    ${featuresHtml}

    <h2>${escapeHtml(priceHeading)}</h2>
    <p class="price-text">${escapeHtml(priceText)}</p>

    <h2>${escapeHtml(storesHeading)}</h2>
    <div class="store-buttons">
      ${
        storesHtml ||
        `<p>${escapeHtml(storesNotReady)}</p>`
      }
    </div>

    <h2>${escapeHtml(updatesHeading)}</h2>
    ${updatesHtml}

    <div class="page-nav">
      <button type="button" id="prevPageBtn">${escapeHtml(prevPageText)}</button>
      <button type="button" disabled>${escapeHtml(nextPageText)}</button>
    </div>
  `;

  const prevBtn = document.getElementById("prevPageBtn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentPage = 0;
      renderPage();
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setupLanguageSelector();
  setupImageModal();

  await Promise.all([
    loadSiteNav(),
    loadWorkDetail()
  ]);
});
