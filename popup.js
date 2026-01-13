// --- IMPORTS ---
import { db, auth } from './firebase-init.js';
import { GoogleAuthProvider, signInWithCredential } from './lib/firebase-auth.js';
import { doc, setDoc, getDoc } from './lib/firebase-firestore.js';

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const scanBtn = document.getElementById('scanBtn');
const stopBtn = document.getElementById('stopBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resultsArea = document.getElementById('results');
const statusDiv = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const progressContainer = document.getElementById('progressContainer');
const selectAllCheckbox = document.getElementById('selectAll');
const attrCheckboxes = document.querySelectorAll('.attr-checkbox');
const proFeatures = document.querySelectorAll('.pro-feature');

// Mode Tabs
const tabCurrent = document.getElementById('tabCurrent');
const tabBulk = document.getElementById('tabBulk');
const bulkSection = document.getElementById('bulkSection');
const dashboardView = document.getElementById('dashboardView');

// Bulk Elements
const csvInput = document.getElementById('csvInput');
const fileStatus = document.getElementById('fileStatus');
const domainSelect = document.getElementById('domainSelect');
const batchSizeInput = document.getElementById('batchSizeInput');
const disableImagesInput = document.getElementById('disableImages');
const popupWarning = document.getElementById('popupWarning');

// State Variables
let userEmail = null;
let isPro = false;
let scannedData = [];
let isScanning = false;
let mode = 'current'; 
let rawCsvLines = [];

// --- FULL CONFIGURATION RESTORED ---
const fieldConfig = {
    'lqs': { type: 'attr' },
    'marketplace': { type: 'attr' },
    'brand': { type: 'attr' },
    'metaTitle': { type: 'attr' },
    'mediaAsin': { type: 'attr' },
    'parentAsin': { type: 'attr' },
    'displayPrice': { type: 'attr' },
    'stockStatus': { type: 'attr' },
    'soldBy': { type: 'attr' },
    'rating': { type: 'attr' },
    'reviews': { type: 'attr' },
    'bsr': { type: 'attr' },
    'freeDeliveryDate': { type: 'attr' },
    'primeDeliveryDate': { type: 'attr' },
    'fastestDeliveryDate': { type: 'attr' },
    'hasBullets': { type: 'attr' },
    'bullets': { type: 'attr' },
    'hasDescription': { type: 'attr' },
    'description': { type: 'attr' },
    'variationExists': { type: 'attr' },
    'variationTheme': { type: 'attr' },
    'variationCount': { type: 'attr' },
    'variationFamily': { type: 'attr' },
    'hasBrandStory': { type: 'attr' },
    'brandStoryImgs': { type: 'attr' },
    'hasAplus': { type: 'attr' },
    'aPlusImgs': { type: 'attr' },
    'hasVideo': { type: 'attr' },
    'videos': { type: 'attr' },
    'imgVariantCount': { type: 'calc' },
    'imgVariantDetails': { type: 'calc' },
    'url': { type: 'root' }
};

// --- MULTI-MARKETPLACE DATA RESTORED ---
const marketplaceData = {
    'Amazon.com': { root: 'https://www.amazon.com/dp/', en: '?language=en_US', native: '?language=en_US' },
    'Amazon.ca': { root: 'https://www.amazon.ca/dp/', en: '?language=en_CA', native: '?language=en_CA' },
    'Amazon.co.uk': { root: 'https://www.amazon.co.uk/dp/', en: '?currency=USD', native: '?currency=GBP' },
    'Amazon.de': { root: 'https://www.amazon.de/dp/', en: '?language=en_GB', native: '?language=de_DE' },
    'Amazon.fr': { root: 'https://www.amazon.fr/dp/', en: '?language=en_GB', native: '?language=fr_FR' },
    'Amazon.it': { root: 'https://www.amazon.it/dp/', en: '?language=en_GB', native: '?language=it_IT' },
    'Amazon.es': { root: 'https://www.amazon.es/dp/', en: '?language=en_GB', native: '?language=es_ES' },
    'Amazon.nl': { root: 'https://www.amazon.nl/dp/', en: '?language=en_GB', native: '?language=nl_NL' },
    'Amazon.se': { root: 'https://www.amazon.se/dp/', en: '?language=en_GB', native: '?language=sv_SE' },
    'Amazon.com.be': { root: 'https://www.amazon.com.be/dp/', en: '?language=en_GB', native: '?language=fr_BE' },
    'Amazon.com.au': { root: 'https://www.amazon.com.au/dp/', en: '?currency=AUD', native: '?currency=AUD' },
    'Amazon.sg': { root: 'https://www.amazon.sg/dp/', en: '?currency=SGD', native: '?currency=SGD' },
    'Amazon.ae': { root: 'https://www.amazon.ae/dp/', en: '?language=en_AE', native: '?language=ar_AE' },
    'Amazon.sa': { root: 'https://www.amazon.sa/dp/', en: '?language=en_AE', native: '?language=ar_AE' },
    'Amazon.eg': { root: 'https://www.amazon.eg/dp/', en: '?language=en_AE', native: '?language=ar_AE' },
    'Amazon.in': { root: 'https://www.amazon.in/dp/', en: '?language=en_IN', native: '?language=hi_IN' },
    'Amazon.co.jp': { root: 'https://www.amazon.co.jp/dp/', en: '?language=en_US', native: '?language=ja_JP' }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    populateDomains();
    checkLoginState();
    
    // Check local storage for basic state persistence
    chrome.storage.local.get(['userEmail', 'isPro'], (result) => {
        if (result.userEmail) {
            updateUIForUser(result.userEmail);
        }
    });
});

