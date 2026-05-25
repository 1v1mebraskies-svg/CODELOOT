(function () {
    const D = window.CodeLootData;
    const siteRoot = document.body.dataset.siteRoot || '.';

    function gameUrl(slug) {
        return siteRoot + '/games/' + slug + '.html';
    }

    let gamesCatalog = [];

    function renderCodeCard(code) {
        const esc = D.escapeHtml;
        return (
            '<article class="code-card">' +
            '<div><h3>' + esc(code.code) + '</h3><p>' + esc(code.reward) + '</p></div>' +
            '<button class="copy-button" type="button" data-code="' + esc(code.code) + '">Copy</button>' +
            '</article>'
        );
    }

    function hydrateGamePage(game) {
        const grid = document.querySelector('.code-grid');
        if (!grid || !game) return;

        const activeCodes = (game.codes || []).filter(function (c) {
            return c.status === 'active';
        });

        const expiredCodes = (game.codes || []).filter(function (c) {
            return c.status === 'expired';
        });

        grid.innerHTML = activeCodes.map(renderCodeCard).join('');

        // Update active codes stat
        const statValue = document.querySelector('.game-stats .stat-card .stat-value');
        if (statValue) {
            statValue.textContent = String(activeCodes.length);
        }

        // Update expired codes stat if it exists
        const expiredStatValue = document.querySelector('.game-stats .stat-card:nth-child(2) .stat-value');
        if (expiredStatValue) {
            expiredStatValue.textContent = String(expiredCodes.length);
        }

        // Update banner description
        const bannerDesc = document.querySelector('.game-banner-copy p:last-of-type');
        if (bannerDesc) {
            bannerDesc.textContent = game.long_description || game.description || '';
        }

        // Update banner image
        const bannerImg = document.querySelector('.game-banner img');
        if (bannerImg) {
            bannerImg.src = D.gameImageSrc(game, siteRoot);
        }

        // Show/hide no codes message
        const noCodes = document.querySelector('.no-codes');
        if (noCodes) {
            noCodes.hidden = activeCodes.length > 0;
        }

        // Add expired codes section if there are expired codes
        addExpiredCodesSection(expiredCodes);

        // Update how to redeem section
        updateHowToRedeemSection(game);

        // Add FAQ section
        addFAQSection(game);

        // Add internal links section
        addInternalLinksSection(game);

        // Update last checked date
        updateLastCheckedDate(game);

        setupCopyButtons();
    }

    function renderExpiredCodeCard(code) {
        const esc = D.escapeHtml;
        return (
            '<article class="code-card expired-code-card">' +
            '<div><h3>' + esc(code.code) + '</h3><p>' + esc(code.reward) + '</p></div>' +
            '<span class="status-badge expired">Expired</span>' +
            '</article>'
        );
    }

    function addExpiredCodesSection(expiredCodes) {
        // Remove existing expired codes section if any
        const existingSection = document.querySelector('.expired-codes-section');
        if (existingSection) {
            existingSection.remove();
        }

        if (!expiredCodes || expiredCodes.length === 0) {
            return;
        }

        const contentMain = document.querySelector('.content-main');
        if (!contentMain) return;

        const expiredSection = document.createElement('section');
        expiredSection.className = 'expired-codes-section';
        expiredSection.innerHTML = 
            '<div class="panel-heading">' +
            '<p class="eyebrow">Expired codes</p>' +
            '<h2>No longer working</h2>' +
            '<p>These codes have expired and no longer work.</p>' +
            '</div>' +
            '<div class="code-grid expired-codes-grid">' +
            expiredCodes.map(renderExpiredCodeCard).join('') +
            '</div>';

        contentMain.appendChild(expiredSection);
    }

    function updateHowToRedeemSection(game) {
        const checklistSection = document.querySelector('.side-panel');
        if (!checklistSection) return;

        const instructions = game.redeem_instructions || [];
        if (instructions.length === 0) {
            // Keep default checklist if no custom instructions
            return;
        }

        const checkList = checklistSection.querySelector('.check-list');
        if (!checkList) return;

        checkList.innerHTML = instructions.map(function(step) {
            return '<li>' + D.escapeHtml(step) + '</li>';
        }).join('');
    }

    function addFAQSection(game) {
        // Remove existing FAQ section if any
        const existingSection = document.querySelector('.faq-section');
        if (existingSection) {
            existingSection.remove();
        }

        const sidebarStack = document.querySelector('.sidebar-stack');
        if (!sidebarStack) return;

        const faqSection = document.createElement('section');
        faqSection.className = 'side-panel card faq-section';
        faqSection.innerHTML = 
            '<p class="eyebrow">FAQ</p>' +
            '<h2>Frequently Asked Questions</h2>' +
            '<div class="faq-list">' +
            '<div class="faq-item">' +
            '<h3>How often are codes updated?</h3>' +
            '<p>Codes are verified and updated regularly. Check back often for new rewards.</p>' +
            '</div>' +
            '<div class="faq-item">' +
            '<h3>What if a code doesn\'t work?</h3>' +
            '<p>Make sure you enter the code exactly as shown, including capitalization. Codes are case-sensitive and may expire.</p>' +
            '</div>' +
            '<div class="faq-item">' +
            '<h3>Can I use codes more than once?</h3>' +
            '<p>Most codes can only be redeemed once per account. Check the game\'s official announcements for exceptions.</p>' +
            '</div>' +
            '</div>';

        sidebarStack.appendChild(faqSection);
    }

    function addInternalLinksSection(game) {
        // Remove existing internal links section if any
        const existingSection = document.querySelector('.internal-links-section');
        if (existingSection) {
            existingSection.remove();
        }

        const sidebarStack = document.querySelector('.sidebar-stack');
        if (!sidebarStack) return;

        const internalLinksSection = document.createElement('section');
        internalLinksSection.className = 'side-panel card internal-links-section';
        internalLinksSection.innerHTML = 
            '<p class="eyebrow">Quick links</p>' +
            '<h2>Internal Links</h2>' +
            '<ul class="internal-links-list">' +
            '<li><a href="../index.html">All Games</a></li>' +
            '<li><a href="../about.html">About CodeLoot</a></li>' +
            '<li><a href="../contact.html">Contact Us</a></li>' +
            '<li><a href="../privacy-policy.html">Privacy Policy</a></li>' +
            '</ul>';

        sidebarStack.appendChild(internalLinksSection);
    }

    function updateLastCheckedDate(game) {
        const updateDate = game.update_date || game.updated_at;
        const dateElements = document.querySelectorAll('.game-stats .stat-card:nth-child(3) .stat-value');
        
        if (updateDate && dateElements.length > 0) {
            const formattedDate = new Date(updateDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            dateElements[0].textContent = formattedDate;
        }
    }

    function syncCardFromGame(card, game) {
        const count = D.activeCodeCount(game);
        const siteRootPath = siteRoot === '.' ? '' : siteRoot;

        card.href = siteRootPath + '/games/' + game.slug + '.html';
        card.dataset.gameName = game.name;
        card.dataset.gameSlug = game.slug;
        card.dataset.searchSlug = game.slug.toLowerCase();
        card.dataset.searchDescription = (game.description || '').toLowerCase();
        card.dataset.searchKeywords = D.gameSearchText(game);

        const metaSpans = card.querySelectorAll('.card-meta span, .featured-card-copy > span');
        if (metaSpans.length) {
            metaSpans[0].textContent = count + ' active';
            if (count === 0 && metaSpans[1]) {
                metaSpans[1].textContent = 'No code box yet';
            }
        }

        const featuredSpan = card.querySelector('.featured-card-copy > span');
        if (featuredSpan && card.classList.contains('featured-card')) {
            featuredSpan.textContent = count + ' verified codes';
        }

        const desc = card.querySelector('.game-card-body p, .featured-card-copy p');
        if (desc) {
            desc.textContent = game.short_description || game.description || '';
        }

        const cardImg = card.querySelector('img');
        if (cardImg) {
            cardImg.src = D.gameImageSrc(game, siteRoot);
        }

        const title = card.querySelector('h3');
        if (title) {
            title.textContent = game.name;
        }
    }

    function buildGameCard(game, featured) {
        const siteRootPath = siteRoot === '.' ? '' : siteRoot;
        const count = D.activeCodeCount(game);
        const img = 'assets/img/' + D.gameImageFile(game);
        const esc = D.escapeHtml;
        const cardClass = featured ? 'featured-card card' : 'game-card card';

        if (featured) {
            return (
                '<a class="' + cardClass + '" href="' + siteRootPath + '/games/' + esc(game.slug) + '.html" ' +
                'data-game-card data-game-name="' + esc(game.name) + '" data-game-slug="' + esc(game.slug) + '">' +
                '<img src="' + siteRootPath + '/' + img + '" onerror="this.src=\'' + siteRootPath + '/assets/img/code-loot-hero.png\'" alt="' + esc(game.name) + ' banner">' +
                '<div class="featured-card-copy"><span>' + count + ' verified codes</span>' +
                '<h3>' + esc(game.name) + '</h3><p>' + esc(game.description) + '</p></div></a>'
            );
        }

        return (
            '<a class="' + cardClass + '" href="' + siteRootPath + '/games/' + esc(game.slug) + '.html" ' +
            'data-game-card data-game-name="' + esc(game.name) + '" data-game-slug="' + esc(game.slug) + '">' +
            '<img src="' + siteRootPath + '/' + img + '" onerror="this.src=\'' + siteRootPath + '/assets/img/code-loot-hero.png\'" alt="' + esc(game.name) + ' banner">' +
            '<div class="game-card-body"><div class="card-meta"><span>' + count + ' active</span><span>Verified</span></div>' +
            '<h3>' + esc(game.name) + '</h3><p>' + esc(game.description) + '</p>' +
            '<span class="text-link">' + (count > 0 ? 'View codes' : 'View status') + '</span></div></a>'
        );
    }

    function gridForCategory(category) {
        const sectionMap = {
            anime: 'Anime Games',
            pvp: 'PvP Games',
            rng: 'RNG',
            horror: 'Horror',
        };
        const label = sectionMap[category];
        if (!label) return document.querySelector('.game-grid');

        const sections = document.querySelectorAll('section.section, section.featured-games');
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const heading = section.querySelector('h2, .featured-heading h2');
            const aria = section.getAttribute('aria-label') || '';
            if ((heading && heading.textContent.indexOf(label) !== -1) || aria.indexOf(label) !== -1) {
                return section.querySelector('.game-grid, .featured-grid');
            }
        }
        return document.querySelector('.game-grid');
    }

    function syncHomepage(games) {
        const activeGames = games.filter(function (g) {
            return g.active !== false;
        });
        const slugsOnPage = new Set();

        document.querySelectorAll('[data-game-card]').forEach(function (card) {
            const slug = D.slugFromHref(card.getAttribute('href'));
            if (!slug) return;
            slugsOnPage.add(slug);
            const game = D.findGameBySlug(activeGames, slug);
            if (game) {
                syncCardFromGame(card, game);
            }
        });

        activeGames.forEach(function (game) {
            if (slugsOnPage.has(game.slug)) return;

            const grid = game.featured
                ? document.querySelector('.featured-grid')
                : gridForCategory(game.category);
            if (!grid) return;

            grid.insertAdjacentHTML('beforeend', buildGameCard(game, !!game.featured));
            slugsOnPage.add(game.slug);
        });
    }

    function setupSearch(games) {
        const searchForms = document.querySelectorAll('[data-site-search]');
        gamesCatalog = games || [];

        function initializeGameCards() {
            document.querySelectorAll('[data-game-card]').forEach(function (card) {
                const gameName = card.dataset.gameName || '';
                const slug = card.dataset.gameSlug || D.slugFromHref(card.getAttribute('href')) || '';
                const titleEl = card.querySelector('h3');
                const title = titleEl ? titleEl.textContent.trim() : '';
                const descEl = card.querySelector('p');
                const description = descEl ? descEl.textContent.trim() : '';
                const imgEl = card.querySelector('img');
                const imgAlt = imgEl ? imgEl.alt : '';
                const metaEl = card.querySelector('.card-meta');
                const meta = metaEl ? metaEl.textContent.trim() : '';
                const linkEl = card.querySelector('.text-link');
                const linkText = linkEl ? linkEl.textContent.trim() : '';
                const game = D.findGameBySlug(gamesCatalog, slug);
                const jsonText = game ? D.gameSearchText(game) : '';

                const allKeywords = (gameName + ' ' + slug + ' ' + title + ' ' + description + ' ' + imgAlt + ' ' + meta + ' ' + linkText + ' ' + jsonText).toLowerCase();

                card.dataset.searchTitle = title.toLowerCase();
                card.dataset.searchDescription = description.toLowerCase();
                card.dataset.searchKeywords = allKeywords;
            });
        }

        function getSearchableText(card) {
            return (card.dataset.searchKeywords || '').toLowerCase();
        }

        function getAllGameCards() {
            return document.querySelectorAll('[data-game-card]');
        }

        function getAllGameSections() {
            return document.querySelectorAll('section.section, section.featured-games');
        }

        function updateSectionVisibility() {
            getAllGameSections().forEach(function (section) {
                const cardsInSection = section.querySelectorAll('[data-game-card]');
                let hasVisibleCards = false;
                cardsInSection.forEach(function (card) {
                    if (!card.classList.contains('is-hidden')) {
                        hasVisibleCards = true;
                    }
                });
                section.classList.toggle('is-hidden', !hasVisibleCards);
            });
        }

        function updateGameList() {
            const gameList = document.querySelector('#game-list');
            if (!gameList) return;
            gameList.innerHTML = '';
            const names = new Set();
            gamesCatalog.forEach(function (game) {
                if (game.active !== false) names.add(game.name);
            });
            getAllGameCards().forEach(function (card) {
                if (card.dataset.gameName) names.add(card.dataset.gameName);
            });
            names.forEach(function (name) {
                const option = document.createElement('option');
                option.value = name;
                gameList.appendChild(option);
            });
        }

        function filterCards(query) {
            const gameCards = getAllGameCards();
            let visibleCount = 0;

            if (gameCards.length === 0 && query && gamesCatalog.length) {
                return filterCatalogOnly(query);
            }

            gameCards.forEach(function (card) {
                const searchableText = getSearchableText(card);
                const isVisible = !query || searchableText.includes(query);
                card.classList.toggle('is-hidden', !isVisible);
                if (isVisible) visibleCount += 1;
            });

            updateSectionVisibility();
            return visibleCount;
        }

        function filterCatalogOnly(query) {
            const matches = gamesCatalog.filter(function (game) {
                return game.active !== false && D.gameSearchText(game).includes(query);
            });
            return matches.length;
        }

        function findFirstMatch(query) {
            const cards = getAllGameCards();
            
            // First try to find exact match by game name
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const gameName = (card.dataset.gameName || '').toLowerCase();
                if (gameName === query) {
                    return { href: card.href };
                }
            }
            
            // Then try to find partial match in visible cards
            for (let i = 0; i < cards.length; i++) {
                if (!cards[i].classList.contains('is-hidden')) {
                    return { href: cards[i].href };
                }
            }
            
            // Fallback to games catalog
            if (!query) return null;
            const game = gamesCatalog.find(function (g) {
                return g.active !== false && D.gameSearchText(g).includes(query);
            });
            return game ? { href: gameUrl(game.slug) } : null;
        }

        function updateEmptyState(query, visibleCount) {
            const emptyState = document.querySelector('[data-search-empty]');
            if (!emptyState) return;
            emptyState.hidden = visibleCount !== 0 || !query;
        }

        initializeGameCards();
        updateGameList();

        searchForms.forEach(function (form) {
            const input = form.querySelector('[data-game-search]');
            const button = form.querySelector('#search-button');
            if (!input) return;

            input.addEventListener('input', function () {
                const query = input.value.trim().toLowerCase();
                const visibleCount = filterCards(query);
                updateEmptyState(query, visibleCount);
            });

            // Handle button click for search
            if (button) {
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    const query = input.value.trim().toLowerCase();
                    if (!query) return;
                    const match = findFirstMatch(query);
                    if (match && match.href) {
                        window.location.href = match.href;
                    } else {
                        // If no match found, show alert
                        alert('No game found matching: ' + input.value);
                    }
                });
            }

            // Handle Enter key in input
            input.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const query = input.value.trim().toLowerCase();
                    if (!query) return;
                    const match = findFirstMatch(query);
                    if (match && match.href) {
                        window.location.href = match.href;
                    } else {
                        alert('No game found matching: ' + input.value);
                    }
                }
                if (event.key === 'Escape') {
                    input.value = '';
                    filterCards('');
                    updateEmptyState('', -1);
                }
            });
        });
    }

    function fallbackCopy(text) {
        return new Promise(function (resolve) {
            const helper = document.createElement('textarea');
            helper.value = text;
            helper.className = 'clipboard-helper';
            document.body.appendChild(helper);
            helper.select();
            document.execCommand('copy');
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
        document.querySelectorAll('[data-code]').forEach(function (button) {
            if (button.dataset.copyBound) return;
            button.dataset.copyBound = '1';
            button.addEventListener('click', function () {
                const code = button.dataset.code;
                const defaultText = button.dataset.defaultText || button.textContent;
                copyWithFallback(code).then(function () {
                    button.textContent = 'Copied';
                    button.classList.add('is-copied');
                    window.setTimeout(function () {
                        button.textContent = defaultText;
                        button.classList.remove('is-copied');
                    }, 1400);
                });
            });
        });
    }

    function setupContactForm() {
        const contactForm = document.getElementById('contact-form');
        if (!contactForm) return;

        contactForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const name = contactForm.querySelector('#name').value.trim();
            const email = contactForm.querySelector('#email').value.trim();
            const subject = contactForm.querySelector('#subject').value.trim();
            const message = contactForm.querySelector('#message').value.trim();

            if (!name || !email || !subject || !message) {
                alert('Please fill in all fields.');
                return;
            }

            const mailtoLink = 'mailto:hello@codeloot.codes?subject=' +
                encodeURIComponent('[CodeLoot Contact] ' + subject) +
                '&body=' +
                encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\nMessage:\n' + message);

            window.location.href = mailtoLink;
        });
    }

    async function init() {
        if (!D) {
            setupCopyButtons();
            setupContactForm();
            return;
        }

        const data = await D.loadGamesData();
        const games = data.games || [];
        const slug = D.getSlugFromPath(window.location.pathname);

        if (slug) {
            const game = D.findGameBySlug(games, slug);
            hydrateGamePage(game);
        }

        if (document.querySelector('[data-game-card]') || document.querySelector('.featured-grid')) {
            syncHomepage(games);
        }

        setupSearch(games);
        setupCopyButtons();
        setupContactForm();
    }

    init();
}());
