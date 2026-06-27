console.log("Greybrion Studio site loaded");

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

let currentIndex = 0;

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
// site.json 読み込み
// =========================
async function loadSiteContent() {
  try {
    const res = await fetch("data/site.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`site.json: ${res.status}`);

    const data = await res.json();
    const site = data.site || {};
    const paper = data.paper || {};

    if (site.title) {
      document.title = site.title;
      if (siteTitleEl) {
        siteTitleEl.textContent = site.headerTitle || site.title;
      }
    }

    if (releasedHeadingEl) {
      releasedHeadingEl.textContent = site.releasedHeading || "RELEASED WORKS";
    }

    if (paperTitleEl) {
      paperTitleEl.textContent = paper.title || "Greybrion Studio";
    }

    if (paperSubEl) {
      paperSubEl.textContent = paper.subtitle || "";
    }

    if (paperBodyEl) {
      paperBodyEl.innerHTML = "";

      if (Array.isArray(paper.lines) && paper.lines.length > 0) {
        paper.lines.forEach((line) => {
          const p = document.createElement("p");
          p.textContent = line;
          paperBodyEl.appendChild(p);
        });
      }
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
  const linkText = link === "#" ? "Coming Soon" : "作品紹介";

  article.innerHTML = `
    ${image}
    <div class="slide-body">
      <span class="slide-type">${escapeHtml(work.type || "Work")}</span>
      <h3>${escapeHtml(work.title || "Untitled")}</h3>
      <p>${escapeHtml(work.description || "")}</p>
      <a class="work-link" href="${escapeHtml(link)}">${escapeHtml(linkText)}</a>
    </div>
  `;

  return article;
}

function createComingSoonCard() {
  const article = document.createElement("article");
  article.className = "slide-card coming-soon-card";

  article.innerHTML = `
    <div class="coming-soon-image">COMING SOON</div>
    <div class="slide-body">
      <span class="slide-type">Soon</span>
      <h3>Coming Soon</h3>
      <p>公開予定の作品は、今後ここに追加されます。</p>
      <a href="javascript:void(0)">Stay Tuned</a>
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
  setupSliderEvents();

  await Promise.all([
    loadSiteContent(),
    loadWorksContent()
  ]);

  updateSlider();
});