// --- AUTHENTICATION & CLOUD LOGIN ---
loginBtn.addEventListener('click', () => {
    // 1. Get Chrome Token
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            statusDiv.textContent = "Login failed: " + chrome.runtime.lastError.message;
            return;
        }

        // 2. Authenticate with Firebase using the Chrome Token
        const credential = GoogleAuthProvider.credential(null, token);
        
        statusDiv.textContent = "Connecting to Cloud...";
        
        signInWithCredential(auth, credential)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log("Cloud Login Success:", user.uid);
                
                // Get User Profile info to display friendly name
                chrome.identity.getProfileUserInfo((userInfo) => {
                    updateUIForUser(userInfo.email || user.email);
                });
            })
            .catch((error) => {
                console.error("Firebase Login Error:", error);
                statusDiv.textContent = "Cloud Error: " + error.message;
            });
    });
});

function updateUIForUser(email) {
    userEmail = email;
    isPro = true; // For v1.0, everyone who logs in is Pro
    
    // Save to local storage for UI persistence
    chrome.storage.local.set({ userEmail: email, isPro: true });

    // UI Updates
    loginBtn.textContent = `Logout (${email.split('@')[0]})`;
    
    // Enable Tabs
    tabBulk.classList.remove('disabled');
    tabBulk.querySelector('.lock-icon').style.display = 'none';
    
    // Enable Pro Features
    proFeatures.forEach(el => {
        el.disabled = false;
        el.parentElement.style.color = 'var(--text-main)';
    });
    // Enable Checkbox Select All
    if(selectAllCheckbox) selectAllCheckbox.disabled = false;

    statusDiv.textContent = "Logged in. Cloud History Enabled.";
    statusDiv.style.color = "var(--success)";
}

function checkLoginState() {
    // If we have a Firebase user, ensure UI is updated
    if (auth.currentUser) {
        updateUIForUser(auth.currentUser.email);
    }
}

// --- CLOUD HISTORY FUNCTIONS ---

async function saveAuditToCloud(asin, fullData) {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;
    const timestamp = new Date().toISOString();

    // Flatten logic for storage: combine root properties + attributes
    // We want to store exactly what we scrape to compare later
    const dataToStore = {
        ...fullData.attributes, // Spread attributes to top level for easier querying if needed
        url: fullData.url,
        title: fullData.title,
        dataItems: fullData.data, // Variation items
        lastScanned: timestamp
    };

    try {
        // Path: users -> [uid] -> history -> [ASIN]
        await setDoc(doc(db, "users", userId, "history", asin), dataToStore);
        console.log(`Saved audit for ${asin} to cloud.`);
    } catch (e) {
        console.error("Error saving to cloud:", e);
    }
}

