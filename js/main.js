console.log("Greybrion Studio site loaded");

// =========================
// 言語ヘルパー（language.js から取得）
// =========================
var getLocalized = window.GreybrionLang.getLocalized;
var getCurrentLanguage = window.GreybrionLang.getCurrentLanguage;
var setLanguage = window.GreybrionLang.setLanguage;

// =========================
// 要素取得
// =========================
const track = document.getElementById("sliderTrack");
const sliderWindow = document.getElementById("sliderWindow");
const worksSlider = document.getElementById("worksSlider");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const siteTitleEl = document.getElementById("site-title");
const releasedHeadingEl = document.getElementById("released-heading");
const paperTitleEl = document.getElementById("paper-title");
const paperSubEl = document.getElementById("paper-sub");
const paperBodyEl = document.getElementById("paper-body");

const philosophyHeadingEl = document.getElementById("philosophy-heading");
const philosophyBodyEl = document.getElementById("philosophy-body");
const profileHeadingEl = document.getElementById("profile-heading");
const profileBodyEl = document.getElementById("profile-body");
const contactHeadingEl = document.getElementById("contact-heading");
const contactBodyEl = document.getElementById("contact-body");

let currentIndex = 0;

// サイトデータを保持（ナビ・UI文言用）
let siteData = null;

// =========================
// 共通
// =========================
function isMobile() {
  return window.innerWidth <= 600;
}

function getCardsPerView() {
  if (window.innerWidth <= 600) return 1;
  if (window.innerWidth <= 900) return 2;
  if (window.innerWidth <= 1100) return 2;
  return 3;
}

