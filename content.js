(async function() {
  try {
    // --- 0. Helper Functions ---
    const cleanImageUrl = (url) => {
      if (!url || url === "none") return "none";
      return url.replace(/\._[A-Z0-9,._-]+(\.[a-z]+)$/i, '$1');
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper to safely extract a JSON array from a JS string by counting brackets
    const extractJsonArray = (str, startSearchIndex) => {
        const openBracketIndex = str.indexOf('[', startSearchIndex);
        if (openBracketIndex === -1) return null;

        let bracketCount = 0;
        let endIndex = -1;
        let started = false;

        // Iterate character by character to find the matching closing bracket
        for (let i = openBracketIndex; i < str.length; i++) {
            const char = str[i];
            if (char === '[') {
                if (!started) started = true;
                bracketCount++;
            } else if (char === ']') {
                bracketCount--;
            }

            if (started && bracketCount === 0) {
                endIndex = i + 1;
                break;
            }
        }

        if (endIndex !== -1) {
            return str.substring(openBracketIndex, endIndex);
        }
        return null;
    };

    // --- 1. Expand Bullets (Async Interaction) ---
    // Commented out as per request
    /*
    const expander = document.querySelector('div[id*="feature-bullets"] .a-expander-prompt');
    if (expander) {
        expander.click();
        await sleep(500);
    }
    */

    // --- 2. Robust Page Detection ---
    if (document.title.includes("Robot Check") || document.querySelector("form[action*='/errors/validateCaptcha']")) {
      return { found: true, error: "CAPTCHA_DETECTED", url: window.location.href, title: "Captcha Block" };
    }
    
    if (document.title.includes("Page Not Found") || 
        document.querySelector("img[alt*='Dogs of Amazon']") || 
        document.querySelector('a[href*="/ref=cs_404_logo"]')) {
      return { found: true, error: "PAGE_NOT_FOUND_404", url: window.location.href, title: "Page Not Found" };
    }

    const pageSource = document.documentElement.outerHTML;

    // --- 3. Extract Attributes ---

    // 3.0. GOLD MINE STRATEGY (jQuery.parseJSON)
    let goldMine = null;
    try {
        const scripts = document.querySelectorAll('script');
        for (let script of scripts) {
            const content = script.textContent || "";
            if (content.includes('jQuery.parseJSON') && (content.includes('colorToAsin') || content.includes('mediaAsin'))) {
                const match = content.match(/jQuery\.parseJSON\(\s*'([\s\S]*?)'\s*\)/);
                if (match && match[1]) {
                    let jsonStr = match[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
                    try { goldMine = JSON.parse(jsonStr); break; } 
                    catch(jsonErr) { 
                        try { goldMine = JSON.parse(match[1]); break; } catch(e){} 
                    }
                }
            }
        }
    } catch(e) { console.log("GoldMine Extraction Error:", e); }

    // 3.0.1 IMAGE BLOCK STRATEGY (Specific "var data" object)
    let imagesFromData = null;
    try {
        const scripts = document.querySelectorAll('script');
        for (let script of scripts) {
            const content = script.textContent || "";
            if (content.includes("colorImages") && content.includes("initial")) {
                let anchorIndex = content.indexOf("'colorImages'");
                if (anchorIndex === -1) anchorIndex = content.indexOf('"colorImages"');

                if (anchorIndex !== -1) {
                    let initialLabelIndex = content.indexOf("'initial'", anchorIndex);
                    if (initialLabelIndex === -1) initialLabelIndex = content.indexOf('"initial"', anchorIndex);
                    
                    if (initialLabelIndex !== -1) {
                        const rawArray = extractJsonArray(content, initialLabelIndex);
                        if (rawArray) {
                            try {
                                const parsedImages = JSON.parse(rawArray);
                                if (Array.isArray(parsedImages)) {
                                    imagesFromData = parsedImages.map(img => ({
                                        variant: img.variant || "MAIN",
                                        hiRes: cleanImageUrl(img.hiRes),
                                        large: cleanImageUrl(img.large),
                                        thumb: cleanImageUrl(img.thumb)
                                    }));
                                    break; 
                                }
                            } catch (e) { console.log("ImageBlock JSON Parse Error", e); }
                        }
                    }
                }
            }
        }
    } catch(e) { console.log("ImageBlock Extraction Error:", e); }


    // --- 3.1 Data Population ---

    // A. Images & Variants
    let items = [];
    if (imagesFromData) {
        items = imagesFromData;
    } else if (goldMine && goldMine.colorImages) {
        Object.keys(goldMine.colorImages).forEach(variantName => {
            const imgs = goldMine.colorImages[variantName] || [];
            imgs.forEach(img => {
                items.push({
                    variant: variantName,
                    hiRes: cleanImageUrl(img.hiRes),
                    large: cleanImageUrl(img.large)
                });
            });
        });
    } else {
        const jsonRegex = /\[\s*\{"hiRes":.*?"variant":.*?\}\]/s;
        const match = pageSource.match(jsonRegex);
        const rawData = match ? JSON.parse(match[0]) : [];
        items = rawData.map(item => ({
            variant: item.variant || "none",
            hiRes: cleanImageUrl(item.hiRes),
            large: cleanImageUrl(item.large)
        }));
    }

    // B. Metadata (ASINs, Title)
    let mediaAsin = "none";
    let parentAsin = "none";
    let metaTitle = "";

    if (goldMine) {
        mediaAsin = goldMine.mediaAsin || "none";
        parentAsin = goldMine.parentAsin || "none";
        metaTitle = goldMine.title || document.title;
        const txt = document.createElement("textarea");
        txt.innerHTML = metaTitle;
        metaTitle = txt.value.replace(/\\/g, "");
    } else {
        const mediaAsinMatch = pageSource.match(/"mediaAsin"\s*:\s*"([^"]+)"/);
        mediaAsin = mediaAsinMatch ? mediaAsinMatch[1] : "none";
        const parentAsinMatch = pageSource.match(/"parentAsin"\s*:\s*"([^"]+)"/);
        parentAsin = parentAsinMatch ? parentAsinMatch[1] : "none";
        const metaTitleEl = document.querySelector('meta[name="title"]');
        metaTitle = metaTitleEl ? metaTitleEl.getAttribute("content") : document.title;
    }

    // C. Variations
    let variationExists = "NO";
    let variationTheme = "none";
    let variationCount = "none";
    let variationFamily = "none";

    if (goldMine && goldMine.colorToAsin) {
        const keys = Object.keys(goldMine.colorToAsin);
        if (keys.length > 0) {
            variationExists = "YES";
            variationCount = keys.length.toString();
            const asinList = Object.values(goldMine.colorToAsin).map(v => v.asin);
            variationFamily = `[${asinList.join(", ")}]`;

            if (goldMine.visualDimensions && goldMine.visualDimensions.length > 0) {
                variationTheme = goldMine.visualDimensions.join(", ");
            }
        }
    } else {
        const dimMatch = pageSource.match(/"dimensions"\s*:\s*(\[[^\]]*\])/);
        variationExists = dimMatch ? "YES" : "NO";
        variationTheme = dimMatch ? dimMatch[1] : "none";
        const countMatch = pageSource.match(/"num_total_variations"\s*:\s*(\d+)/);
        variationCount = countMatch ? countMatch[1] : "none";
        
        const scriptScripts = document.querySelectorAll('script');
        for (let script of scriptScripts) {
          if (script.textContent && script.textContent.includes('dimensionValuesDisplayData')) {
            const vMatch = script.textContent.match(/"dimensionValuesDisplayData"\s*:\s*(\{.*?\})\s*,/);
            if (vMatch) {
              try {
                  variationFamily = JSON.stringify(JSON.parse(vMatch[1]));
              } catch(e) { variationFamily = "Error Parsing Family Data"; }
              break;
            }
          }
        }
    }

    // D. Videos
    let videos = [];
    const hostname = window.location.hostname;
    const domain = hostname.replace(/^www\.amazon\./, '');

    if (goldMine && goldMine.videos) {
        videos = goldMine.videos
            .filter(v => v.groupType === "IB_G1")
            .map(v => ({
            "video_title": v.title,
            "video_url": `https://www.amazon.${domain}/vdp/${v.mediaObjectId}`,
            "video_duration": v.durationSeconds,
            "video_languageCode": v.languageCode
        }));
    } else {
        const videoSet = new Set();
        const videoRegex = /"holderId"\s*:\s*"holder([^"]+)"/g;
        let vMatch;
        while ((vMatch = videoRegex.exec(pageSource)) !== null) {
          videoSet.add(vMatch[1]);
        }
        videos = Array.from(videoSet).map(id => ({ 
          "video_url": `https://www.amazon.${domain}/vdp/${id}` 
        }));
    }
    const videoCount = videos.length;
    const hasVideo = videoCount > 0 ? "YES" : "NO";

    // --- 3.2 DOM-Only Attributes ---
    const marketplace = window.location.hostname.replace('www.', '');

    let deliveryLocation = "none";
    try {
        // Primary strategy: DOM element text
        const glowLine2 = document.querySelector('div[id="glow-ingress-block"] > span[id="glow-ingress-line2"]');
        if (glowLine2) {
            deliveryLocation = glowLine2.textContent.trim();
        } 
        
        // Fallback strategy: Aria label
        if (deliveryLocation === "none" || !deliveryLocation) {
            const ingressLink = document.querySelector('a[id="contextualIngressPtLink"]');
            if (ingressLink) {
                 const label = ingressLink.getAttribute("aria-label");
                 if (label) deliveryLocation = label.trim();
            }
        }

        // Clean up invisible characters like &zwnj; (Zero Width Non-Joiner \u200c)
        if (deliveryLocation && deliveryLocation !== "none") {
            deliveryLocation = deliveryLocation.replace(/\u200c/g, '').replace(/&zwnj;/g, '').trim();
        }
    } catch(e) {}

    const brandEl = document.querySelector('a[id="bylineInfo"]') || document.querySelector('div[id="bylineInfo"]');
    let brand = "none";
    if (brandEl) {
        brand = brandEl.textContent.trim();
        const prefixesToRemove = [/^Visit the\s+/i, /\s+Store$/i, /^Brand\s*:\s*/i, /^Marque\s*:\s*/i, /^Marke\s*:\s*/i, /^Marca\s*:\s*/i];
        prefixesToRemove.forEach(regex => { brand = brand.replace(regex, ''); });
        brand = brand.trim();
    }
    if (brand === "none" || brand === "") {
        try {
            const rhapsodyMatch = pageSource.match(/rhapsodyARIngressViewModel\s*=\s*\{[\s\S]*?brand\s*:\s*["']([^"']+)["']/);
            if (rhapsodyMatch && rhapsodyMatch[1]) brand = rhapsodyMatch[1].trim();
        } catch (e) {}
    }

    const priceMatch = pageSource.match(/"priceAmount"\s*:\s*([\d.]+)/);
    const displayPrice = priceMatch ? priceMatch[1] : "none";

    let stockStatus = "In Stock";
    const oosDiv = document.querySelector('div[id="outOfStockBuyBox_feature_div"]');
    const noFeaturedDiv = document.querySelector('div[id="a-popover-fod-cx-learnMore-popover-fodApi"]');
    const availabilitySpan = document.querySelector('#availability span');
    if (oosDiv) {
        stockStatus = "Out Of Stock";
    } else if (noFeaturedDiv) {
        const textSpan = noFeaturedDiv.querySelector('span.a-text-bold');
        stockStatus = textSpan ? textSpan.textContent.trim() : "No featured offers available";
    } else if (availabilitySpan) {
        const availText = availabilitySpan.textContent.trim().toLowerCase();
        if (availText.includes("currently unavailable") || availText.includes("out of stock")) stockStatus = "Out Of Stock";
    } else {
        if (displayPrice === "none") stockStatus = "Unknown / No Price";
    }

    let soldBy = "none";
    const sellerEl = document.querySelector('div[class*="offer-display-feature-text"] > span[class*="offer-display-feature-text-message"]') ||
                     document.querySelector('div[data-csa-c-slot-id="odf-feature-text-desktop-merchant-info"] > div[class*="offer-display-feature-text"]') ||
                     document.querySelector('#sellerProfileTriggerId') ||
                     document.querySelector('#merchant-info span');
    if (sellerEl) {
        soldBy = sellerEl.textContent.trim() || "none";
    } else {
        const merchantInfo = document.querySelector('#merchant-info');
        if (merchantInfo) soldBy = merchantInfo.textContent.trim() || "none";
    }

    const ratingEl = document.querySelector('a[class*="mvt-cm-cr-review-stars"] > span');
    const ratingRaw = ratingEl ? ratingEl.textContent.trim() : "none";
    const ratingVal = ratingRaw !== "none" ? parseFloat(ratingRaw.split(" ")[0].replace(/,/g, ".").replace(",", ".")) : 0;

    const reviewEl = document.querySelector('span[id="acrCustomerReviewText"]');
    let reviewsRaw = "none";
    let reviewCount = 0;
    if (reviewEl) {
        reviewsRaw = reviewEl.textContent.trim()
            .replace(/[()]/g, "").replace(/&nbsp;/g, "").replace(/Â/g, "").replace(/\s+/g, "").replace(/\./g, "");
        const digitStr = reviewsRaw.replace(/\D/g, ''); 
        reviewCount = parseInt(digitStr) || 0;
    }

    let bsr = "none";
    try {
        let bsrParts = [];
        const cleanBsrText = (text) => text ? text.replace(/\(.*?See Top 100.*?\)/i, '').replace(/\(\s*\)/g, '').replace(/^:\s*/, '').replace(/\s+/g, ' ').trim() : "";
        
        const rankLabel = Array.from(document.querySelectorAll('span.a-text-bold')).find(el => el.textContent.includes('Best Sellers Rank'));
        if (rankLabel) {
            const container = rankLabel.closest('li');
            if (container) {
                const wrapper = container.querySelector('span.a-list-item') || container;
                let mainText = "";
                wrapper.childNodes.forEach(node => {
                    if (node.nodeType === 1 && (node.classList.contains('a-text-bold') || node.nodeName === 'UL')) return;
                    if (node.nodeType === 3) mainText += node.textContent;
                });
                let cleanedMain = cleanBsrText(mainText);
                if (cleanedMain) bsrParts.push(cleanedMain);
                
                const subList = wrapper.querySelector('ul');
                if (subList) subList.querySelectorAll('li').forEach(li => { let t = cleanBsrText(li.textContent); if(t) bsrParts.push(t); });
            }
        }
        if (bsrParts.length === 0) {
            const bsrHeader = Array.from(document.querySelectorAll('th')).find(th => th.textContent.trim().includes('Best Sellers Rank'));
            if (bsrHeader) {
                const nextTd = bsrHeader.nextElementSibling;
                if (nextTd && nextTd.tagName === 'TD') {
                    const subList = nextTd.querySelector('ul');
                    if (subList) subList.querySelectorAll('li').forEach(li => { let t = cleanBsrText(li.textContent); if(t) bsrParts.push(t); });
                    else { let t = cleanBsrText(nextTd.textContent); if(t) bsrParts.push(t); }
                }
            }
        }
        if (bsrParts.length > 0) bsr = bsrParts.join(" | ");
    } catch(e) {}

    let freeDeliveryDate = "none";
    let paidDeliveryDate = "none";
    let primeOrFastestDeliveryDate = "none";

    // Primary Delivery (Free or Paid)
    const primaryDEX = document.querySelector('span[data-csa-c-type="element"][data-csa-c-content-id="DEXUnifiedCXPDM"]');
    if (primaryDEX) {
        const price = primaryDEX.getAttribute('data-csa-c-delivery-price');
        const time = primaryDEX.getAttribute('data-csa-c-delivery-time');
        
        if (price && time) {
            // Check if price contains any numbers (e.g., "$5.99", "EUR 3.50")
            const hasNumber = /\d/.test(price);
            if (hasNumber) {
                paidDeliveryDate = `${price} - ${time}`;
            } else {
                // If no numbers (e.g. "FREE"), it's free delivery
                freeDeliveryDate = time;
            }
        }
    }

    // Secondary Delivery (Prime/Fastest)
    const secondaryDEX = document.querySelector('span[data-csa-c-type="element"][data-csa-c-content-id="DEXUnifiedCXSDM"]');
    if (secondaryDEX) {
        const time = secondaryDEX.getAttribute('data-csa-c-delivery-time');
        if (time) {
            primeOrFastestDeliveryDate = time;
        }
    }

    // Bullets - Primary Strategy: PQV > Fallback: Standard
    let bulletNodes = document.querySelectorAll('div[id="pqv-feature-bullets"] > ul > li');
    if (bulletNodes.length === 0) {
        bulletNodes = document.querySelectorAll('#feature-bullets li span.a-list-item, div[id*="productFactsDesktopExpander"] > div > ul > li > span[class*="a-list-item"]');
    }
    const bulletsList = Array.from(bulletNodes).map(el => el.textContent.trim()).filter(text => text.length > 0);
    const bullets = bulletsList.join(" | ");
    const bulletCount = bulletsList.length;
    
    // Description - Primary Strategy: PQV > Fallback: Standard
    const descriptionEl = document.querySelector('div[id="pqv-description"]') || document.querySelector('div[id="productDescription"]');
    let description = "none";
    
    if (descriptionEl) {
        // Clone to safely manipulate
        const clone = descriptionEl.cloneNode(true);
        // Remove the heading (usually h2) inside the description block
        const heading = clone.querySelector('h2');
        if (heading) {
            heading.remove();
        }
        description = clone.textContent.trim();
    }
    const descLen = description !== "none" ? description.length : 0;

    const brandStoryImgs = Array.from(document.querySelectorAll('div[class="apm-brand-story-background-image"] > img'))
      .map(img => ({ "brand-story-image": cleanImageUrl(img.getAttribute('data-src') || img.src) }));
    const aPlusImgs = Array.from(document.querySelectorAll('div[class*="aplus-module-wrapper"] > img'))
      .map(img => ({ "a-plus-image": cleanImageUrl(img.getAttribute('data-src') || img.src) }));
      
    const hasAplus = aPlusImgs.length > 0 ? "YES" : "NO";
    const hasBrandStory = brandStoryImgs.length > 0 ? "YES" : "NO";
    const hasBullets = bullets.length > 5 ? "YES" : "NO";
    const hasDescription = (description !== "none" && descLen > 5) ? "YES" : "NO";

    let score = 0;
    if (metaTitle && metaTitle.length >= 80 && metaTitle.length <= 200) score += 10;
    if (items.length >= 7) score += 15;
    if (bulletCount >= 5) score += 15;
    if (descLen >= 100) score += 5;
    if (videoCount > 0) score += 15;
    if (aPlusImgs.length > 0) score += 20;
    if (ratingVal >= 4.0) score += 10;
    if (reviewCount > 15) score += 10;
    const lqs = score + "/100";

    return {
      found: true,
      url: window.location.href,
      title: document.title, 
      attributes: {
        marketplace, brand, metaTitle, mediaAsin, parentAsin, displayPrice, stockStatus, soldBy,
        rating: ratingRaw, reviews: reviewsRaw, bsr,
        freeDeliveryDate, paidDeliveryDate, primeOrFastestDeliveryDate,
        bulletsCount: bulletCount,
        bullets, description,
        variationExists, variationTheme, variationCount, variationFamily,
        brandStoryImgs, aPlusImgs, videos,
        hasAplus, hasBrandStory, hasVideo, hasBullets, hasDescription,
        lqs, videoCount, deliveryLocation
      },
      data: items
    };

  } catch (e) {
    console.error("Extraction error:", e);
    return { found: false, error: e.toString(), url: window.location.href };
  }
})();