async function checkHistory(asin) {
    if (!auth.currentUser) return null;

    const userId = auth.currentUser.uid;
    try {
        const docRef = doc(db, "users", userId, "history", asin);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (e) {
        console.error("Error checking history:", e);
    }
    return null;
}

// --- HELPER: COMPARE SCAN DATA ---
function compareData(oldData, newData) {
    let changes = [];
    
    // Helper to normalize values for comparison (handle 'none', null, strings)
    const normalize = (val) => String(val || 'none').trim();

    // Iterate through our field configuration to check every tracked attribute
    for (const [key, config] of Object.entries(fieldConfig)) {
        // Skip calculation fields or URL which might change slightly
        if (config.type === 'calc' || key === 'url') continue;

        let oldVal, newVal;

        if (config.type === 'root') {
            oldVal = normalize(oldData[key]);
            newVal = normalize(newData[key]);
        } else {
            // Attributes are usually nested in 'attributes' object in newData, 
            // but might be flattened in oldData storage. Check both.
            oldVal = normalize(oldData[key] || (oldData.attributes ? oldData.attributes[key] : ''));
            newVal = normalize(newData.attributes ? newData.attributes[key] : '');
        }

        // Compare
        if (oldVal !== newVal) {
            // Formatting field names for display
            const fieldName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            changes.push(`${fieldName}: ${oldVal} ➔ ${newVal}`);
        }
    }
    return changes;
}

// --- TABS LOGIC ---
tabCurrent.addEventListener('click', () => {
    switchTab('current');
});

tabBulk.addEventListener('click', () => {
    if (!isPro) {
        alert("Please login to use Bulk Audit.");
        return;
    }
    switchTab('bulk');
});

function switchTab(newMode) {
    mode = newMode;
    if (mode === 'current') {
        tabCurrent.classList.add('active');
        tabBulk.classList.remove('active');
        bulkSection.style.display = 'none';
        scanBtn.textContent = "Start Audit (Current Tabs)";
    } else {
        tabCurrent.classList.remove('active');
        tabBulk.classList.add('active');
        bulkSection.style.display = 'block';
        scanBtn.textContent = "Start Bulk Audit";
    }
}

// --- CSV INPUT HANDLING ---
csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      const text = event.target.result;
      rawCsvLines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      fileStatus.textContent = `Loaded ${rawCsvLines.length} lines. Click Start to process.`;
    };
    reader.readAsText(file);
});

// --- SCANNING LOGIC ---
scanBtn.addEventListener('click', async () => {
    scannedData = []; // Clear previous results
    resultsArea.value = "Scanning...";
    statusDiv.textContent = "Initializing...";
    progressContainer.style.display = 'block';
    progressBar.style.width = '5%';
    
    // UI Cleanup
    scanBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    stopBtn.disabled = false;
    copyBtn.style.display = 'none';
    downloadBtn.style.display = 'none';
    popupWarning.style.display = 'block';
    
    isScanning = true;

    try {
        if (mode === 'current') {
            await processCurrentTabs();
        } else {
            // Bulk Logic
             if (!rawCsvLines || rawCsvLines.length === 0) {
                throw new Error("No data loaded. Please upload a CSV/TXT file.");
            }
            const processedUrls = rawCsvLines
                .map(line => buildOrNormalizeUrl(line))
                .filter(url => url !== null);

            if (processedUrls.length === 0) {
                 throw new Error("No valid URLs or ASINs found in file.");
            }
            await processBulkBatches(processedUrls);
        }
    } catch (error) {
        console.error(error);
        statusDiv.textContent = "Error: " + error.message;
    } finally {
        finishScan();
    }
});