function escapeHtml(text) {
  const div = document.createElement("div");
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

  // Language選択肢のラベル更新
  var langOptions = document.querySelectorAll(".lang-option");
  langOptions.forEach(function (btn) {
    var lang = btn.getAttribute("data-lang");
    if (lang === "ja" && nav.langJa) {
      btn.textContent = getLocalized(nav.langJa);
    } else if (lang === "en" && nav.langEn) {
      btn.textContent = getLocalized(nav.langEn);
    }
  });

  // メニューボタンのaria-label更新
  var menuToggle = document.getElementById("menuToggle");
  if (menuToggle) {
    var uiData = siteData && siteData.ui;
    if (uiData && uiData.menuOpen) {
      menuToggle.setAttribute("aria-label", getLocalized(uiData.menuOpen));
    }
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
// site.json 読み込み
// =========================
async function loadSiteContent() {
  try {
    const res = await fetch("data/site.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`site.json: ${res.status}`);

    const data = await res.json();
    siteData = data;

    const site = data.site || {};
    const paper = data.paper || {};
    const nav = data.nav || {};
    const sections = data.sections || {};
    const ui = data.ui || {};

    // document.title
    if (site.title) {
      document.title = getLocalized(site.title);
    }

    // meta description
    if (site.description) {
      var metaEl = document.getElementById("metaDescription");
      if (metaEl) {
        metaEl.setAttribute("content", getLocalized(site.description));
      }
    }

    // ヘッダータイトル
    if (siteTitleEl && site.headerTitle) {
      siteTitleEl.textContent = getLocalized(site.headerTitle);
    }

    // RELEASED WORKS 見出し
    if (releasedHeadingEl && site.releasedHeading) {
      releasedHeadingEl.textContent = getLocalized(site.releasedHeading);
    }

    // Paper（About）セクション
    if (paperTitleEl && paper.title) {
      paperTitleEl.textContent = getLocalized(paper.title);
    }

    if (paperSubEl && paper.subtitle) {
      paperSubEl.textContent = getLocalized(paper.subtitle);
    }

    if (paperBodyEl) {
      paperBodyEl.innerHTML = "";

      var lines = paper.lines;
      if (lines && typeof lines === "object" && !Array.isArray(lines)) {
        // 多言語オブジェクト { ja: [...], en: [...] }
        var lang = getCurrentLanguage();
        var arr = lines[lang] || lines["ja"] || lines["en"] || [];
        arr.forEach(function (line) {
          var p = document.createElement("p");
          p.textContent = line;
          paperBodyEl.appendChild(p);
        });
      } else if (Array.isArray(lines)) {
        lines.forEach(function (line) {
          var p = document.createElement("p");
          p.textContent = getLocalized(line);
          paperBodyEl.appendChild(p);
        });
      }
    }

    // PHILOSOPHY
    if (sections.philosophy) {
      if (philosophyHeadingEl) {
        philosophyHeadingEl.textContent = getLocalized(sections.philosophy.heading);
      }
      if (philosophyBodyEl) {
        philosophyBodyEl.textContent = getLocalized(sections.philosophy.body);
      }
    }

    // PROFILE
    if (sections.profile) {
      if (profileHeadingEl) {
        profileHeadingEl.textContent = getLocalized(sections.profile.heading);
      }
      if (profileBodyEl) {
        profileBodyEl.textContent = getLocalized(sections.profile.body);
      }
    }

    // CONTACT
    if (sections.contact) {
      if (contactHeadingEl) {
        contactHeadingEl.textContent = getLocalized(sections.contact.heading);
      }
      if (contactBodyEl) {
        contactBodyEl.textContent = getLocalized(sections.contact.body);
      }
    }

    // ナビゲーション文言
    updateNavLabels(nav);

    // 外部リンク設定
    updateExternalLinks(data.links || {});

    // スライダーボタンのaria-label
    if (prevBtn && ui.prevSlide) {
      prevBtn.setAttribute("aria-label", getLocalized(ui.prevSlide));
    }
    if (nextBtn && ui.nextSlide) {
      nextBtn.setAttribute("aria-label", getLocalized(ui.nextSlide));
    }

  } catch (err) {
    console.error("site.json error:", err);
  }
}

// =========================
// カード生成
// =========================
function createWorkCard(work) {
  const article = document.createElement("article");
  article.className = "slide-card";

  const image = work.image
    ? `<img src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title || "work")}" />`
    : `<div class="coming-soon-image">${escapeHtml(work.title || "Work")}</div>`;

  const link = work.link && work.link.trim() !== "" ? work.link : "#";

  var ui = (siteData && siteData.ui) || {};
  var linkText = link === "#"
    ? getLocalized(ui.comingSoon || "Coming Soon")
    : getLocalized(ui.workLink || "Details");

  article.innerHTML = `
    ${image}
    <div class="slide-body">
      <span class="slide-type">${escapeHtml(work.type || "Work")}</span>
      <h3>${escapeHtml(work.title || "Untitled")}</h3>
      <p>${escapeHtml(getLocalized(work.description || ""))}</p>
      <a class="work-link" href="${escapeHtml(link)}">${escapeHtml(linkText)}</a>
    </div>
  `;

  return article;
}

function createComingSoonCard() {
  const article = document.createElement("article");
  article.className = "slide-card coming-soon-card";

  var ui = (siteData && siteData.ui) || {};

  article.innerHTML = `
    <div class="coming-soon-image">${escapeHtml(getLocalized(ui.comingSoon || "COMING SOON"))}</div>
    <div class="slide-body">
      <span class="slide-type">Soon</span>
      <h3>${escapeHtml(getLocalized(ui.comingSoonTitle || "Coming Soon"))}</h3>
      <p>${escapeHtml(getLocalized(ui.comingSoonBody || ""))}</p>
      <a href="javascript:void(0)">${escapeHtml(getLocalized(ui.stayTuned || "Stay Tuned"))}</a>
    </div>
  `;

  return article;
}

// =========================
// works.json 読み込み
// =========================
function renderWorks(works) {
  if (!track) return;

  track.innerHTML = "";

  const hasWorks = Array.isArray(works) && works.length > 0;

  if (!hasWorks) {
    track.appendChild(createComingSoonCard());
    track.classList.add("is-empty");
    worksSlider?.classList.add("is-empty");
    return;
  }

  track.classList.remove("is-empty");
  worksSlider?.classList.remove("is-empty");

  works.forEach((work) => {
    track.appendChild(createWorkCard(work));
  });
}

async function loadWorksContent() {
  try {
    const res = await fetch("data/works.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`works.json: ${res.status}`);

    const data = await res.json();
    renderWorks(data.works || []);
    currentIndex = 0;
    updateSlider();
  } catch (err) {
    console.error("works.json error:", err);
    renderWorks([]);
    currentIndex = 0;
    updateSlider();
  }
}

// =========================
// スライダー
// =========================
function updateSlider() {
  if (!track || !prevBtn || !nextBtn || !worksSlider) return;

  const cards = track.querySelectorAll(".slide-card");
  if (!cards.length) return;

  const perView = getCardsPerView();
  const maxIndex = Math.max(0, cards.length - perView);

  worksSlider.classList.remove(
    "count-1",
    "count-2",
    "count-3",
    "is-slidable"
  );

  track.classList.remove(
    "count-1",
    "count-2",
    "count-3",
    "is-slidable"
  );

  if (!track.classList.contains("is-empty")) {
    if (cards.length === 1) {
      worksSlider.classList.add("count-1");
      track.classList.add("count-1");
    } else if (cards.length === 2) {
      worksSlider.classList.add("count-2");
      track.classList.add("count-2");
    } else if (cards.length === 3) {
      worksSlider.classList.add("count-3");
      track.classList.add("count-3");
    } else {
      worksSlider.classList.add("is-slidable");
      track.classList.add("is-slidable");
    }
  }

  if (track.classList.contains("is-empty") || isMobile()) {
    track.style.transform = "none";
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  if (cards.length <= perView) {
    track.style.transform = "none";
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  prevBtn.style.display = "";
  nextBtn.style.display = "";

  currentIndex = Math.min(currentIndex, maxIndex);

  const trackStyle = window.getComputedStyle(track);
  const gap =
    parseFloat(trackStyle.gap || trackStyle.columnGap || "20") || 20;

  const cardWidth = cards[0].offsetWidth + gap;

  track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;

  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex >= maxIndex;
}

function scrollMobileToCard(index) {
  if (!sliderWindow || !track) return;

  const cards = track.querySelectorAll(".slide-card");
  if (!cards[index]) return;

  sliderWindow.scrollTo({
    left: cards[index].offsetLeft,
    behavior: "smooth"
  });
}

function setupSliderEvents() {
  if (!track || !prevBtn || !nextBtn) return;

  nextBtn.addEventListener("click", () => {
    const cards = track.querySelectorAll(".slide-card");
    const maxIndex = Math.max(0, cards.length - getCardsPerView());

    if (isMobile()) {
      const nextIndex = Math.min(currentIndex + 1, cards.length - 1);
      currentIndex = nextIndex;
      scrollMobileToCard(currentIndex);
      return;
    }

    if (currentIndex < maxIndex) {
      currentIndex++;
      updateSlider();
    }
  });

  prevBtn.addEventListener("click", () => {
    if (isMobile()) {
      const prevIndex = Math.max(currentIndex - 1, 0);
      currentIndex = prevIndex;
      scrollMobileToCard(currentIndex);
      return;
    }

    if (currentIndex > 0) {
      currentIndex--;
      updateSlider();
    }
  });

  window.addEventListener("resize", () => {
    currentIndex = 0;
    updateSlider();
  });

  if (sliderWindow) {
    sliderWindow.addEventListener("scroll", () => {
      if (!isMobile()) return;

      const cards = track.querySelectorAll(".slide-card");
      if (!cards.length) return;

      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - sliderWindow.scrollLeft);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      currentIndex = closestIndex;
    });
  }
}

// =========================
// 初期化
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  setupLanguageSelector();
  setupSliderEvents();

  await Promise.all([
    loadSiteContent(),
    loadWorksContent()
  ]);

  updateSlider();
});
