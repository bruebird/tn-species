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
  };

  let allSpeciesData = [];
  let allCards = [];
  let currentPage = 1;
  const cardsPerPage = 9;
  const inatPhotoCache = new Map();
  const holdToMultiMs = 500;
  let multiSelectMode = false;

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

  function renderPage() {
    const totalPages = Math.max(1, Math.ceil(allCards.length / cardsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * cardsPerPage;
    const end = start + cardsPerPage;

    allCards.forEach((card, index) => {
      card.style.display = index >= start && index < end ? "block" : "none";
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
        const rankPill = document.createElement("span");
        rankPill.className = "meta-pill meta-pill-rank";
        rankPill.textContent = `Global Rank ${rank}`;
        metaRow.appendChild(rankPill);
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
          <div class="filter-label">${group.includes("&") ? group.replace(" & ", "<br>& ") : group}</div>
        `;
        if (selectedGroups.has(group)) btn.classList.add("active");

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
      document.getElementById("map-container").innerHTML = svgText;
      const svg = document.querySelector("#map-container svg");
      if (!svg) return;

      svg.querySelectorAll("path").forEach((el) => {
        const name = el.getAttribute("id") || el.getAttribute("data-name");
        if (!name) return;
        let holdTimer = null;
        let longPressTriggered = false;

        el.classList.add("svg-county");
        if (selectedCounties.has(name)) el.classList.add("selected");

        el.addEventListener("mouseover", () => {
          tooltip.style.display = "block";
          tooltip.textContent = name;
        });

        el.addEventListener("mousemove", (event) => {
          tooltip.style.left = `${event.pageX + 10}px`;
          tooltip.style.top = `${event.pageY + 10}px`;
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