// --- 1. Process Current Tabs ---
async function processCurrentTabs() {
    statusDiv.textContent = 'Identifying Amazon tabs...';
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validDomains = Object.keys(marketplaceData).map(d => d.toLowerCase());
    
    const amazonTabs = tabs.filter(tab => {
        if (!tab.url || tab.url.startsWith('chrome')) return false;
        try {
            const url = new URL(tab.url);
            const hostname = url.hostname.replace('www.', '').toLowerCase();
            return validDomains.some(d => hostname.endsWith(d));
        } catch(e) { return false; }
    });

    if (amazonTabs.length === 0) {
      statusDiv.textContent = "No valid Amazon tabs found.";
      return;
    }

    // GUEST LIMIT LOGIC
    let tabsToProcess = amazonTabs;
    const GUEST_LIMIT = 10;
    if (!isPro && amazonTabs.length > GUEST_LIMIT) {
        statusDiv.textContent = `Guest Limit: Processing first ${GUEST_LIMIT} tabs only...`;
        tabsToProcess = amazonTabs.slice(0, GUEST_LIMIT);
    } else {
        statusDiv.textContent = `Auditing ${amazonTabs.length} tabs...`;
    }
    
    // Process Sequentially or Parallel? Parallel is faster for current tabs.
    const promises = tabsToProcess.map(async (tab, index) => {
       if (!isScanning) return null;
       
       // Update Progress
       const percent = Math.round(((index + 1) / tabsToProcess.length) * 100);
       progressBar.style.width = `${percent}%`;
       
       return processSingleTab(tab.id, tab.url);
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null && (r.found || r.error));
    scannedData = validResults;
    displayResults(scannedData);
}

// --- 2. Process Bulk Batches ---
async function processBulkBatches(urlsToProcess) {
    let batchSize = parseInt(batchSizeInput.value, 10);
    if (isNaN(batchSize) || batchSize < 1) batchSize = 25;
    if (batchSize > 50) batchSize = 50; 
    
    const total = urlsToProcess.length;
    let processedCount = 0;
    const startTime = Date.now();

    // Disable images if requested
    if (disableImagesInput.checked) {
        await chrome.contentSettings.images.set({
          primaryPattern: '*://*.amazon.com/*',
          setting: 'block'
        });
    }

    for (let i = 0; i < total; i += batchSize) {
      if (!isScanning) break;

      const batch = urlsToProcess.slice(i, i + batchSize);
      const currentBatchNum = Math.ceil((i+1)/batchSize);
      const totalBatches = Math.ceil(total/batchSize);
      
      // Calculate Time
      let timeRemaining = 'calculating...';
      if (processedCount > 0) {
          const elapsedTime = Date.now() - startTime;
          const avgTimePerItem = elapsedTime / processedCount;
          const remainingItems = total - processedCount;
          const remainingMs = remainingItems * avgTimePerItem;
          // Simple formatting
          timeRemaining = `${Math.ceil(remainingMs/1000)}s`;
      }

      statusDiv.innerHTML = `Processing batch <b>${currentBatchNum} of ${totalBatches}</b>... (${processedCount}/${total})<br>Est. Completion in: <b>${timeRemaining}</b>`;
      
      // Create Tabs
      const tabs = [];
      for (const url of batch) {
          const tab = await chrome.tabs.create({ url: url, active: false });
          tabs.push(tab);
      }

      // Wait for load (simple delay for stability)
      await new Promise(resolve => setTimeout(resolve, 8000)); 

      // Extract
      const extractionPromises = tabs.map(tab => processSingleTab(tab.id, tab.url)); 
      const results = await Promise.all(extractionPromises);
      scannedData.push(...results.filter(r => r !== null && (r.found || r.error)));
      displayResults(scannedData); // Update live

      // Cleanup Tabs
      const tabIds = tabs.map(t => t.id);
      await chrome.tabs.remove(tabIds);
      
      processedCount += batch.length;
      const percent = Math.round((processedCount / total) * 100);
      progressBar.style.width = `${percent}%`;
    }

    // Re-enable images
    if (disableImagesInput.checked) {
        await chrome.contentSettings.images.set({
            primaryPattern: '*://*.amazon.com/*',
            setting: 'allow'
        });
    }
}

// --- CORE EXTRACTION LOGIC ---
async function processSingleTab(tabId, fallbackUrl) {
    try {
        // Inject script
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });

        // Send Message
        const response = await chrome.tabs.sendMessage(tabId, { action: "scan" });
        
        if (response && response.data) {
            const newData = response.data;
            let changeLog = [];

            // --- HISTORY CHECK (For ALL fields) ---
            if (auth.currentUser && newData.attributes && newData.attributes.mediaAsin) {
                const oldData = await checkHistory(newData.attributes.mediaAsin);
                
                if (oldData) {
                    // Compare ALL fields defined in fieldConfig
                    const changes = compareData(oldData, newData);
                    if (changes.length > 0) {
                        // Store changes in the data object so we can show/export them
                        newData.changes = changes; 
                        console.log(`Changes found for ${newData.attributes.mediaAsin}:`, changes);
                    }
                }
                
                // Save this new scan to cloud
                saveAuditToCloud(newData.attributes.mediaAsin, newData);
            }
            
            return newData;
        }
        return { error: "No Data", url: fallbackUrl };

    } catch (err) {
        return { error: "LOAD_TIMEOUT_OR_ERROR", url: fallbackUrl, title: "Error" };
    }
}

