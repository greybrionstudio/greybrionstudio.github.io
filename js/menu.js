function setupMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const siteNav = document.getElementById("siteNav");

  if (!menuToggle || !siteNav) return;

  const dropdownItems = siteNav.querySelectorAll(".has-dropdown");

  menuToggle.addEventListener("click", () => {
    const isActive = siteNav.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", String(isActive));

    if (!isActive) {
      dropdownItems.forEach((item) => item.classList.remove("open"));
    }
  });

  dropdownItems.forEach((item) => {
    const toggle = item.querySelector(".dropdown-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();

      const isOpen = item.classList.contains("open");

      dropdownItems.forEach((other) => {
        other.classList.remove("open");
      });

      if (!isOpen) {
        item.classList.add("open");
      }
    });
  });

  siteNav.querySelectorAll(".dropdown-menu a").forEach((link) => {
    link.addEventListener("click", () => {
      dropdownItems.forEach((item) => item.classList.remove("open"));
      siteNav.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".site-header")) {
      dropdownItems.forEach((item) => item.classList.remove("open"));
      siteNav.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("DOMContentLoaded", setupMenu);