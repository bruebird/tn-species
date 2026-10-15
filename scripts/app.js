window.addEventListener("DOMContentLoaded", () => {
  const selectedGroups = new Set(
    JSON.parse(localStorage.getItem("selectedGroups") || "[]")
  );
  const selectedCounties = new Set(
    JSON.parse(localStorage.getItem("selectedCounties") || "[]")
  );
  const searchInput = document.getElementById("searchInput");
  const endangeredCheckbox = document.getElementById("endangeredOnly");
  const tooltip = document.getElementById("tooltip");
  const mapModeStatus = document.getElementById("mapModeStatus");
  const jsonURL = "assets/data/species_by_county.json";
  const resultsSummary = document.getElementById("resultsSummary");
  const resourcesCsvURL = "assets/data/biodiversity_tools_descriptions.csv";

  const icons = {
    Mammals: "assets/icons/mammals.svg",
    Birds: "assets/icons/birds.svg",
    Fish: "assets/icons/fish.svg",
    "Reptiles & Amphibians": "assets/icons/reptiles-amphibians.svg",
    Insects: "assets/icons/insects.svg",
    "Mollusks & Crustaceans": "assets/icons/mollusks-crustaceans.svg",
    Plants: "assets/icons/plants.svg",
    "Lichens & Fungi": "assets/icons/lichens-fungi.svg",
  };
  const resourceLinks = {
    TWRA: "https://www.tn.gov/twra.html",
    "Tennessee Wildlife Resources Agency / State Wildlife Action Plan":
      "https://www.tn.gov/twra.html",
    "NatureServe Explorer": "https://explorer.natureserve.org/",
    USFWS: "https://ecos.fws.gov/ecp/",
    "USFWS ECOS": "https://ecos.fws.gov/ecp/",
    "Flora Atlas": "https://tennessee-kentucky.plantatlas.usf.edu/",
    "Tennessee-Kentucky Flora Atlas": "https://tennessee-kentucky.plantatlas.usf.edu/",
    ESRI: "https://livingatlas.arcgis.com/en/home/",
    "ESRI Living Atlas": "https://livingatlas.arcgis.com/en/home/",
    "TN Division of Natural Areas":
      "https://www.tn.gov/environment/program-areas/na-natural-areas.html",
  };

  let allSpeciesData = [];
  let allCards = [];
  let currentPage = 1;
  const cardsPerPage = 12;
  const inatPhotoCache = new Map();
  const holdToMultiMs = 500;
  let multiSelectMode = false;
  const countyNames = new Set();

  function updateMapModeStatus() {
    if (!mapModeStatus) return;
    mapModeStatus.textContent = multiSelectMode
      ? "Current mode: Multi-select"
      : "Current mode: Single-select";
  }

  function setMultiSelectMode(enabled) {
    multiSelectMode = enabled;
    updateMapModeStatus();
  }

  function saveFilters() {
    localStorage.setItem("selectedGroups", JSON.stringify([...selectedGroups]));
    localStorage.setItem("selectedCounties", JSON.stringify([...selectedCounties]));
    localStorage.setItem("searchQuery", searchInput.value);
    localStorage.setItem("endangeredOnly", endangeredCheckbox.checked);
  }

  function parseCsvRow(rowText) {
    const row = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < rowText.length; i += 1) {
      const char = rowText[i];
      const next = rowText[i + 1];

      if (char === "\"") {
        if (inQuotes && next === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    return row;
  }

  function toInitials(text) {
    return text
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  function renderResourceCard(resource) {
    const container = document.getElementById("resourceStrip");
    if (!container) return;

    const card = document.createElement("article");
    card.className = "resource-card";
    card.setAttribute("data-platform", resource.platform || "");

    const logoWrap = document.createElement("div");
    logoWrap.className = "resource-logo";

    const logoImg = document.createElement("img");
    const logoSource = /^https?:\/\//i.test(resource.fileName)
      ? resource.fileName
      : `assets/resources/${resource.fileName}`;
    logoImg.src = logoSource;
    logoImg.alt = `${resource.platform} logo`;
    logoImg.loading = "lazy";
    logoImg.addEventListener("error", () => {
      logoImg.remove();
      const fallback = document.createElement("span");
      fallback.className = "resource-logo-fallback";
      fallback.textContent = toInitials(resource.platform || "R");
      logoWrap.appendChild(fallback);
    });

    logoWrap.appendChild(logoImg);

    const name = document.createElement("h3");
    name.className = "resource-name";
    name.textContent = resource.platform;

    const description = document.createElement("p");
    description.className = "resource-description";
    description.textContent = resource.description;

    const websiteUrl = resource.url || resourceLinks[resource.platform] || "";
    if (websiteUrl) {
      const linkBtn = document.createElement("a");
      linkBtn.className = "resource-link-btn";
      linkBtn.href = websiteUrl;
      linkBtn.target = "_blank";
      linkBtn.rel = "noopener noreferrer";
      linkBtn.textContent = "Visit Website";
      linkBtn.setAttribute("aria-label", `Visit ${resource.platform}`);
      card.appendChild(linkBtn);
    }

    card.appendChild(logoWrap);
    card.appendChild(name);
    card.appendChild(description);
    const linkBtn = card.querySelector(".resource-link-btn");
    if (linkBtn) card.appendChild(linkBtn);
    container.appendChild(card);
  }

  function loadResourceStrip() {
    fetch(resourcesCsvURL)
      .then((res) => res.text())
      .then((csvText) => {
        const lines = csvText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.length < 2) return;

        const header = parseCsvRow(lines[0]);
        const platformIdx = header.indexOf("Platform");
        const fileNameIdx = header.indexOf("FileName");
        const descriptionIdx = header.indexOf("Description");
        const urlIdx = header.indexOf("URL");
        if (platformIdx < 0 || fileNameIdx < 0 || descriptionIdx < 0) return;

        lines.slice(1).forEach((line) => {
          const row = parseCsvRow(line);
          const resource = {
            platform: row[platformIdx] || "",
            fileName: row[fileNameIdx] || "",
            description: row[descriptionIdx] || "",
            url: urlIdx >= 0 ? (row[urlIdx] || "") : "",
          };
          if (!resource.platform) return;
          renderResourceCard(resource);
        });
      })
      .catch((error) => {
        console.error("Failed to load resource CSV:", error);
      });
  }

  function applySavedFilters() {
    searchInput.value = localStorage.getItem("searchQuery") || "";
    endangeredCheckbox.checked = localStorage.getItem("endangeredOnly") === "true";
  }

  function clearAllFilters() {
    selectedGroups.clear();
    selectedCounties.clear();
    setMultiSelectMode(false);
    searchInput.value = "";
    endangeredCheckbox.checked = false;
    localStorage.clear();
    currentPage = 1;
    renderCards(allSpeciesData);
    document
      .querySelectorAll(".filter-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelectorAll(".svg-county")
      .forEach((el) => el.classList.remove("selected"));
  }

  function syncMapSelection() {
    document.querySelectorAll(".svg-county").forEach((el) => {
      el.classList.toggle("selected", selectedCounties.has(el.dataset.county));
    });
  }

  function renderCountyTags() {
    const tagList = document.getElementById("countyTags");
    tagList.replaceChildren();
    [...selectedCounties].sort().forEach((county) => {
      const item = document.createElement("li");
      const tag = document.createElement("button");
      tag.type = "button";
      tag.className = "county-tag";
      tag.setAttribute("aria-label", `Remove ${county}`);
      tag.innerHTML =
        '<span></span><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8" /></svg>';
      tag.querySelector("span").textContent = county;
      tag.addEventListener("click", () => {
        selectedCounties.delete(county);
        syncMapSelection();
        renderCards(allSpeciesData);
      });
      item.appendChild(tag);
      tagList.appendChild(item);
    });
  }

  function renderPage() {
    const totalPages = Math.max(1, Math.ceil(allCards.length / cardsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * cardsPerPage;
    const end = start + cardsPerPage;

    allCards.forEach((card, index) => {
      card.style.display = index >= start && index < end ? "" : "none";
    });

    const pageIndicator = document.getElementById("pageIndicator");
    pageIndicator.textContent =
      allCards.length === 0 ? "No results" : `Page ${currentPage} of ${totalPages}`;

    document.getElementById("prevPageBtn").disabled =
      currentPage === 1 || allCards.length === 0;
    document.getElementById("nextPageBtn").disabled =
      currentPage === totalPages || allCards.length === 0;

    loadInatImages();
  }

  async function fetchInatPhotoUrl(sciName) {
    if (!sciName) return null;
    const key = sciName.toString().trim().toLowerCase();
    if (!key) return null;

    if (inatPhotoCache.has(key)) return inatPhotoCache.get(key);

    try {
      const url =
        `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(key)}` +
        "&rank=species&is_active=true&per_page=1";

      const resp = await fetch(url);
      if (!resp.ok) {
        inatPhotoCache.set(key, null);
        return null;
      }

      const data = await resp.json();
      const taxon = data && data.results && data.results[0];
      const photo = taxon && taxon.default_photo;
      const photoUrl = photo && (photo.medium_url || photo.url || photo.square_url || null);

      inatPhotoCache.set(key, photoUrl || null);
      return photoUrl || null;
    } catch (error) {
      console.error("iNat fetch failed for", sciName, error);
      inatPhotoCache.set(key, null);
      return null;
    }
  }

  async function loadInatImages() {
    const divs = Array.from(document.querySelectorAll(".species-img")).filter(
      (div) =>
        div.closest(".species-card")?.style.display !== "none" &&
        div.getAttribute("data-loaded") !== "true"
    );

    await Promise.all(divs.map(async (div) => {
      const sciName = div.getAttribute("data-sciname");
      if (!sciName) {
        div.textContent = "";
        div.setAttribute("data-loaded", "true");
        return;
      }

      const url = await fetchInatPhotoUrl(sciName);
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = sciName;
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        div.replaceChildren(img);
      } else {
        div.textContent = "";
      }
      div.setAttribute("data-loaded", "true");
    }));
  }

  function renderCards(data) {
    const cardContainer = document.getElementById("cardContainer");
    cardContainer.innerHTML = "";
    allCards = [];

    let filtered = data;

    if (selectedGroups.size > 0) {
      filtered = filtered.filter((d) => selectedGroups.has(d["Species Group"]));
    }

    if (selectedCounties.size > 0) {
      filtered = filtered.filter((d) =>
        [...selectedCounties].some((county) => d.Counties?.includes(county))
      );
    }

    const searchQuery = searchInput.value.toLowerCase();
    if (searchQuery) {
      filtered = filtered.filter(
        (d) =>
          (d["Common Name"] || "").toLowerCase().includes(searchQuery) ||
          (d["Scientific Name"] || "").toLowerCase().includes(searchQuery)
      );
    }

    if (endangeredCheckbox.checked) {
      filtered = filtered.filter(
        (d) => d["U.S. Endangered Species Act Status"] === "Endangered"
      );
    }

    document.getElementById("resultsCount").textContent = `Showing ${filtered.length} species`;
    const hasActiveFilters =
      selectedGroups.size > 0 ||
      selectedCounties.size > 0 ||
      searchQuery.trim() !== "" ||
      endangeredCheckbox.checked;
    resultsSummary.classList.toggle("has-filters", hasActiveFilters);
    renderCountyTags();

    filtered.forEach((species) => {
      const card = document.createElement("div");
      card.className = "species-card";
      card.setAttribute("data-group", species["Species Group"]);

      const sciName = species["Scientific Name"] || "Unknown";
      const comName = species["Common Name"] || "Unknown";
      const speciesFine = species["Species Group (Fine)"] || "";
      const rank = species["Global Rank"] || "";
      const status = species["U.S. Endangered Species Act Status"] || "";
      const habitat = species.Habitat || "";
      const counties = species.Counties || "";
      const bmps = species.BMPs || "";

      const imageDiv = document.createElement("div");
      imageDiv.className = "species-img";
      imageDiv.setAttribute("data-sciname", sciName);
      imageDiv.setAttribute("data-loaded", "false");
      imageDiv.textContent = "Loading image...";

      const header = document.createElement("div");
      header.className = "species-card-header";

      const headingWrap = document.createElement("div");
      headingWrap.className = "species-headings";

      const nameEl = document.createElement("h3");
      nameEl.className = "species-name";
      nameEl.textContent = comName;

      const sciEl = document.createElement("p");
      sciEl.className = "species-scientific";
      sciEl.textContent = sciName;

      const groupEl = document.createElement("p");
      groupEl.className = "species-group-fine";
      groupEl.textContent = speciesFine || "Species Group (Fine)";

      const metaRow = document.createElement("div");
      metaRow.className = "species-meta-row";
      if (rank) {
        const rankText = document.createElement("span");
        rankText.className = "species-rank";
        rankText.textContent = `Global Rank ${rank}`;
        metaRow.appendChild(rankText);
      }
      if (status) {
        const statusPill = document.createElement("span");
        statusPill.className = "meta-pill meta-pill-status";
        const normalizedStatus = status.trim().toLowerCase();
        if (normalizedStatus === "under review") {
          statusPill.classList.add("meta-pill-status-review");
        } else if (normalizedStatus === "endangered") {
          statusPill.classList.add("meta-pill-status-endangered");
        }
        statusPill.textContent = status;
        metaRow.appendChild(statusPill);
      }

      headingWrap.appendChild(nameEl);
      headingWrap.appendChild(sciEl);
      headingWrap.appendChild(groupEl);
      if (metaRow.childElementCount > 0) headingWrap.appendChild(metaRow);
      header.appendChild(headingWrap);
      header.appendChild(imageDiv);

      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "species-expand";
      expandBtn.setAttribute("aria-expanded", "false");
      expandBtn.setAttribute("aria-label", `Show details for ${comName}`);
      header.appendChild(expandBtn);

      header.addEventListener("click", () => {
        const open = card.classList.toggle("is-open");
        expandBtn.setAttribute("aria-expanded", String(open));
      });

      const details = document.createElement("div");
      details.className = "species-details";

      const detailEntries = [
        { label: "Habitat", value: habitat },
        { label: "Counties", value: counties },
        { label: "BMPs", value: bmps },
      ].filter((entry) => entry.value);

      detailEntries.forEach((entry) => {
        const detailItem = document.createElement("section");
        detailItem.className = "species-detail-item";

        const detailTitle = document.createElement("h4");
        detailTitle.textContent = entry.label;

        const detailText = document.createElement("p");
        detailText.className = "species-detail-text";
        detailText.textContent = entry.value;

        detailItem.appendChild(detailTitle);
        detailItem.appendChild(detailText);

        if (entry.value.length > 120) {
          detailText.classList.add("clamped");
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "detail-toggle";
          toggle.textContent = "More";
          toggle.addEventListener("click", () => {
            const expanded = detailText.classList.toggle("expanded");
            toggle.textContent = expanded ? "Less" : "More";
          });
          detailItem.appendChild(toggle);
        }

        details.appendChild(detailItem);
      });

      if (detailEntries.length === 0) {
        const emptyText = document.createElement("p");
        emptyText.className = "species-empty";
        emptyText.textContent = "No habitat, county, or BMP details available.";
        details.appendChild(emptyText);
      }

      card.appendChild(header);
      card.appendChild(details);

      cardContainer.appendChild(card);
      allCards.push(card);
    });

    currentPage = 1;
    renderPage();
    saveFilters();
  }

  fetch(jsonURL)
    .then((res) => res.json())
    .then((data) => {
      allSpeciesData = data;
      const groups = [...new Set(data.map((d) => d["Species Group"]))];
      const filterBar = document.getElementById("filterBar");

      groups.forEach((group) => {
        if (!group) return;
        const btn = document.createElement("button");
        btn.className = "filter-btn";
        btn.setAttribute("type", "button");
        btn.setAttribute("data-group", group);
        btn.innerHTML = `
          <img src="${icons[group] || "assets/icons/mammals.svg"}" alt="${group}" />
          <span class="filter-label" aria-hidden="true">${group}</span>
        `;
        if (selectedGroups.has(group)) btn.classList.add("active");

        btn.addEventListener("pointerenter", (event) => {
          if (event.pointerType === "mouse") btn.classList.add("is-hovered");
        });
        btn.addEventListener("pointerleave", () => btn.classList.remove("is-hovered"));

        btn.addEventListener("click", () => {
          const selectedGroup = btn.getAttribute("data-group");
          btn.classList.toggle("active");
          selectedGroups.has(selectedGroup)
            ? selectedGroups.delete(selectedGroup)
            : selectedGroups.add(selectedGroup);
          currentPage = 1;
          renderCards(allSpeciesData);
        });

        filterBar.appendChild(btn);
      });

      applySavedFilters();
      renderCards(data);
    });

  loadResourceStrip();
  updateMapModeStatus();

  document.getElementById("clearFiltersBtn").addEventListener("click", clearAllFilters);

  const countySheet = document.getElementById("countySheet");
  const countySheetPanel = countySheet.querySelector(".county-sheet-panel");
  const countyPickerTrigger = document.getElementById("countyPickerTrigger");
  const countySearch = document.getElementById("countySearch");
  const countyList = document.getElementById("countyList");
  const countySelectedCount = document.getElementById("countySelectedCount");
  const pendingCounties = new Set();

  function updatePendingCount() {
    countySelectedCount.textContent = `${pendingCounties.size} selected`;
  }

  function buildCountyRow(county) {
    const item = document.createElement("li");
    const label = document.createElement("label");
    label.className = "county-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = county;
    checkbox.checked = pendingCounties.has(county);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? pendingCounties.add(county) : pendingCounties.delete(county);
      updatePendingCount();
    });
    const name = document.createElement("span");
    name.textContent = county;
    label.append(checkbox, name);
    item.appendChild(label);
    item.dataset.county = county.toLowerCase();
    return item;
  }

  function renderCountyList() {
    const sorted = [...countyNames].sort();
    const selected = sorted.filter((county) => pendingCounties.has(county));
    const rest = sorted.filter((county) => !pendingCounties.has(county));
    countyList.replaceChildren(...selected.map(buildCountyRow));
    if (selected.length > 0 && rest.length > 0) {
      const divider = document.createElement("li");
      divider.className = "county-divider";
      divider.setAttribute("aria-hidden", "true");
      countyList.appendChild(divider);
    }
    countyList.append(...rest.map(buildCountyRow));
    updatePendingCount();
  }

  function filterCountyList() {
    const query = countySearch.value.trim().toLowerCase();
    countyList.querySelectorAll("li").forEach((item) => {
      item.hidden = item.classList.contains("county-divider")
        ? query !== ""
        : !item.dataset.county.includes(query);
    });
  }

  function openCountySheet() {
    pendingCounties.clear();
    selectedCounties.forEach((county) => pendingCounties.add(county));
    countySearch.value = "";
    renderCountyList();
    countyList.scrollTop = 0;
    countySheet.classList.add("is-open");
    document.body.classList.add("sheet-open");
    countySheetPanel.focus();
  }

  function closeCountySheet() {
    countySheet.classList.remove("is-open");
    document.body.classList.remove("sheet-open");
    countyPickerTrigger.focus();
  }

  countyPickerTrigger.addEventListener("click", openCountySheet);
  countySheet.querySelectorAll("[data-sheet-close]").forEach((el) => {
    el.addEventListener("click", closeCountySheet);
  });
  countySheet.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCountySheet();
  });
  countySearch.addEventListener("input", filterCountyList);
  document.getElementById("countySheetClear").addEventListener("click", () => {
    pendingCounties.clear();
    countyList.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = false;
    });
    updatePendingCount();
  });
  document.getElementById("countySheetApply").addEventListener("click", () => {
    selectedCounties.clear();
    pendingCounties.forEach((county) => selectedCounties.add(county));
    syncMapSelection();
    currentPage = 1;
    renderCards(allSpeciesData);
    closeCountySheet();
  });

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    renderCards(allSpeciesData);
  });

  endangeredCheckbox.addEventListener("change", () => {
    currentPage = 1;
    renderCards(allSpeciesData);
  });

  document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderPage();
    }
  });

  document.getElementById("nextPageBtn").addEventListener("click", () => {
    const totalPages = Math.ceil(allCards.length / cardsPerPage);
    if (currentPage < totalPages) {
      currentPage += 1;
      renderPage();
    }
  });

  fetch("assets/map/tennessee-county-map.svg")
    .then((res) => res.text())
    .then((svgText) => {
      const mapContainer = document.getElementById("map-container");
      mapContainer.innerHTML = svgText;
      const svg = mapContainer.querySelector("svg");
      if (!svg) return;
      mapContainer.appendChild(tooltip);

      svg.querySelectorAll("path").forEach((el) => {
        const name = el.getAttribute("id") || el.getAttribute("data-name");
        if (!name) return;
        let holdTimer = null;
        let longPressTriggered = false;

        el.classList.add("svg-county");
        el.dataset.county = name;
        countyNames.add(name);
        if (selectedCounties.has(name)) el.classList.add("selected");

        el.addEventListener("mouseover", () => {
          tooltip.style.display = "block";
          tooltip.textContent = name;
        });

        el.addEventListener("mouseout", () => {
          tooltip.style.display = "none";
        });

        el.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          longPressTriggered = false;
          if (holdTimer) clearTimeout(holdTimer);
          holdTimer = setTimeout(() => {
            longPressTriggered = true;
            setMultiSelectMode(!multiSelectMode);
          }, holdToMultiMs);
        });

        const clearHoldTimer = () => {
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
        };

        el.addEventListener("pointerup", clearHoldTimer);
        el.addEventListener("pointerleave", clearHoldTimer);
        el.addEventListener("pointercancel", clearHoldTimer);

        el.addEventListener("click", () => {
          if (longPressTriggered) {
            longPressTriggered = false;
            return;
          }

          if (multiSelectMode) {
            selectedCounties.has(name) ? selectedCounties.delete(name) : selectedCounties.add(name);
            el.classList.toggle("selected");
          } else {
            const wasOnlySelected = selectedCounties.size === 1 && selectedCounties.has(name);
            selectedCounties.clear();
            svg.querySelectorAll(".svg-county.selected").forEach((countyEl) => {
              countyEl.classList.remove("selected");
            });

            if (!wasOnlySelected) {
              selectedCounties.add(name);
              el.classList.add("selected");
            }
          }

          currentPage = 1;
          renderCards(allSpeciesData);
        });
      });
    });
});

window.addEventListener("DOMContentLoaded", () => {
  const hero = document.querySelector(".portal-hero");
  const portal = document.getElementById("search-area");
  const resultsSummary = document.getElementById("resultsSummary");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!hero || !portal || !resultsSummary) return;

  let frameQueued = false;
  const updateHeroOrbit = () => {
    if (reducedMotionQuery.matches) {
      hero.style.removeProperty("--orbit-progress");
      return;
    }
    const heroBottom = hero.offsetTop + hero.offsetHeight;
    const linear = Math.min(Math.max(window.scrollY / heroBottom, 0), 1);
    const eased = linear * linear * (3 - 2 * linear);
    hero.style.setProperty("--orbit-progress", eased.toFixed(4));
  };

  const updateResultsSummary = () => {
    const portalRect = portal.getBoundingClientRect();
    const inPortal = portalRect.top < window.innerHeight * 0.5 && portalRect.bottom > 0;
    resultsSummary.classList.toggle("in-portal", inPortal);
  };

  const update = () => {
    frameQueued = false;
    updateHeroOrbit();
    updateResultsSummary();
  };

  const queueUpdate = () => {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
  reducedMotionQuery.addEventListener("change", queueUpdate);
  update();
});