function finishScan() {
    isScanning = false;
    scanBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    popupWarning.style.display = 'none';
    progressContainer.style.display = 'none';
    
    if (scannedData.length > 0) {
        statusDiv.textContent = `Completed! Scanned ${scannedData.length} listings.`;
        statusDiv.style.color = "var(--success)";
        
        // Update Dashboard with aggregate data
        updateDashboard(scannedData);
    } else {
        statusDiv.textContent = "Scan complete. No valid data found.";
    }
}

function displayResults(dataArray) {
    let output = "";
    
    // Check if we have any changes to report at the top
    const changedItems = dataArray.filter(item => item.changes && item.changes.length > 0);
    
    if (changedItems.length > 0) {
        output += "=== ⚠ CHANGES DETECTED IN CLOUD HISTORY ===\n";
        changedItems.forEach(item => {
            output += `ASIN: ${item.attributes.mediaAsin}\n`;
            item.changes.forEach(c => output += `  • ${c}\n`);
            output += "\n";
        });
        output += "========================================\n\n";
    }

    output += JSON.stringify(dataArray, null, 2);
    resultsArea.value = output;
    
    copyBtn.style.display = 'block';
    downloadBtn.style.display = 'block';
}

function updateDashboard(dataArray) {
    dashboardView.style.display = 'grid';
    document.getElementById('statTotal').textContent = dataArray.length;
    
    // Calculate Avg LQS
    let totalLqs = 0;
    let countLqs = 0;
    let issues = 0;
    
    dataArray.forEach(item => {
        if(item.attributes && item.attributes.lqs) {
            const score = parseInt(item.attributes.lqs.split('/')[0]);
            if(!isNaN(score)) {
                totalLqs += score;
                countLqs++;
                if (score < 70) issues++;
            }
        }
    });
    
    const avg = countLqs > 0 ? Math.round(totalLqs / countLqs) : 0;
    
    const lqsEl = document.getElementById('statLqs');
    lqsEl.textContent = avg + '/100';
    lqsEl.className = "dash-value " + (avg > 70 ? "good" : "bad");
    
    document.getElementById('statIssues').textContent = issues;
}

// --- UTILS ---
copyBtn.addEventListener('click', () => {
    resultsArea.select();
    document.execCommand('copy');
    copyBtn.textContent = "Copied!";
    setTimeout(() => copyBtn.textContent = "Copy JSON Data", 2000);
});

