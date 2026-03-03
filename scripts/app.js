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
  const jsonURL = "assets/data/species_by_county.json";

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

  let allSpeciesData = [];
  let allCards = [];
  let currentPage = 1;
  const cardsPerPage = 9;
  const inatPhotoCache = new Map();

  function saveFilters() {
    localStorage.setItem("selectedGroups", JSON.stringify([...selectedGroups]));
    localStorage.setItem("selectedCounties", JSON.stringify([...selectedCounties]));
    localStorage.setItem("searchQuery", searchInput.value);
    localStorage.setItem("endangeredOnly", endangeredCheckbox.checked);
  }

  function applySavedFilters() {
    searchInput.value = localStorage.getItem("searchQuery") || "";
    endangeredCheckbox.checked = localStorage.getItem("endangeredOnly") === "true";
  }

  function clearAllFilters() {
    selectedGroups.clear();
    selectedCounties.clear();
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
    const divs = document.querySelectorAll(".species-img");

    for (const div of divs) {
      const sciName = div.getAttribute("data-sciname");
      if (!sciName) {
        div.textContent = "";
        continue;
      }

      const url = await fetchInatPhotoUrl(sciName);
      if (url) {
        div.innerHTML = `<img src="${url}" alt="${sciName}" style="width:100%; border-radius:4px;">`;
      } else {
        div.textContent = "";
      }
    }
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
      imageDiv.textContent = "Loading image...";
      card.appendChild(imageDiv);

      let statusHTML = "";
      if (status === "Endangered") {
        statusHTML =
          "<p title=\"Status determined by the U.S. Endangered Species Act, published by NatureServe.\"><strong>⚠️ <span style='color:red;'>Endangered</span></strong></p>";
      } else if (status) {
        statusHTML = `<p title="Status determined by the U.S. Endangered Species Act, published by NatureServe.">⚠️ <span>${status}</span></p>`;
      }

      card.innerHTML += `
        <div class="rank-badge">${rank}</div>
        <h3>${comName}</h3>
        <p><em>${sciName}</em> | ${speciesFine}</p>
        ${statusHTML}
        ${habitat ? `<p><strong>Habitat:</strong> ${habitat}</p>` : ""}
        ${counties ? `<p><strong>Counties:</strong> ${counties}</p>` : ""}
        ${bmps ? `<p><strong>BMPs:</strong> ${bmps}</p>` : ""}
      `;

      cardContainer.appendChild(card);
      allCards.push(card);
    });

    currentPage = 1;
    renderPage();
    loadInatImages();
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

        el.addEventListener("click", () => {
          selectedCounties.has(name) ? selectedCounties.delete(name) : selectedCounties.add(name);
          el.classList.toggle("selected");
          currentPage = 1;
          renderCards(allSpeciesData);
        });
      });
    });
});
