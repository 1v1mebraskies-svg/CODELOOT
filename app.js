(function () {
    const siteRoot = document.body.dataset.siteRoot || ".";

    function gameUrl(fileName) {
        return `${siteRoot}/games/${fileName}`;
    }

    function setupSearch() {
        const searchForms = document.querySelectorAll("[data-site-search]");
        
        // Initialize all game cards with searchable data attributes
        function initializeGameCards() {
            const gameCards = document.querySelectorAll("[data-game-card]");
            
            gameCards.forEach(function (card) {
                // Extract data to be searchable
                const gameName = card.dataset.gameName || "";
                
                // Get title from h3
                const titleEl = card.querySelector("h3");
                const title = titleEl ? titleEl.textContent.trim() : "";
                
                // Get description from p tag
                const descEl = card.querySelector("p");
                const description = descEl ? descEl.textContent.trim() : "";
                
                // Get image alt text
                const imgEl = card.querySelector("img");
                const imgAlt = imgEl ? imgEl.alt : "";
                
                // Get metadata/rewards info
                const metaEl = card.querySelector(".card-meta");
                const meta = metaEl ? metaEl.textContent.trim() : "";
                
                // Get link text
                const linkEl = card.querySelector(".text-link");
                const linkText = linkEl ? linkEl.textContent.trim() : "";
                
                // Combine everything into searchable keywords
                const allKeywords = `${gameName} ${title} ${description} ${imgAlt} ${meta} ${linkText}`.toLowerCase();
                
                // Store as data attributes
                card.dataset.searchTitle = title.toLowerCase();
                card.dataset.searchDescription = description.toLowerCase();
                card.dataset.searchKeywords = allKeywords;
            });
        }

        /**
         * Extract all searchable text from a game card
         */
        function getSearchableText(card) {
            const keywords = card.dataset.searchKeywords || "";
            return keywords.toLowerCase();
        }

        /**
         * Get all game cards on the page
         */
        function getAllGameCards() {
            return document.querySelectorAll("[data-game-card]");
        }

        /**
         * Get all game sections (Anime Games, PvP Games, etc.)
         */
        function getAllGameSections() {
            return document.querySelectorAll("section.section, section.featured-games");
        }

        /**
         * Update visibility of sections based on visible cards within
         */
        function updateSectionVisibility() {
            const sections = getAllGameSections();
            
            sections.forEach(function (section) {
                const cardsInSection = section.querySelectorAll("[data-game-card]");
                let hasVisibleCards = false;
                
                cardsInSection.forEach(function (card) {
                    if (!card.classList.contains("is-hidden")) {
                        hasVisibleCards = true;
                    }
                });
                
                // Hide section if no visible cards
                section.classList.toggle("is-hidden", !hasVisibleCards);
            });
        }

        /**
         * Update the datalist with current games
         */
        function updateGameList() {
            const gameList = document.querySelector("#game-list");
            if (!gameList) return;

            gameList.innerHTML = "";

            const gameNames = new Set();
            getAllGameCards().forEach(function (card) {
                const gameName = card.dataset.gameName;
                if (gameName) {
                    gameNames.add(gameName);
                }
            });

            gameNames.forEach(function (name) {
                const option = document.createElement("option");
                option.value = name;
                gameList.appendChild(option);
            });
        }

        /**
         * Filter game cards based on search query
         */
        function filterCards(query) {
            const gameCards = getAllGameCards();
            let visibleCount = 0;

            gameCards.forEach(function (card) {
                const searchableText = getSearchableText(card);
                
                // Show card if no query or query matches searchable text
                const isVisible = !query || searchableText.includes(query);

                card.classList.toggle("is-hidden", !isVisible);

                if (isVisible) {
                    visibleCount += 1;
                }
            });
            
            // Update section visibility
            updateSectionVisibility();
            
            return visibleCount;
        }

        /**
         * Show or hide the empty state message
         */
        function updateEmptyState(query, visibleCount) {
            const emptyState = document.querySelector("[data-search-empty]");
            if (!emptyState) return;
            
            // Show empty state only if there's a query and no results
            emptyState.hidden = visibleCount !== 0 || !query;
        }

        // Initialize search on page load
        initializeGameCards();
        updateGameList();

        // Setup search functionality for each search form
        searchForms.forEach(function (form) {
            const input = form.querySelector("[data-game-search]");

            if (!input) {
                return;
            }

            /**
             * Handle search input - live filtering
             */
            input.addEventListener("input", function () {
                const query = input.value.trim().toLowerCase();
                const visibleCount = filterCards(query);
                updateEmptyState(query, visibleCount);
            });

            /**
             * Handle form submission - navigate to first matching game
             */
            form.addEventListener("submit", function (event) {
                event.preventDefault();

                const query = input.value.trim().toLowerCase();
                if (!query) return;

                const gameCards = getAllGameCards();
                let foundCard = null;

                for (let i = 0; i < gameCards.length; i++) {
                    const card = gameCards[i];
                    if (!card.classList.contains("is-hidden")) {
                        foundCard = card;
                        break;
                    }
                }

                if (foundCard) {
                    window.location.href = foundCard.href;
                }
            });

            /**
             * Clear search with Escape key
             */
            input.addEventListener("keydown", function (event) {
                if (event.key === "Escape") {
                    input.value = "";
                    filterCards("");
                    updateEmptyState("", -1);
                }
            });
        });
    }

    function fallbackCopy(text) {
        return new Promise(function (resolve) {
            const helper = document.createElement("textarea");

            helper.value = text;
            helper.className = "clipboard-helper";

            document.body.appendChild(helper);
            helper.select();
            document.execCommand("copy");
            helper.remove();

            resolve();
        });
    }

    function copyWithFallback(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).catch(function () {
                return fallbackCopy(text);
            });
        }

        return fallbackCopy(text);
    }

    function setupCopyButtons() {
        const copyButtons = document.querySelectorAll("[data-code]");

        copyButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                const code = button.dataset.code;
                const defaultText = button.dataset.defaultText || button.textContent;

                copyWithFallback(code).then(function () {
                    button.textContent = "Copied";
                    button.classList.add("is-copied");

                    window.setTimeout(function () {
                        button.textContent = defaultText;
                        button.classList.remove("is-copied");
                    }, 1400);
                });
            });
        });
    }

    function setupContactForm() {
        const contactForm = document.getElementById("contact-form");

        if (!contactForm) {
            return;
        }

        contactForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const name = contactForm.querySelector("#name").value.trim();
            const email = contactForm.querySelector("#email").value.trim();
            const subject = contactForm.querySelector("#subject").value.trim();
            const message = contactForm.querySelector("#message").value.trim();

            if (!name || !email || !subject || !message) {
                alert("Please fill in all fields.");
                return;
            }

            const mailtoLink = "mailto:hello@codeloot.codes?subject=" + 
                encodeURIComponent("[CodeLoot Contact] " + subject) +
                "&body=" + 
                encodeURIComponent("Name: " + name + "\nEmail: " + email + "\n\nMessage:\n" + message);

            window.location.href = mailtoLink;
        });
    }

    setupSearch();
    setupCopyButtons();
    setupContactForm();
}());
