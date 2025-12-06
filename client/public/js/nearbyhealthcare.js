const findBtn = document.getElementById("findBtn");
const statusMsg = document.getElementById("statusMsg");
const resultsSection = document.getElementById("resultsSection");
const resultsList = document.getElementById("resultsList");
const radiusSelect = document.getElementById("radiusSelect");
const paginationContainer = document.getElementById("pagination");

let allPlaces = [];
let currentPage = 1;
const itemsPerPage = 5;

function showStatus(msg, type = "info") {
	statusMsg.textContent = msg;
	statusMsg.className = "status-msg " + type;
	statusMsg.style.display = "block";
}

function clearStatus() {
	statusMsg.textContent = "";
	statusMsg.className = "status-msg";
	statusMsg.style.display = "none";
}

function renderResults(places) {
	allPlaces = places;
	currentPage = 1;
	// Save results to localStorage
	try {
		const searchData = {
			places,
			radius: radiusSelect.value,
			timestamp: Date.now(),
		};
		localStorage.setItem("nearbyHealthcareResults", JSON.stringify(searchData));
	} catch (e) {
		console.warn("Failed to save results to localStorage:", e);
	}
	renderPage();
}

function renderPage() {
	resultsList.innerHTML = "";

	if (!allPlaces || !allPlaces.length) {
		resultsList.innerHTML =
			'<div class="no-results">No healthcare providers found nearby. Try expanding your search radius.</div>';
		paginationContainer.style.display = "none";
		return;
	}

	// Calculate pagination
	const totalPages = Math.ceil(allPlaces.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentPlaces = allPlaces.slice(startIndex, endIndex);

	// Render current page items
	currentPlaces.forEach((place) => {
		const props = place.properties || {};
		const card = document.createElement("div");
		card.className = "place-card";

		let category = "Healthcare Provider";
		if (props.categories && props.categories.length > 0) {
			category = props.categories[0]
				.replace("healthcare.", "")
				.replace(/_/g, " ")
				.split(" ")
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(" ");
		}

		const address =
			props.address_line2 ||
			props.address_line1 ||
			props.formatted ||
			"Address not available";

		let distanceHTML = "";
		if (props.distance) {
			const km = (props.distance / 1000).toFixed(2);
			distanceHTML = `<span class="place-distance">📍 ${km} km away</span>`;
		}

		let phoneHTML = "";
		if (props.datasource?.raw?.phone) {
			phoneHTML = `<span class="place-phone">📞 ${props.datasource.raw.phone}</span>`;
		}

		const lat = props.lat || place.geometry?.coordinates?.[1];
		const lon = props.lon || place.geometry?.coordinates?.[0];

		card.innerHTML = `
          <div class="place-header">
            <div class="place-icon">🏥</div>
            <div>
              <div class="place-name">${
								props.name || "Unnamed Healthcare Provider"
							}</div>
              <div class="place-type">${category}</div>
            </div>
          </div>
          <div class="place-address">${address}</div>
          <div class="place-details">
            ${distanceHTML}
            ${phoneHTML}
          </div>
          <div class="place-actions">
            ${
							lat && lon
								? `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" class="btn-ghost">Open in Maps</a>`
								: ""
						}
          </div>
        `;
		resultsList.appendChild(card);
	});

	// Render pagination if needed
	if (totalPages > 1) {
		renderPagination(totalPages);
	} else {
		paginationContainer.style.display = "none";
	}

	// Scroll to top of results
	resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPagination(totalPages) {
	paginationContainer.innerHTML = "";
	paginationContainer.style.display = "flex";

	// Previous button
	const prevBtn = document.createElement("button");
	prevBtn.textContent = "←";
	prevBtn.disabled = currentPage === 1;
	prevBtn.onclick = () => {
		if (currentPage > 1) {
			currentPage--;
			renderPage();
		}
	};
	paginationContainer.appendChild(prevBtn);

	// Page info
	const pageInfo = document.createElement("span");
	pageInfo.className = "pagination-info";
	pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
	paginationContainer.appendChild(pageInfo);

	// Page buttons (show max 5 pages at a time)
	const maxVisiblePages = 5;
	let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
	let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

	if (endPage - startPage < maxVisiblePages - 1) {
		startPage = Math.max(1, endPage - maxVisiblePages + 1);
	}

	// First page if not visible
	if (startPage > 1) {
		const firstBtn = document.createElement("button");
		firstBtn.textContent = "1";
		firstBtn.onclick = () => {
			currentPage = 1;
			renderPage();
		};
		paginationContainer.appendChild(firstBtn);

		if (startPage > 2) {
			const dots = document.createElement("span");
			dots.className = "pagination-info";
			dots.textContent = "...";
			paginationContainer.appendChild(dots);
		}
	}

	// Page number buttons
	for (let i = startPage; i <= endPage; i++) {
		const pageBtn = document.createElement("button");
		pageBtn.textContent = i;
		pageBtn.className = i === currentPage ? "active" : "";
		pageBtn.onclick = () => {
			currentPage = i;
			renderPage();
		};
		paginationContainer.appendChild(pageBtn);
	}

	// Last page if not visible
	if (endPage < totalPages) {
		if (endPage < totalPages - 1) {
			const dots = document.createElement("span");
			dots.className = "pagination-info";
			dots.textContent = "...";
			paginationContainer.appendChild(dots);
		}

		const lastBtn = document.createElement("button");
		lastBtn.textContent = totalPages;
		lastBtn.onclick = () => {
			currentPage = totalPages;
			renderPage();
		};
		paginationContainer.appendChild(lastBtn);
	}

	// Next button
	const nextBtn = document.createElement("button");
	nextBtn.textContent = "→";
	nextBtn.disabled = currentPage === totalPages;
	nextBtn.onclick = () => {
		if (currentPage < totalPages) {
			currentPage++;
			renderPage();
		}
	};
	paginationContainer.appendChild(nextBtn);
}

findBtn.onclick = function () {
	clearStatus();
	resultsSection.style.display = "none";
	findBtn.disabled = true;
	findBtn.innerHTML = '<span class="loading"></span> Searching...';

	if (!navigator.geolocation) {
		showStatus("Geolocation is not supported by your browser.", "error");
		findBtn.disabled = false;
		findBtn.textContent = "Find Nearby Healthcare";
		return;
	}

	showStatus("Getting your location...", "info");

	navigator.geolocation.getCurrentPosition(
		async (pos) => {
			showStatus("Searching for nearby healthcare providers...", "info");

			try {
				const lat = pos.coords.latitude;
				const lon = pos.coords.longitude;
				const radius = radiusSelect.value;

				console.log("Location:", { lat, lon, radius });

				// Call your backend API with radius parameter
				const resp = await fetch(
					`/api/nearby-healthcare?lat=${lat}&lon=${lon}&radius=${radius}`
				);

				if (!resp.ok) {
					throw new Error(`HTTP error! status: ${resp.status}`);
				}

				const data = await resp.json();
				console.log("API Response:", data);

				if (data.success && data.places) {
					resultsSection.style.display = "block";
					renderResults(data.places);
					const radiusText =
						radiusSelect.options[radiusSelect.selectedIndex].text;
					showStatus(
						`Found ${data.count} healthcare providers within ${radiusText}`,
						"success"
					);
				} else {
					showStatus(data.error || "No results found.", "error");
				}
			} catch (err) {
				console.error("Error:", err);
				showStatus(`Failed to fetch results: ${err.message}`, "error");
			} finally {
				findBtn.disabled = false;
				findBtn.textContent = "Find Nearby Healthcare";
			}
		},
		(err) => {
			console.error("Geolocation error:", err);
			let errorMsg = "Unable to get your location. ";
			switch (err.code) {
				case err.PERMISSION_DENIED:
					errorMsg += "Please allow location access in your browser settings.";
					break;
				case err.POSITION_UNAVAILABLE:
					errorMsg += "Location information is unavailable.";
					break;
				case err.TIMEOUT:
					errorMsg += "Location request timed out.";
					break;
				default:
					errorMsg += "An unknown error occurred.";
			}
			showStatus(errorMsg, "error");
			findBtn.disabled = false;
			findBtn.textContent = "Find Nearby Healthcare";
		}
	);
};

// Restore previous results from localStorage on page load
(function restoreNearbyHealthcareResults() {
	try {
		const saved = localStorage.getItem("nearbyHealthcareResults");
		if (saved) {
			const { places, radius, timestamp } = JSON.parse(saved);
			// Optionally, only restore if less than 12 hours old
			if (
				places &&
				Array.isArray(places) &&
				(!timestamp || Date.now() - timestamp < 12 * 60 * 60 * 1000)
			) {
				radiusSelect.value = radius || radiusSelect.value;
				resultsSection.style.display = "block";
				renderResults(places);
				const radiusText =
					radiusSelect.options[radiusSelect.selectedIndex].text;
				showStatus(
					`Showing your last search: ${places.length} healthcare providers within ${radiusText}`,
					"info"
				);
			}
		}
	} catch (e) {
		console.warn("Failed to restore results from localStorage:", e);
	}
})();