downloadBtn.addEventListener('click', () => {
    if (scannedData.length === 0) return;
    if (!isPro) {
        // Guests can download, but maybe limited fields? 
        // For now allowing download as per previous instructions
    }

    // Build Header from Field Config
    const checkedBoxes = Array.from(document.querySelectorAll('.attr-checkbox:checked'));
    let csvHeader = "Status," + checkedBoxes.map(cb => cb.parentNode.textContent.trim()).join(",") + ",Changes Detected\n";
    
    let csvBody = "";

    const cleanField = (text) => {
      if (text === null || text === undefined || text === 'none') return '"none"';
      if (typeof text === 'object') return `"${JSON.stringify(text).replace(/"/g, '""')}"`;
      return `"${String(text).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };
    
    const cleanAmazonUrl = (url) => {
        if (!url || url === 'none') return null;
        return url.replace(/\._[A-Z0-9,._-]+\./i, '.');
    };

    scannedData.forEach(tabData => {
      if (tabData.error) {
        csvBody += `${tabData.error} - ${tabData.title},"${tabData.url || 'Unknown'}"\n`;
        return;
      }

      let row = "SUCCESS,";
      checkedBoxes.forEach(cb => {
        const id = cb.value;
        const config = fieldConfig[id];
        let val = 'none';

        if (config) {
            if (config.type === 'attr') {
              val = tabData.attributes[id];
            } else if (config.type === 'root') {
              val = tabData[id];
            } else if (config.type === 'calc') {
              if (id === 'imgVariantCount') {
                val = tabData.data ? tabData.data.length : 0;
              } else if (id === 'imgVariantDetails') {
                val = tabData.data ? tabData.data.map(item => ({
                  variant: item.variant,
                  hiRes: cleanAmazonUrl(item.hiRes),
                  large: cleanAmazonUrl(item.large)
                })) : [];
              }
            }
        }
        row += cleanField(val) + ",";
      });
      
      // Append Changes Column
      const changeStr = tabData.changes ? tabData.changes.join(" | ") : "No Changes";
      row += `"${changeStr}"`;
      
      csvBody += row + "\n";
    });

    const csvContent = csvHeader + csvBody;
    const now = new Date();
    const pad = (num) => num.toString().padStart(2, '0');
    const fileName = `Audit-Scraped_Data_${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${now.getFullYear()}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

stopBtn.addEventListener('click', () => {
    isScanning = false;
    statusDiv.textContent = 'Stopping scan...';
    stopBtn.disabled = true;
});

// Populate Dropdown
function populateDomains() {
    Object.keys(marketplaceData).forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain;
        domainSelect.appendChild(option);
    });
    // Default to .com if available
    if(marketplaceData['Amazon.com']) domainSelect.value = 'Amazon.com';
}

// URL Normalizer Helper
const buildOrNormalizeUrl = (input) => {
    input = input.trim();
    if(!input) return null;

    const langPref = document.querySelector('input[name="langPref"]:checked').value;
    const selectedDomainKey = domainSelect.value;
    const config = marketplaceData[selectedDomainKey];
    
    const langParam = (langPref === 'english') ? config.en : config.native;

    if (input.startsWith('http://') || input.startsWith('https://')) {
        try {
            let url = new URL(input);
            const hostname = url.hostname.replace('www.', '');
            const matchingConfigKey = Object.keys(marketplaceData).find(key => hostname.endsWith(key.toLowerCase()));
            
            if (matchingConfigKey) {
                const domainConfig = marketplaceData[matchingConfigKey];
                const paramToApply = (langPref === 'english') ? domainConfig.en : domainConfig.native;
                
                if (!url.search.includes('language=') && !url.search.includes('currency=')) {
                    const separator = url.search ? '&' : '?';
                    let cleanHref = url.href.replace(/\/$/, "");
                    return cleanHref + separator + paramToApply.replace('?', '');
                }
            }
            return input;
        } catch(e) { return input; }
    } 
    else if (/^[A-Z0-9]{10}$/.test(input)) {
        let root = config.root;
        if (!root.endsWith('/')) root += '/';
        return root + input + langParam;
    }
    return null;
};
