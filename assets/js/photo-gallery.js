// Photo gallery for /photos/ (markup in _pages/photos.md, styles in assets/css/main.scss).
//
// 1. Justified layout: rows span the full width, every photo in a row has the same height and
//    keeps its full frame. Photos are split into balanced rows (linear partition), so the last
//    row is not left half-empty. Without JS the CSS flex fallback in main.scss is used.
// 2. Full-screen viewer (PhotoSwipe 5) that loads the original file, with zoom, swipe, keyboard
//    navigation and the caption from _data/photos.yml.

const gallery = document.getElementById("photo-gallery");

if (gallery) {
  const items = Array.from(gallery.querySelectorAll(".photo-item"));
  const ratios = items.map((item) => item.dataset.pswpWidth / item.dataset.pswpHeight);

  // Target row height in px: like the benchmark's vh-based rows, but bounded on very small/large screens.
  const targetRowHeight = (width) => (width < 576 ? 150 : Math.min(380, Math.max(220, window.innerHeight * 0.34)));

  // Split `ratios` into `k` contiguous rows whose summed aspect ratios are as equal as possible.
  // Returns the start index of each row.
  const partition = (k) => {
    const n = ratios.length;
    const prefix = [0];
    ratios.forEach((r, i) => prefix.push(prefix[i] + r));
    const ideal = prefix[n] / k;
    const cost = (i, j) => (prefix[j] - prefix[i] - ideal) ** 2;
    // best[r][j]: min cost of putting the first j photos into r rows; cut[r][j]: start of row r.
    const best = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
    const cut = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
    best[0][0] = 0;
    for (let r = 1; r <= k; r++) {
      for (let j = r; j <= n; j++) {
        for (let i = r - 1; i < j; i++) {
          const c = best[r - 1][i] + cost(i, j);
          if (c < best[r][j]) {
            best[r][j] = c;
            cut[r][j] = i;
          }
        }
      }
    }
    const starts = [];
    for (let r = k, j = n; r > 0; j = cut[r][j], r--) starts.unshift(cut[r][j]);
    return starts;
  };

  const layout = () => {
    const width = gallery.clientWidth;
    if (!width || !items.length) return;
    const gap = parseFloat(getComputedStyle(gallery).columnGap) || 0;
    const target = targetRowHeight(width);
    const total = ratios.reduce((a, b) => a + b, 0);
    const rows = Math.min(items.length, Math.max(1, Math.round((total * target) / width)));
    const starts = partition(rows);

    starts.forEach((start, r) => {
      const end = r + 1 < starts.length ? starts[r + 1] : items.length;
      const rowRatio = ratios.slice(start, end).reduce((a, b) => a + b, 0);
      let height = (width - gap * (end - start - 1)) / rowRatio;
      // A row with very few photos would blow up; keep it at the target height instead (left-aligned).
      if (height > target * 1.6) height = target;
      for (let i = start; i < end; i++) {
        // Floor to 1/100 px so rounding never pushes the last photo onto the next line.
        const w = Math.floor(height * ratios[i] * 100) / 100;
        items[i].style.width = `${w}px`;
        items[i].style.height = `${Math.floor(height * 100) / 100}px`;
      }
    });
    gallery.classList.add("is-justified");
  };

  let pending = false;
  new ResizeObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      layout();
    });
  }).observe(gallery);
  layout();

  // Full-screen viewer
  import(gallery.dataset.pswpLightbox).then(({ default: PhotoSwipeLightbox }) => {
    const lightbox = new PhotoSwipeLightbox({
      gallery: "#photo-gallery",
      children: "a.photo-item",
      pswpModule: () => import(gallery.dataset.pswpCore),
      bgOpacity: 0.95,
      showHideAnimationType: "zoom",
      wheelToZoom: true,
      padding: { top: 20, bottom: 56, left: 16, right: 16 },
    });
    lightbox.on("uiRegister", () => {
      lightbox.pswp.ui.registerElement({
        name: "photo-caption",
        className: "pswp__photo-caption",
        appendTo: "root",
        onInit: (el, pswp) => {
          pswp.on("change", () => {
            el.textContent = pswp.currSlide.data.element?.dataset.caption || "";
          });
        },
      });
    });
    lightbox.init();
  });
}
