export const CatalogueManager = {
    currentCatalogueId: "default",

    getContainerKey(isLoggedIn) {
        return isLoggedIn ? 'catalogues_pro' : 'catalogues_guest';
    },

    getLimit(isLoggedIn) {
        return isLoggedIn ? 10000 : 10;
    },

    init(cb) {
        // Just ensures the structure exists, logic is mainly in load/add
        cb();
    },

    loadCatalogues(isLoggedIn, selectElement, limitMsgElement, renderCallback) {
        const key = this.getContainerKey(isLoggedIn);
        chrome.storage.local.get([key], (data) => {
            let container = data[key];

            if (!container) {
                container = { "default": { name: "Main Catalogue", items: [], template: [] } };
                chrome.storage.local.set({ [key]: container });
            }

            // Populate Select
            selectElement.innerHTML = "";
            Object.keys(container).forEach(id => {
                const opt = document.createElement("option");
                opt.value = id;
                opt.textContent = container[id].name;
                selectElement.appendChild(opt);
            });

            if (!container[this.currentCatalogueId]) this.currentCatalogueId = "default";
            selectElement.value = this.currentCatalogueId;

            const activeList = container[this.currentCatalogueId];
            renderCallback(activeList ? activeList.items : []);

            if (limitMsgElement) {
                if (isLoggedIn) {
                    limitMsgElement.style.display = 'none';
                } else {
                    limitMsgElement.style.display = 'block';
                    limitMsgElement.textContent = `Limit: 10 (Free)`;
                }
            }
        });
    },

    createCatalogue(name, isLoggedIn, cb) {
        const key = this.getContainerKey(isLoggedIn);
        chrome.storage.local.get([key], (data) => {
            const container = data[key] || {};
            const id = "cat_" + Date.now();
            container[id] = { name: name, items: [], template: [] };
            chrome.storage.local.set({ [key]: container }, () => {
                this.currentCatalogueId = id;
                if(cb) cb();
            });
        });
    },

    renameCatalogue(name, isLoggedIn, cb) {
        const key = this.getContainerKey(isLoggedIn);
        chrome.storage.local.get([key], (data) => {
            const container = data[key];
            if (container && container[this.currentCatalogueId]) {
                container[this.currentCatalogueId].name = name;
                chrome.storage.local.set({ [key]: container }, cb);
            }
        });
    },

    deleteCatalogue(isLoggedIn, cb) {
        const key = this.getContainerKey(isLoggedIn);
        chrome.storage.local.get([key], (data) => {
            const container = data[key];
            delete container[this.currentCatalogueId];
            this.currentCatalogueId = Object.keys(container)[0] || "default";
            if(!container[this.currentCatalogueId]) {
                 // Ensure at least one exists
                 container["default"] = { name: "Main Catalogue", items: [], template: [] };
                 this.currentCatalogueId = "default";
            }
            chrome.storage.local.set({ [key]: container }, cb);
        });
    },

    addToCatalogue(items, isLoggedIn, cb, targetId = null) {
        const key = this.getContainerKey(isLoggedIn);
        const catId = targetId || this.currentCatalogueId;

        chrome.storage.local.get([key], (data) => {
            let container = data[key] || { "default": { name: "Main Catalogue", items: [], template: [] } };
            if (!container[catId]) container[catId] = { name: "Default", items: [], template: [] };

            let list = container[catId].items;
            const limit = this.getLimit(isLoggedIn);
            let addedCount = 0;

            items.forEach(newItem => {
                const existingIndex = list.findIndex(i => i.asin === newItem.asin);
                if (existingIndex === -1 && list.length >= limit) return;

                const timestamp = Date.now();
                const historyEntry = {
                    date: timestamp,
                    price: newItem.initialPrice,
                    title: newItem.expected ? newItem.expected.title : null
                };

                if (existingIndex > -1) {
                    const existing = list[existingIndex];
                    const newHistory = existing.history ? [...existing.history, historyEntry] : [historyEntry];
                    if (newHistory.length > 5) newHistory.shift();
                    list[existingIndex] = { ...existing, ...newItem, history: newHistory, lastScan: existing.lastScan || null };
                } else {
                    list.push({ ...newItem, history: [historyEntry], lastScan: null });
                    addedCount++;
                }
            });

            container[catId].items = list;
            chrome.storage.local.set({ [key]: container }, () => {
                if(cb) cb(addedCount);
            });
        });
    },

    removeFromCatalogue(asin, isLoggedIn, cb) {
        const key = this.getContainerKey(isLoggedIn);
        chrome.storage.local.get([key], (data) => {
            let container = data[key];
            if (container && container[this.currentCatalogueId]) {
                container[this.currentCatalogueId].items = container[this.currentCatalogueId].items.filter(item => item.asin !== asin);
                chrome.storage.local.set({ [key]: container }, cb);
            }
        });
    },

    clearCatalogue(isLoggedIn, cb) {
        const key = this.getContainerKey(isLoggedIn);
        chrome.storage.local.get([key], (data) => {
            let container = data[key];
            if (container && container[this.currentCatalogueId]) {
                container[this.currentCatalogueId].items = [];
                chrome.storage.local.set({ [key]: container }, cb);
            }
        });
    },

    updateAfterScan(results, isLoggedIn, cb) {
        const key = this.getContainerKey(isLoggedIn);
        chrome.storage.local.get([key], (data) => {
            const container = data[key];
            if(!container || !container[this.currentCatalogueId]) return;
            let list = container[this.currentCatalogueId].items;

            list = list.map(item => {
                const result = results.find(r => r.url === item.url || (r.attributes && r.attributes.mediaAsin === item.asin));
                if (result) {
                    const now = Date.now();
                    let status = 'OK';
                    let priceChange = false;
                    if (result.error) status = 'ERROR';
                    else {
                        const lqs = parseInt(result.attributes.lqs);
                        if (lqs < 70) status = 'ISSUE';
                        if (item.expected && item.expected.title && result.attributes.metaTitle !== item.expected.title) status = 'ISSUE';
                        if (item.initialPrice && result.attributes.displayPrice !== 'none' && result.attributes.displayPrice !== item.initialPrice) priceChange = true;
                    }
                    return { ...item, lastScan: { date: now, status, priceChange, lastLqs: result.attributes.lqs } };
                }
                return item;
            });
            container[this.currentCatalogueId].items = list;
            chrome.storage.local.set({ [key]: container }, cb);
        });
    }
};
