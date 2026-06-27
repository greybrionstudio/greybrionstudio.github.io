let workData = null;
let currentPage = 0;
let currentImageIndex = 0;

const jsonPath = "../data/manual-grid-authoring-tool.json";

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
    document.title = `${page1.title || "作品紹介"} - Greybrion Studio`;

    renderPage();
  } catch (err) {
    console.error(err);

    const paperInner = document.getElementById("workPaperInner");
    if (paperInner) {
      paperInner.innerHTML = `
        <h1>読み込みエラー</h1>
        <p>作品情報を読み込めませんでした。</p>
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
  modal.innerHTML = `
    <button type="button" class="image-modal-close">×</button>
    <img src="" alt="拡大画像" />
  `;

  document.body.appendChild(modal);

  const modalImage = modal.querySelector("img");
  const closeBtn = modal.querySelector(".image-modal-close");

  document.addEventListener("click", (e) => {
    const img = e.target.closest(".image-slide img");
    if (!img) return;

    modalImage.src = img.src;
    modalImage.alt = img.alt || "拡大画像";
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

  const images =
    Array.isArray(page1.screenshots) && page1.screenshots.length > 0
      ? page1.screenshots
      : page1.mainImage
        ? [page1.mainImage]
        : [];

  const overviewHtml = Array.isArray(page1.overview)
    ? `
      <div class="work-overview">
        ${page1.overview
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("")}
      </div>
    `
    : `
      <div class="work-overview">
        <p>${escapeHtml(page1.overview || "")}</p>
      </div>
    `;

  const embedUrl = toYouTubeEmbedUrl(page1.video);

  const videoHtml =
    embedUrl
      ? `
        <div id="video-area">
          <iframe
            src="${escapeHtml(embedUrl)}"
            title="${escapeHtml(page1.title || "紹介動画")}"
            allowfullscreen>
          </iframe>
        </div>
      `
      : `<p>紹介動画は準備中です。</p>`;

  container.innerHTML = `
    <span class="work-type">${escapeHtml(workData.type || "Work")}</span>

    <h1>${escapeHtml(page1.title || "Untitled")}</h1>

    <p class="work-catch">
      ${escapeHtml(page1.catch || "")}
    </p>

    ${overviewHtml}

    ${createImageSlider(images, page1.title)}

    <h2>紹介動画</h2>
    ${videoHtml}

    <div class="page-nav">
      <button type="button" disabled>← 前の頁</button>
      <button type="button" id="nextPageBtn">次の頁 →</button>
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

  const featuresHtml =
    Array.isArray(page2.features) && page2.features.length > 0
      ? `
        <ul id="features">
          ${page2.features
            .map((feature) => `<li>${escapeHtml(feature)}</li>`)
            .join("")}
        </ul>
      `
      : `<p>機能一覧は準備中です。</p>`;

  const priceText =
    typeof page2.price === "object"
      ? page2.price.text || "未定"
      : page2.price || "未定";

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
              const text = escapeHtml(update.text || "");

              return `<li>${date}：${version}${text}</li>`;
            })
            .join("")}
        </ul>
      `
      : `<p>更新履歴はまだありません。</p>`;

  container.innerHTML = `
    <h2>機能一覧</h2>
    ${featuresHtml}

    <h2>価格</h2>
    <p class="price-text">${escapeHtml(priceText)}</p>

    <h2>販売サイト</h2>
    <div class="store-buttons">
      ${
        storesHtml ||
        `<p>販売サイトは準備中です。</p>`
      }
    </div>

    <h2>更新履歴</h2>
    ${updatesHtml}

    <div class="page-nav">
      <button type="button" id="prevPageBtn">← 前の頁</button>
      <button type="button" disabled>次の頁 →</button>
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

document.addEventListener("DOMContentLoaded", () => {
  setupImageModal();
  loadWorkDetail();
});
