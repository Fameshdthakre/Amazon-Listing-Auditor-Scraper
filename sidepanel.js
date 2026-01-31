import { marketplaceData, buildOrNormalizeUrl, csvLineParser } from './scraperEngine.js';
import { AuthManager } from './src/authManager.js';
import { CatalogueManager } from './src/catalogueManager.js';
import { ExportManager } from './src/exportManager.js';
import { UIRenderer } from './src/uiRenderer.js';
import { VirtualList } from './src/VirtualList.js';

document.addEventListener('DOMContentLoaded', async () => {
  // --- State ---
  let catalogueListInstance = null;
  let MEGA_MODE = 'scraper';
  let mode = 'current'; 
  let rawCsvData = []; 
  let currentIsScanning = false;
  let previousIsScanning = false;
  let countdownInterval = null;

  // --- UI References ---
  const scanBtn = document.getElementById('scanBtn');
  const stopBtn = document.getElementById('stopBtn');
  const domainSelect = document.getElementById('domainSelect');
  const fileStatus = document.getElementById('fileStatus');
  const pasteStatus = document.getElementById('pasteStatus');
  const catalogueSelect = document.getElementById('catalogueSelect');
  const catalogueLimitMsg = document.getElementById('catalogueLimitMsg');

  // --- Initialization ---
  UIRenderer.applyTheme('dark'); // Default to dark/futuristic
  await AuthManager.init();
  updateUIForAuth();

  // Populate Marketplaces
  Object.keys(marketplaceData).forEach(domain => {
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = domain;
    domainSelect.appendChild(option);
  });
  if(marketplaceData['Amazon.com']) domainSelect.value = 'Amazon.com';

  // --- Auth Listeners ---
  window.addEventListener('auth-changed', (e) => {
      updateUIForAuth();
  });

  document.getElementById('googleBtn').addEventListener('click', () => AuthManager.loginGoogle());
  document.getElementById('msBtn').addEventListener('click', () => AuthManager.loginMicrosoft());
  document.getElementById('logoutBtn').addEventListener('click', () => {
      if (currentIsScanning && !confirm("Scan running. Stop?")) return;
      if (currentIsScanning) chrome.runtime.sendMessage({ action: 'STOP_SCAN' });
      AuthManager.logout(() => updateUIForAuth());
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.body.getAttribute('data-theme') || 'dark';
      UIRenderer.applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  function updateUIForAuth() {
      const loggedIn = AuthManager.isLoggedIn;
      UIRenderer.toggle('googleBtn', !loggedIn);
      UIRenderer.toggle('msBtn', !loggedIn);
      UIRenderer.toggle('logoutBtn', loggedIn);
      UIRenderer.toggle('megaModeSwitch', loggedIn); // Only Pro sees toggle

      const user = AuthManager.userInfo;
      const name = user ? (user.name || 'User') : '';
      if(loggedIn) document.getElementById('logoutBtn').textContent = `Logout (${name})`;

      // Mega Mode Switch Logic - Always Visible, but Auditor Locked for Guest
      const auditorInput = document.querySelector('input[value="auditor"]');
      const auditorLock = document.querySelector('#lblAuditor .lock-icon');

      if (loggedIn) {
          if(auditorInput) auditorInput.disabled = false;
          if(auditorLock) auditorLock.classList.add('hidden');

          document.getElementById('tabBulk').classList.remove('disabled');
          document.querySelector('#tabBulk .lock-icon').style.display = 'none';
          document.querySelectorAll('.pro-feature').forEach(el => { el.disabled = false; el.checked = true; });
          document.getElementById('selectAll').disabled = false;
      } else {
          // Guest
          if(auditorInput) auditorInput.disabled = true;
          if(auditorLock) auditorLock.classList.remove('hidden');

          // Force Scraper if Auditor was selected (e.g. from prev session state bug)
          if(MEGA_MODE === 'auditor') {
             document.querySelector('input[name="megaMode"][value="scraper"]').checked = true;
             MEGA_MODE = 'scraper';
             updateMegaModeUI();
          }
          
          document.getElementById('tabBulk').classList.add('disabled');
          document.querySelector('#tabBulk .lock-icon').style.display = 'inline';
          document.querySelectorAll('.pro-feature').forEach(el => { el.checked = false; el.disabled = true; });
      }

      CatalogueManager.loadCatalogues(loggedIn, catalogueSelect, catalogueLimitMsg, renderCatalogueList);
  }

  // --- Mega Mode UI ---
  function updateMegaModeUI() {
      document.querySelectorAll('input[name="megaMode"]').forEach(r => { if (r.checked) MEGA_MODE = r.value; });

      UIRenderer.toggle('scrapingConfig', MEGA_MODE === 'scraper');
      UIRenderer.toggle('auditConfig', MEGA_MODE !== 'scraper');
      UIRenderer.toggle('tabCatalogueSetup', MEGA_MODE !== 'scraper');

      if (MEGA_MODE === 'scraper') {
          UIRenderer.toggle('tabCurrent', true);
          UIRenderer.toggle('tabBulk', true);
          UIRenderer.setText('bulkHintText', "Upload CSV (Headers: URL) or Paste Links");
          if (mode === 'catalogue') document.getElementById('tabCurrent').click();
      } else {
          // Auditor
          UIRenderer.toggle('tabCurrent', false);
          UIRenderer.toggle('tabBulk', false);
          if (mode !== 'catalogue') document.getElementById('tabCatalogueSetup').click();
      }
  }

  document.querySelectorAll('input[name="megaMode"]').forEach(r => r.addEventListener('change', updateMegaModeUI));

  // --- Tab Navigation ---
  document.getElementById('tabCurrent').addEventListener('click', () => {
      mode = 'current';
      setActiveTab('tabCurrent');
      showSection('currentSection');
      scanBtn.textContent = 'Start Audit (Current Tabs)';
      UIRenderer.toggle('scanBtn', true);
  });

  document.getElementById('tabBulk').addEventListener('click', () => {
      if (!AuthManager.isLoggedIn) return;
      mode = 'bulk';
      setActiveTab('tabBulk');
      showSection('bulkSection');
      scanBtn.textContent = 'Start Bulk Audit';
      UIRenderer.toggle('scanBtn', true);
  });

  document.getElementById('tabCatalogueSetup').addEventListener('click', () => {
      if (!AuthManager.isLoggedIn) return;
      mode = 'catalogue';
      setActiveTab('tabCatalogueSetup');
      showSection('catalogueSection');
      UIRenderer.toggle('scanBtn', false); // Auditor has specific button inside section
      CatalogueManager.loadCatalogues(AuthManager.isLoggedIn, catalogueSelect, catalogueLimitMsg, renderCatalogueList);
  });

  function setActiveTab(id) {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      document.getElementById(id).classList.add('active');
  }

  function showSection(id) {
      ['currentSection', 'bulkSection', 'catalogueSection'].forEach(s => UIRenderer.toggle(s, s === id));
  }

  // --- Catalogue Logic ---
  function renderCatalogueList(items) {
      document.getElementById('catalogueCount').textContent = `${items.length} Items`;
      document.getElementById('auditCatalogueBtn').disabled = (items.length === 0);

      if (items.length === 0) {
          document.getElementById('catalogueItems').innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted); font-size:11px;">Catalogue is empty.</div>';
          catalogueListInstance = null; // Reset
          return;
      }

      // Initialize VirtualList if needed
      if (!catalogueListInstance) {
          catalogueListInstance = new VirtualList('catalogueItems', 42, (item) => {
              const div = document.createElement('div');
              div.className = 'wl-item';
              div.style.display = 'flex';
              div.style.alignItems = 'center';
              div.innerHTML = `
                  <div class="flex-row w-full">
                      <div class="flex-1" style="overflow:hidden; text-overflow:ellipsis;">
                           <span class="wl-asin">${item.asin}</span>
                           <span style="color:var(--text-muted); font-size:10px; margin-left:6px;">${item.expected?.title ? item.expected.title.substring(0, 30) + '...' : ''}</span>
                      </div>
                      <div class="wl-actions">
                          <span class="wl-action-btn del-btn" title="Remove">&times;</span>
                      </div>
                  </div>`;

              div.querySelector('.del-btn').addEventListener('click', (e) => {
                  e.stopPropagation();
                  CatalogueManager.removeFromCatalogue(item.asin, AuthManager.isLoggedIn, () => {
                      CatalogueManager.loadCatalogues(AuthManager.isLoggedIn, catalogueSelect, catalogueLimitMsg, renderCatalogueList);
                  });
              });
              return div;
          });
      }

      catalogueListInstance.setItems(items);
  }

  catalogueSelect.addEventListener('change', (e) => {
      CatalogueManager.currentCatalogueId = e.target.value;
      CatalogueManager.loadCatalogues(AuthManager.isLoggedIn, catalogueSelect, catalogueLimitMsg, renderCatalogueList);
  });

  document.getElementById('newCatalogueBtn').addEventListener('click', () => {
      const name = prompt("New Catalogue Name:");
      if(name) CatalogueManager.createCatalogue(name, AuthManager.isLoggedIn, () => CatalogueManager.loadCatalogues(AuthManager.isLoggedIn, catalogueSelect, catalogueLimitMsg, renderCatalogueList));
  });

  document.getElementById('deleteCatalogueBtn').addEventListener('click', () => {
      if(confirm("Delete Catalogue?")) CatalogueManager.deleteCatalogue(AuthManager.isLoggedIn, () => CatalogueManager.loadCatalogues(AuthManager.isLoggedIn, catalogueSelect, catalogueLimitMsg, renderCatalogueList));
  });

  document.getElementById('clearCatalogueBtn').addEventListener('click', () => {
       if(confirm("Clear Items?")) CatalogueManager.clearCatalogue(AuthManager.isLoggedIn, () => CatalogueManager.loadCatalogues(AuthManager.isLoggedIn, catalogueSelect, catalogueLimitMsg, renderCatalogueList));
  });

  // --- Scan Logic ---
  scanBtn.addEventListener('click', startScan);
  document.getElementById('auditCatalogueBtn').addEventListener('click', startScan);

  async function startScan() {
      let urls = [];
      const settings = { disableImages: document.getElementById('disableImages').checked };

      if (mode === 'catalogue' || MEGA_MODE === 'auditor') {
          // Auditor Mode uses Catalogue Items
          const key = CatalogueManager.getContainerKey(AuthManager.isLoggedIn);
          const data = await chrome.storage.local.get(key);
          const list = data[key]?.[CatalogueManager.currentCatalogueId]?.items || [];
          if(list.length === 0) return alert("Catalogue empty");
          urls = list; // Pass objects
      } else if (mode === 'current') {
          if (rawCsvData.length > 0) {
               urls = rawCsvData.map(u => buildOrNormalizeUrl(u)).filter(Boolean);
          } else {
               const tabs = await chrome.tabs.query({ currentWindow: true });
               urls = tabs.filter(t => t.url && t.url.includes('.amazon.')).map(t => t.url);
          }
      } else if (mode === 'bulk') {
           urls = rawCsvData.map(u => buildOrNormalizeUrl(u)).filter(Boolean);
      }

      if (urls.length === 0) return alert("No valid URLs found.");

      const currentWindow = await chrome.windows.getCurrent();
      chrome.runtime.sendMessage({
          action: 'START_SCAN',
          payload: {
              urls,
              mode: (MEGA_MODE === 'auditor' ? 'catalogue' : mode),
              settings,
              targetWindowId: currentWindow.id
          }
      });
  }

  stopBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'STOP_SCAN' }));

  // --- Update Loop ---
  chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.auditState) {
          renderState(changes.auditState.newValue);
      }
  });

  // Initial Load
  const storedData = await chrome.storage.local.get('auditState');
  if(storedData.auditState) renderState(storedData.auditState);

  function renderState(state) {
      if (!state) return;
      currentIsScanning = state.isScanning;
      
      UIRenderer.updateProgress(state.processedCount, state.urlsToProcess.length, state.statusMessage, state.isScanning);

      if (state.isScanning) {
          UIRenderer.toggle('scanBtn', false);
          UIRenderer.toggle('auditCatalogueBtn', false);
          UIRenderer.toggle('stopBtn', true);
          // Hide sections
          showSection('none');
          UIRenderer.resetDashboard();
      } else {
          UIRenderer.toggle('scanBtn', (mode !== 'catalogue'));
          UIRenderer.toggle('auditCatalogueBtn', (mode === 'catalogue'));
          UIRenderer.toggle('stopBtn', false);
          
          if(state.results && state.results.length > 0) {
              UIRenderer.updateDashboard(state.results);
              UIRenderer.toggle('downloadBtn', true);
              UIRenderer.toggle('downloadXlsxBtn', true);
              UIRenderer.toggle('downloadErrorsBtn', state.results.some(r => r.error));
              UIRenderer.toggle('clearSection', true);
          } else {
              // Show active section
              if(mode === 'current') showSection('currentSection');
              if(mode === 'bulk') showSection('bulkSection');
              if(mode === 'catalogue') showSection('catalogueSection');
          }
      }
  }

  // --- File Inputs ---
  document.getElementById('csvInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim().length > 0);
          rawCsvData = lines;
          UIRenderer.setText('fileStatus', `Loaded ${lines.length} items.`);
      };
      reader.readAsText(file);
  });

  document.getElementById('pasteLinksBtn').addEventListener('click', async () => {
       const text = await navigator.clipboard.readText();
       const lines = text.split(/\r?\n/).filter(l => l.trim());
       if(lines.length) {
           rawCsvData = lines;
           UIRenderer.setText('pasteStatus', `Loaded ${lines.length} items from clipboard.`);
       }
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'CLEAR_DATA' });
      UIRenderer.resetDashboard();
      UIRenderer.toggle('downloadBtn', false);
      UIRenderer.toggle('downloadXlsxBtn', false);
      UIRenderer.toggle('clearSection', false);
      rawCsvData = [];
      showSection(mode === 'catalogue' ? 'catalogueSection' : (mode === 'bulk' ? 'bulkSection' : 'currentSection'));
  });

  document.getElementById('downloadBtn').addEventListener('click', async () => {
      const data = await ExportManager.getExportData(MEGA_MODE, AuthManager.isLoggedIn);
      ExportManager.downloadCSV(data);
  });

  document.getElementById('downloadXlsxBtn').addEventListener('click', async () => {
      const data = await ExportManager.getExportData(MEGA_MODE, AuthManager.isLoggedIn);
      ExportManager.downloadXLSX(data);
  });

});
