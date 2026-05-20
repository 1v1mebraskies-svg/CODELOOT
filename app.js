js
(function () {
    const games = {
        "blox fruits": "blox-fruits.html",
        "king legacy": "king-legacy.html",
        "anime defenders": "anime-defenders.html",
        "fruit battlegrounds": "fruit-battlegrounds.html",
        "blade ball": "blade-ball.html",
        "anime warriors": "anime-warriors.html",
        "anime warriors 3": "anime-warriors.html",
        "blue lock rivals": "blue-lock-rivals.html",
        "type soul": "type-soul.html",
        "untitled boxing game": "untitled-boxing-game.html"
    };

    const siteRoot = document.body.dataset.siteRoot || ".";

    function gameUrl(fileName) {
        return `${siteRoot}/games/${fileName}`;
    }

    function setupSearch() {
        const searchForms = document.querySelectorAll("[data-site-search]");
        const gameCards = document.querySelectorAll("[data-game-card]");
        const emptyState = document.querySelector("[data-search-empty]");

        searchForms.forEach(function (form) {
            const input = form.querySelector("[data-game-search]");

            if (!input) {
                return;
            }

            input.addEventListener("input", function () {
                const query = input.value.trim().toLowerCase();
                let visibleCount = 0;

                gameCards.forEach(function (card) {
                    const gameName = card.dataset.gameName.toLowerCase();
                    const isVisible = gameName.includes(query);

                    card.classList.toggle("is-hidden", !isVisible);

                    if (isVisible) {
                        visibleCount += 1;
                    }
                });

                if (emptyState) {
                    emptyState.hidden = visibleCount !== 0;
                }
            });

            form.addEventListener("submit", function (event) {
                event.preventDefault();

                const query = input.value.trim().toLowerCase();

                if (games[query]) {
                    window.location.href = gameUrl(games[query]);
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