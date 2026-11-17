/**
 * Red Team Foundations // 90-Day Command Center (Community Edition)
 * Client-Side Sandboxed Vault & Direct GitHub REST API Engine
 */

// Application State
const state = {
  roadmap: (typeof window !== 'undefined' && window.ROADMAP_DATA) || null,
  config: {
    mode: 'local', // 'local' | 'github'
    username: '',
    repo: '',
    branch: 'main',
    token: ''
  },
  vault: [], // Array of saved notes
  drafts: [],
  progress: {
    completedDays: [],
    currentStreak: 0,
    lastActivityDate: ''
  },
  currentDraftId: null,
  activeTab: 'studio',
  activeView: 'split',
  activePhaseFilter: 'all',
  isZenFullscreen: false,

  // Timer State
  timer: {
    totalSeconds: 30 * 60,
    remainingSeconds: 30 * 60,
    isRunning: false,
    intervalId: null,
    currentPhase: 1
  },

  // Ambient Audio State
  ambient: {
    isPlaying: false,
    gainNode: null,
    sourceNode: null
  }
};

// Configure Marked with Highlight.js
if (window.marked) {
  marked.setOptions({
    highlight: function(code, lang) {
      if (window.hljs) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      }
      return code;
    },
    langPrefix: 'hljs language-',
    breaks: true,
    gfm: true
  });
}

// Web Audio API Synthesizer
const soundFx = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },
  playBeep(freq = 600, duration = 0.15, type = 'sine') {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) { console.warn(e); }
  },
  playVictory() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.15, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.35);
      });
    } catch (e) { console.warn(e); }
  },
  toggleAmbient(volume = 0.25) {
    try {
      this.init();
      if (!this.ctx) return false;

      if (state.ambient.isPlaying) {
        if (state.ambient.sourceNode) {
          state.ambient.sourceNode.stop();
          state.ambient.sourceNode.disconnect();
        }
        state.ambient.isPlaying = false;
        return false;
      } else {
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, this.ctx.currentTime);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        whiteNoise.start();
        state.ambient.sourceNode = whiteNoise;
        state.ambient.gainNode = gainNode;
        state.ambient.isPlaying = true;
        return true;
      }
    } catch (e) {
      console.warn('Ambient error:', e);
      return false;
    }
  },
  setAmbientVolume(val) {
    if (state.ambient.gainNode && this.ctx) {
      state.ambient.gainNode.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }
};

// Toast Notifications System
function showToast(title, desc, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-octagon' : 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-desc">${escapeHtml(desc)}</div>
    </div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// DOM Elements
const dom = {
  // Theme & Mobile Navigation
  topNav: document.getElementById('topNav'),
  btnHideNavbar: document.getElementById('btnHideNavbar'),
  btnRestoreNav: document.getElementById('btnRestoreNav'),
  activeTabIndicator: document.getElementById('activeTabIndicator'),
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  themeToggleIcon: document.getElementById('themeToggleIcon'),
  btnMobileNavToggle: document.getElementById('btnMobileNavToggle'),
  menuToggleIcon: document.getElementById('menuToggleIcon'),
  mobileNavDrawer: document.getElementById('mobileNavDrawer'),
  btnMobileSetupModal: document.getElementById('btnMobileSetupModal'),
  mobileRoadmapBadge: document.getElementById('mobileRoadmapBadge'),
  mobileVaultBadge: document.getElementById('mobileVaultBadge'),

  // Tabs
  tabBtns: document.querySelectorAll('.tab-btn, .nav-tab-link'),
  tabPanes: document.querySelectorAll('.tab-pane'),

  // Header
  headerOperatorName: document.getElementById('headerOperatorName'),
  headerStorageMode: document.getElementById('headerStorageMode'),
  headerRepoBadge: document.getElementById('headerRepoBadge'),
  btnOpenSetupModal: document.getElementById('btnOpenSetupModal'),

  // Studio
  studioContainer: document.getElementById('studioContainer'),
  daySelect: document.getElementById('daySelect'),
  folderSelect: document.getElementById('folderSelect'),
  folderPrefixLabel: document.getElementById('folderPrefixLabel'),
  filenameInput: document.getElementById('filenameInput'),
  titleInput: document.getElementById('titleInput'),
  markdownEditor: document.getElementById('markdownEditor'),
  markdownPreview: document.getElementById('markdownPreview'),
  commitMsgInput: document.getElementById('commitMsgInput'),
  wordCountLabel: document.getElementById('wordCountLabel'),
  charCountLabel: document.getElementById('charCountLabel'),
  readingTimeLabel: document.getElementById('readingTimeLabel'),
  draftStatusText: document.getElementById('draftStatusText'),
  draftCountBadge: document.getElementById('draftCountBadge'),
  panesWrapper: document.getElementById('panesWrapper'),
  viewBtns: document.querySelectorAll('.view-btn'),
  actionTargetLabel: document.getElementById('actionTargetLabel'),
  btnSaveToLocalVault: document.getElementById('btnSaveToLocalVault'),
  btnPostToGitHub: document.getElementById('btnPostToGitHub'),
  btnPostLabel: document.getElementById('btnPostLabel'),

  // Studio Toolbar & Buttons
  btnLoad5Questions: document.getElementById('btnLoad5Questions'),
  btnLoadDay1: document.getElementById('btnLoadDay1'),
  btnLoadLabTemplate: document.getElementById('btnLoadLabTemplate'),
  btnOpenSnippetsBar: document.getElementById('btnOpenSnippetsBar'),
  btnClearEditor: document.getElementById('btnClearEditor'),
  btnSaveDraftManual: document.getElementById('btnSaveDraftManual'),
  btnOpenDraftsModal: document.getElementById('btnOpenDraftsModal'),
  btnCopyMarkdown: document.getElementById('btnCopyMarkdown'),
  btnDownloadMarkdown: document.getElementById('btnDownloadMarkdown'),
  btnToggleZen: document.getElementById('btnToggleZen'),

  // Course Lesson Nav Elements
  btnPrevDay: document.getElementById('btnPrevDay'),
  btnNextDay: document.getElementById('btnNextDay'),
  btnToggleDayStatus: document.getElementById('btnToggleDayStatus'),
  dayStatusIcon: document.getElementById('dayStatusIcon'),
  dayStatusText: document.getElementById('dayStatusText'),

  // Daily Course Mission & Tasks Card Elements
  courseTaskCard: document.getElementById('courseTaskCard'),
  btnToggleTaskCard: document.getElementById('btnToggleTaskCard'),
  taskToggleIcon: document.getElementById('taskToggleIcon'),
  taskWeekBadge: document.getElementById('taskWeekBadge'),
  taskPhaseBadge: document.getElementById('taskPhaseBadge'),
  taskGoalText: document.getElementById('taskGoalText'),
  taskResourceLink: document.getElementById('taskResourceLink'),
  taskResourceName: document.getElementById('taskResourceName'),
  task1Desc: document.getElementById('task1Desc'),
  task2Desc: document.getElementById('task2Desc'),
  task3Desc: document.getElementById('task3Desc'),
  taskCheck1: document.getElementById('taskCheck1'),
  taskCheck2: document.getElementById('taskCheck2'),
  taskCheck3: document.getElementById('taskCheck3'),
  taskCounterChip: document.getElementById('taskCounterChip'),

  // Toolbar & Drawer
  btnToggleMetadata: document.getElementById('btnToggleMetadata'),
  metadataDrawer: document.getElementById('metadataDrawer'),

  // Roadmap Elements
  weeksAccordionContainer: document.getElementById('weeksAccordionContainer'),
  matrixGridContainer: document.getElementById('matrixGridContainer'),
  roadmapProgressBar: document.getElementById('roadmapProgressBar'),
  roadmapPercent: document.getElementById('roadmapPercent'),
  completedCountText: document.getElementById('completedCountText'),
  daysRemainingText: document.getElementById('daysRemainingText'),
  roadmapProgressBadge: document.getElementById('roadmapProgressBadge'),
  phaseBtns: document.querySelectorAll('.phase-btn'),
  btnExpandAllWeeks: document.getElementById('btnExpandAllWeeks'),
  btnCollapseAllWeeks: document.getElementById('btnCollapseAllWeeks'),

  // Timer Elements
  timerDisplay: document.getElementById('timerDisplay'),
  timerCurrentPhaseName: document.getElementById('timerCurrentPhaseName'),
  timerProgressCircle: document.getElementById('timerProgressCircle'),
  btnTimerToggle: document.getElementById('btnTimerToggle'),
  timerToggleIcon: document.getElementById('timerToggleIcon'),
  timerToggleText: document.getElementById('timerToggleText'),
  btnTimerReset: document.getElementById('btnTimerReset'),
  btnTimerSoundTest: document.getElementById('btnTimerSoundTest'),
  btnOpenTimerHeader: document.getElementById('btnOpenTimerHeader'),
  btnQuickNewNote: document.getElementById('btnQuickNewNote'),
  btnOpenCheatsheet: document.getElementById('btnOpenCheatsheet'),
  phaseBox1: document.getElementById('phaseBox1'),
  phaseBox2: document.getElementById('phaseBox2'),
  phaseBox3: document.getElementById('phaseBox3'),
  btnToggleAmbient: document.getElementById('btnToggleAmbient'),
  ambientIcon: document.getElementById('ambientIcon'),
  ambientText: document.getElementById('ambientText'),
  ambientVolume: document.getElementById('ambientVolume'),

  // My Vault Elements
  vaultCountBadge: document.getElementById('vaultCountBadge'),
  vaultTreeContainer: document.getElementById('vaultTreeContainer'),
  vaultSearchInput: document.getElementById('vaultSearchInput'),
  btnRefreshVault: document.getElementById('btnRefreshVault'),
  btnExportAllNotes: document.getElementById('btnExportAllNotes'),
  viewerPath: document.getElementById('viewerPath'),
  viewerContent: document.getElementById('viewerContent'),
  viewerActions: document.getElementById('viewerActions'),
  btnEditInStudio: document.getElementById('btnEditInStudio'),
  btnDownloadSingleVaultNote: document.getElementById('btnDownloadSingleVaultNote'),
  btnDeleteVaultNote: document.getElementById('btnDeleteVaultNote'),

  // Settings
  cardModeLocal: document.getElementById('cardModeLocal'),
  cardModeGitHub: document.getElementById('cardModeGitHub'),
  githubConfigBox: document.getElementById('githubConfigBox'),
  cfgUsername: document.getElementById('cfgUsername'),
  cfgRepo: document.getElementById('cfgRepo'),
  cfgBranch: document.getElementById('cfgBranch'),
  cfgToken: document.getElementById('cfgToken'),
  btnTestGitHubConnection: document.getElementById('btnTestGitHubConnection'),
  btnSaveGitHubConfig: document.getElementById('btnSaveGitHubConfig'),
  btnDisconnectGitHub: document.getElementById('btnDisconnectGitHub'),

  // Modals
  setupModal: document.getElementById('setupModal'),
  btnCloseSetupModal: document.getElementById('btnCloseSetupModal'),
  draftsModal: document.getElementById('draftsModal'),
  btnCloseDraftsModal: document.getElementById('btnCloseDraftsModal'),
  draftsListContainer: document.getElementById('draftsListContainer'),
  cheatsheetModal: document.getElementById('cheatsheetModal'),
  btnCloseCheatsheetModal: document.getElementById('btnCloseCheatsheetModal'),
  successModal: document.getElementById('successModal'),
  btnCloseSuccessModal: document.getElementById('btnCloseSuccessModal'),
  successTitle: document.getElementById('successTitle'),
  successDesc: document.getElementById('successDesc'),
  successLinksBox: document.getElementById('successLinksBox'),
  successFileLink: document.getElementById('successFileLink')
};

// Initialize Community App
document.addEventListener('DOMContentLoaded', async () => {
  setupTheme();
  lucide.createIcons();

  loadStoredUserConfig();
  loadStoredVault();
  loadStoredProgress();
  loadStoredDrafts();

  setupTabs();
  setupMobileNavbar();
  setupEditorEvents();
  setupFormattingToolbar();
  setupTimer();
  setupAmbientAudio();
  setupModals();
  setupSettingsUI();

  await loadRoadmap();

  restoreLocalDraft();
  if (!dom.markdownEditor.value || !dom.markdownEditor.value.trim()) {
    selectDayAndLoadContent(1);
  }
  setInterval(autoSaveLocalDraft, 5000);
});

// ==========================================
// Theme Management (Light / Dark)
// ==========================================
function setupTheme() {
  const savedTheme = localStorage.getItem('redteam_theme') || 'dark';
  applyTheme(savedTheme, false);

  if (dom.btnThemeToggle) {
    dom.btnThemeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next, true);
    });
  }
}

function applyTheme(theme, notify = false) {
  const isLight = theme === 'light';
  if (isLight) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.classList.add('theme-light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('theme-light');
  }
  localStorage.setItem('redteam_theme', theme);

  if (dom.themeToggleIcon) {
    dom.themeToggleIcon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
    if (window.lucide) lucide.createIcons();
  }
  if (dom.btnThemeToggle) {
    const label = isLight ? 'Switch to Dark Theme' : 'Switch to White Theme';
    dom.btnThemeToggle.setAttribute('title', label);
    dom.btnThemeToggle.setAttribute('aria-label', label);
  }
  if (notify && typeof showToast === 'function') {
    showToast(`Theme switched to ${isLight ? 'White (GitHub Light)' : 'GitHub Dark'}`, 'info');
  }
}

// ==========================================
// Mobile Navigation Drawer Management
// ==========================================
function setupMobileNavbar() {
  if (dom.btnMobileNavToggle && dom.mobileNavDrawer) {
    dom.btnMobileNavToggle.addEventListener('click', () => {
      const isOpen = dom.mobileNavDrawer.classList.toggle('open');
      dom.mobileNavDrawer.setAttribute('aria-hidden', !isOpen);
      if (dom.menuToggleIcon) {
        dom.menuToggleIcon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  if (dom.mobileNavDrawer) {
    dom.mobileNavDrawer.querySelectorAll('.mobile-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
        dom.mobileNavDrawer.classList.remove('open');
        dom.mobileNavDrawer.setAttribute('aria-hidden', 'true');
        if (dom.menuToggleIcon) {
          dom.menuToggleIcon.setAttribute('data-lucide', 'menu');
          if (window.lucide) lucide.createIcons();
        }
      });
    });
  }

  if (dom.btnMobileSetupModal && dom.btnOpenSetupModal) {
    dom.btnMobileSetupModal.addEventListener('click', () => {
      dom.mobileNavDrawer?.classList.remove('open');
      dom.btnOpenSetupModal.click();
    });
  }

  // Close mobile drawer on outside click
  document.addEventListener('click', (e) => {
    if (dom.mobileNavDrawer?.classList.contains('open')) {
      if (!dom.mobileNavDrawer.contains(e.target) && !dom.btnMobileNavToggle?.contains(e.target)) {
        dom.mobileNavDrawer.classList.remove('open');
        dom.mobileNavDrawer.setAttribute('aria-hidden', 'true');
        if (dom.menuToggleIcon) {
          dom.menuToggleIcon.setAttribute('data-lucide', 'menu');
          if (window.lucide) lucide.createIcons();
        }
      }
    }
  });
}

// ==========================================
// Config & Storage Management
// ==========================================
function loadStoredUserConfig() {
  try {
    const raw = localStorage.getItem('redteam_community_config');
    if (raw) {
      state.config = { ...state.config, ...JSON.parse(raw) };
    }
  } catch (e) { console.warn(e); }
  updateHeaderConfigUI();
}

function saveUserConfig() {
  localStorage.setItem('redteam_community_config', JSON.stringify(state.config));
  updateHeaderConfigUI();
}

function updateHeaderConfigUI() {
  const isGitHub = state.config.mode === 'github' && state.config.token && state.config.repo;
  if (dom.headerOperatorName) {
    dom.headerOperatorName.textContent = state.config.username || 'You';
  }
  if (dom.headerStorageMode) {
    dom.headerStorageMode.textContent = isGitHub ? 'GitHub Cloud' : 'Local Vault';
    dom.headerStorageMode.className = `stat-value ${isGitHub ? 'highlight-cyan' : 'highlight-yellow'}`;
  }
  if (dom.headerRepoBadge) {
    dom.headerRepoBadge.textContent = isGitHub ? `${state.config.username}/${state.config.repo}` : 'Offline Browser Vault';
  }
  if (dom.actionTargetLabel) {
    dom.actionTargetLabel.textContent = isGitHub ? `GitHub (${state.config.repo})` : 'Local Vault';
  }
  if (dom.btnPostLabel) {
    dom.btnPostLabel.textContent = isGitHub ? 'POST TO MY GITHUB' : 'COMMIT TO GITHUB (CONNECT)';
  }
}

function selectStorageMode(mode) {
  state.config.mode = mode;
  saveUserConfig();
  updateSettingsCardStyles();
  showToast('Storage Mode Changed', mode === 'local' ? 'Active storage: Local Browser Vault' : 'Active storage: GitHub Cloud Sync', 'info');
}

function updateSettingsCardStyles() {
  const isGitHub = state.config.mode === 'github';
  if (dom.cardModeLocal) dom.cardModeLocal.classList.toggle('active', !isGitHub);
  if (dom.cardModeGitHub) dom.cardModeGitHub.classList.toggle('active', isGitHub);
  if (dom.githubConfigBox) {
    dom.githubConfigBox.style.opacity = isGitHub ? '1' : '0.6';
  }
}

// ==========================================
// Tab Management
// ==========================================
function setupTabs() {
  dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  if (dom.btnOpenTimerHeader) {
    dom.btnOpenTimerHeader.addEventListener('click', () => switchTab('timer'));
  }
  if (dom.btnQuickNewNote) {
    dom.btnQuickNewNote.addEventListener('click', () => switchTab('studio'));
  }
  if (dom.btnOpenSetupModal) {
    dom.btnOpenSetupModal.addEventListener('click', () => {
      switchTab('settings');
    });
  }
}

function switchTab(tabName) {
  state.activeTab = tabName;
  const tabTitles = {
    'studio': "Today's Mission",
    'roadmap': "Course Syllabus",
    'timer': "30-Min Protocol",
    'my-vault': "My Vault",
    'arsenal': "Resources",
    'settings': "GitHub / Vault"
  };
  if (dom.activeTabIndicator && tabTitles[tabName]) {
    dom.activeTabIndicator.textContent = tabTitles[tabName];
  }
  dom.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  if (dom.mobileNavDrawer) {
    dom.mobileNavDrawer.querySelectorAll('.mobile-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
  }
  dom.tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane-${tabName}`);
  });
  const activeTabBtn = document.querySelector(`.main-tabs-bar .tab-btn[data-tab="${tabName}"]`);
  if (activeTabBtn) {
    activeTabBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  if (tabName === 'my-vault') renderVaultTree();
  lucide.createIcons();
}

// ==========================================
// Formatting Toolbar
// ==========================================
function setupFormattingToolbar() {
  const toolbarBtns = document.querySelectorAll('.toolbar-btn');
  toolbarBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.getAttribute('data-format');
      applyFormatting(format);
    });
  });
}

function applyFormatting(format) {
  const textarea = dom.markdownEditor;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  let replacement = '';

  switch (format) {
    case 'bold': replacement = `**${selectedText || 'bold text'}**`; break;
    case 'italic': replacement = `*${selectedText || 'italic text'}*`; break;
    case 'strikethrough': replacement = `~~${selectedText || 'strikethrough'}~~`; break;
    case 'h1': replacement = `\n# ${selectedText || 'Heading 1'}\n`; break;
    case 'h2': replacement = `\n## ${selectedText || 'Heading 2'}\n`; break;
    case 'h3': replacement = `\n### ${selectedText || 'Heading 3'}\n`; break;
    case 'inline-code': replacement = `\`${selectedText || 'code'}\``; break;
    case 'code-bash': replacement = `\n\`\`\`bash\n${selectedText || '# Enter bash commands here\n'}\`\`\`\n`; break;
    case 'code-python': replacement = `\n\`\`\`python\n${selectedText || '# Enter python code here\n'}\`\`\`\n`; break;
    case 'code-powershell': replacement = `\n\`\`\`powershell\n${selectedText || '# Enter powershell commands here\n'}\`\`\`\n`; break;
    case 'quote': replacement = `\n> ${selectedText || 'Quote / Insight'}\n`; break;
    case 'bullet-list': replacement = `\n- ${selectedText || 'List item'}\n`; break;
    case 'task-list': replacement = `\n- [ ] ${selectedText || 'Checklist item'}\n`; break;
    case 'table': replacement = `\n| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| Item 1 | Item 2 | Item 3 |\n`; break;
    case 'link': replacement = `[${selectedText || 'Link Title'}](https://example.com)`; break;
    case 'hr': replacement = `\n\n---\n\n`; break;
    default: return;
  }

  textarea.setRangeText(replacement, start, end, 'end');
  textarea.focus();
  renderMarkdown();
  updateEditorStats();
  soundFx.playBeep(500, 0.05);
}

// ==========================================
// Editor & Live Markdown Engine
// ==========================================
function setupEditorEvents() {
  dom.markdownEditor.addEventListener('input', () => {
    renderMarkdown();
    updateEditorStats();
  });

  dom.markdownEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = dom.markdownEditor.selectionStart;
      const end = dom.markdownEditor.selectionEnd;
      dom.markdownEditor.setRangeText('  ', start, end, 'end');
      renderMarkdown();
      updateEditorStats();
    }
  });

  dom.folderSelect.addEventListener('change', () => {
    const folder = dom.folderSelect.value;
    dom.folderPrefixLabel.textContent = `${folder}/`;
    updateCommitMessageSuggestion();
  });

  // Day dropdown change
  dom.daySelect.addEventListener('change', () => {
    const dayNum = parseInt(dom.daySelect.value, 10);
    selectDayAndLoadContent(dayNum);
  });

  dom.titleInput.addEventListener('input', updateCommitMessageSuggestion);
  dom.filenameInput.addEventListener('input', updateCommitMessageSuggestion);

  dom.viewBtns.forEach(btn => {
    if (btn.id === 'btnToggleZen') return;
    btn.addEventListener('click', () => setViewMode(btn.getAttribute('data-view')));
  });

  // Responsive auto-adapt for mobile screens (<= 880px)
  if (window.innerWidth <= 880 && state.activeView === 'split') {
    setViewMode('edit');
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 880 && state.activeView === 'split') {
      setViewMode('edit');
    }
  });

  dom.btnToggleZen.addEventListener('click', () => {
    state.isZenFullscreen = !state.isZenFullscreen;
    dom.studioContainer.classList.toggle('zen-fullscreen', state.isZenFullscreen);
    dom.btnToggleZen.classList.toggle('active', state.isZenFullscreen);
    dom.btnToggleZen.innerHTML = state.isZenFullscreen ? `<i data-lucide="minimize-2"></i>` : `<i data-lucide="maximize-2"></i>`;
    lucide.createIcons();
  });

  // Hide & Restore Navbar on Desktop / Focus
  if (dom.btnHideNavbar) {
    dom.btnHideNavbar.addEventListener('click', () => {
      dom.topNav?.classList.add('navbar-hidden');
      dom.btnRestoreNav?.classList.add('visible');
      showToast('Navbar Hidden', 'Desktop distraction-free focus. Click "Show Navbar" or press Esc.', 'info');
    });
  }
  if (dom.btnRestoreNav) {
    dom.btnRestoreNav.addEventListener('click', () => {
      dom.topNav?.classList.remove('navbar-hidden');
      dom.btnRestoreNav?.classList.remove('visible');
    });
  }

  // Esc key exits Zen mode and restores navbar
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dom.topNav?.classList.contains('navbar-hidden')) {
        dom.topNav.classList.remove('navbar-hidden');
        dom.btnRestoreNav?.classList.remove('visible');
      }
      if (dom.mobileNavDrawer?.classList.contains('open')) {
        dom.mobileNavDrawer.classList.remove('open');
      }
      if (state.isZenFullscreen) {
        state.isZenFullscreen = false;
        dom.studioContainer.classList.remove('zen-fullscreen');
        dom.btnToggleZen.classList.remove('active');
        dom.btnToggleZen.innerHTML = `<i data-lucide="maximize-2"></i>`;
        lucide.createIcons();
      }
    }
  });

  // Action Buttons
  if (dom.btnLoad5Questions) {
    dom.btnLoad5Questions.addEventListener('click', () => {
      insert5QuestionsTemplate();
      showToast('Template Loaded', '5-Question Framework inserted', 'info');
    });
  }

  if (dom.btnLoadDay1) {
    dom.btnLoadDay1.addEventListener('click', () => {
      loadDay1Kickoff();
      showToast('Day 1 Kickoff', 'Computer & Networking Fundamentals loaded', 'info');
    });
  }

  if (dom.btnLoadLabTemplate) {
    dom.btnLoadLabTemplate.addEventListener('click', () => {
      loadLabReportTemplate();
      showToast('Lab Report Loaded', 'Security Assessment Report template loaded', 'info');
    });
  }

  if (dom.btnOpenSnippetsBar && dom.cheatsheetModal) {
    dom.btnOpenSnippetsBar.addEventListener('click', () => {
      dom.cheatsheetModal.classList.add('open');
    });
  }

  dom.btnClearEditor.addEventListener('click', () => {
    if (confirm('Clear the editor?')) {
      dom.markdownEditor.value = '';
      renderMarkdown();
      updateEditorStats();
    }
  });

  dom.btnSaveDraftManual.addEventListener('click', saveDraftManual);
  dom.btnOpenDraftsModal.addEventListener('click', openDraftsModal);

  dom.btnCopyMarkdown.addEventListener('click', () => {
    navigator.clipboard.writeText(dom.markdownEditor.value);
    showToast('Copied to Clipboard', 'Markdown copied', 'success');
  });

  dom.btnDownloadMarkdown.addEventListener('click', () => {
    downloadMarkdownFile();
  });

  if (dom.btnSaveToLocalVault) {
    dom.btnSaveToLocalVault.addEventListener('click', () => {
      saveCurrentNoteToVault();
    });
  }

  dom.btnPostToGitHub.addEventListener('click', () => {
    handlePostOrCommit();
  });

  // Course Lesson Navigation (Prev / Next Day)
  if (dom.btnPrevDay) {
    dom.btnPrevDay.addEventListener('click', () => {
      const current = parseInt(dom.daySelect.value, 10) || 1;
      if (current > 1) selectDayAndLoadContent(current - 1);
    });
  }
  if (dom.btnNextDay) {
    dom.btnNextDay.addEventListener('click', () => {
      const current = parseInt(dom.daySelect.value, 10) || 1;
      if (current < 90) selectDayAndLoadContent(current + 1);
    });
  }

  // Toggle Day Status from Workspace Header
  if (dom.btnToggleDayStatus) {
    dom.btnToggleDayStatus.addEventListener('click', () => {
      const dayNum = parseInt(dom.daySelect.value, 10) || 1;
      toggleDayProgress(dayNum);
    });
  }

  // Toggle Daily Tasks Card Collapse/Expand
  if (dom.btnToggleTaskCard) {
    dom.btnToggleTaskCard.addEventListener('click', () => {
      if (dom.courseTaskCard) {
        dom.courseTaskCard.classList.toggle('collapsed');
        const isCollapsed = dom.courseTaskCard.classList.contains('collapsed');
        if (dom.taskToggleIcon) {
          dom.taskToggleIcon.setAttribute('data-lucide', isCollapsed ? 'chevron-down' : 'chevron-up');
          if (window.lucide) lucide.createIcons();
        }
      }
    });
  }

  // Toggle Custom Metadata / File Path Drawer
  if (dom.btnToggleMetadata) {
    dom.btnToggleMetadata.addEventListener('click', () => {
      if (dom.metadataDrawer) dom.metadataDrawer.classList.toggle('open');
    });
  }

  // Interactive Daily Checklist Checkboxes
  [1, 2, 3].forEach(idx => {
    const chk = dom[`taskCheck${idx}`];
    if (chk) {
      chk.addEventListener('change', () => {
        const day = parseInt(dom.daySelect.value, 10) || 1;
        chk.closest('.task-item')?.classList.toggle('checked', chk.checked);
        saveDayTasksState(day);
        updateTaskCounter();
      });
    }
  });

  // Expand / Collapse All Weeks in Roadmap
  if (dom.btnExpandAllWeeks) {
    dom.btnExpandAllWeeks.addEventListener('click', () => {
      document.querySelectorAll('.week-card').forEach(c => c.classList.add('open'));
    });
  }
  if (dom.btnCollapseAllWeeks) {
    dom.btnCollapseAllWeeks.addEventListener('click', () => {
      document.querySelectorAll('.week-card').forEach(c => c.classList.remove('open'));
    });
  }
}

function renderMarkdown() {
  const rawText = dom.markdownEditor.value;
  if (!rawText.trim()) {
    dom.markdownPreview.innerHTML = `
      <div class="empty-state">
        <i data-lucide="eye" class="empty-icon"></i>
        <p>Live preview will appear here formatted with syntax highlighting.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  try {
    const parser = (typeof marked !== 'undefined') ? marked : (typeof window !== 'undefined' && window.marked ? window.marked : null);
    if (parser) {
      dom.markdownPreview.innerHTML = typeof parser.parse === 'function' ? parser.parse(rawText) : parser(rawText);
    } else {
      dom.markdownPreview.innerHTML = `<pre style="white-space: pre-wrap; font-family: var(--font-mono);">${escapeHtml(rawText)}</pre>`;
    }
  } catch (err) {
    console.warn('Markdown parsing error:', err);
    dom.markdownPreview.innerHTML = `<pre style="white-space: pre-wrap; font-family: var(--font-mono);">${escapeHtml(rawText)}</pre>`;
  }
}

function updateEditorStats() {
  const text = dom.markdownEditor.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  dom.wordCountLabel.textContent = `${words.toLocaleString()} words`;
  if (dom.charCountLabel) dom.charCountLabel.textContent = `${chars.toLocaleString()} chars`;
  dom.readingTimeLabel.textContent = `${readingTime} min read`;
}

function setViewMode(mode) {
  state.activeView = mode;
  dom.viewBtns.forEach(btn => {
    if (btn.id === 'btnToggleZen') return;
    btn.classList.toggle('active', btn.getAttribute('data-view') === mode);
  });
  dom.panesWrapper.className = `studio-panes-wrapper ${mode}-mode`;
}

function updateCommitMessageSuggestion() {
  const day = dom.daySelect.value;
  const title = dom.titleInput.value.trim() || dom.filenameInput.value.trim();
  dom.commitMsgInput.value = `feat(notes): Day ${String(day).padStart(2, '0')} - ${title}`;
}

function downloadMarkdownFile() {
  const content = dom.markdownEditor.value;
  const filename = dom.filenameInput.value || 'note.md';
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded File', `${filename} saved`, 'success');
}

// Global Snippet Inserter
window.insertSnippet = (code) => {
  const textarea = dom.markdownEditor;
  const snippet = `\n\`\`\`bash\n${code}\n\`\`\`\n`;
  const start = textarea.selectionStart;
  textarea.setRangeText(snippet, start, start, 'end');
  textarea.focus();
  renderMarkdown();
  updateEditorStats();
  if (dom.cheatsheetModal) dom.cheatsheetModal.classList.remove('open');
  showToast('Snippet Inserted', code, 'success');
};

// Task Checklist State Persistence
function saveDayTasksState(dayNum) {
  try {
    const stateObj = {
      t1: dom.taskCheck1 ? dom.taskCheck1.checked : false,
      t2: dom.taskCheck2 ? dom.taskCheck2.checked : false,
      t3: dom.taskCheck3 ? dom.taskCheck3.checked : false
    };
    localStorage.setItem(`redteam_day_tasks_${dayNum}`, JSON.stringify(stateObj));
  } catch (e) {
    console.warn(e);
  }
}

function updateTaskCounter() {
  const c1 = dom.taskCheck1 && dom.taskCheck1.checked ? 1 : 0;
  const c2 = dom.taskCheck2 && dom.taskCheck2.checked ? 1 : 0;
  const c3 = dom.taskCheck3 && dom.taskCheck3.checked ? 1 : 0;
  const total = c1 + c2 + c3;
  if (dom.taskCounterChip) {
    if (total === 3) {
      dom.taskCounterChip.textContent = '3/3 Done ✓';
      dom.taskCounterChip.classList.add('all-done');
    } else {
      dom.taskCounterChip.textContent = `${total}/3 Tasks`;
      dom.taskCounterChip.classList.remove('all-done');
    }
  }
}

function loadDayTasksState(dayNum) {
  try {
    const raw = localStorage.getItem(`redteam_day_tasks_${dayNum}`);
    const stateObj = raw ? JSON.parse(raw) : { t1: false, t2: false, t3: false };
    [1, 2, 3].forEach(idx => {
      const chk = dom[`taskCheck${idx}`];
      if (chk) {
        chk.checked = !!stateObj[`t${idx}`];
        chk.closest('.task-item')?.classList.toggle('checked', chk.checked);
      }
    });
    updateTaskCounter();
  } catch (e) {
    console.warn(e);
  }
}

// Select Day & Automatically Load Full Content
function selectDayAndLoadContent(dayNum) {
  if (!state.roadmap && typeof window !== 'undefined' && window.ROADMAP_DATA) {
    state.roadmap = window.ROADMAP_DATA;
  }
  if (!state.roadmap || !state.roadmap.days) return;
  const dayData = state.roadmap.days.find(d => d.day === dayNum);
  if (!dayData) return;

  dom.daySelect.value = String(dayNum);
  dom.folderSelect.value = dayData.folder;
  dom.folderPrefixLabel.textContent = `${dayData.folder}/`;
  dom.filenameInput.value = dayData.file || `day-${String(dayNum).padStart(2, '0')}.md`;
  dom.titleInput.value = dayData.title;
  updateCommitMessageSuggestion();

  // Update Prev / Next Buttons
  if (dom.btnPrevDay) dom.btnPrevDay.disabled = dayNum <= 1;
  if (dom.btnNextDay) dom.btnNextDay.disabled = dayNum >= 90;

  // Update Day Completion Status Button
  const isCompleted = state.progress && state.progress.completedDays && state.progress.completedDays.includes(dayNum);
  if (dom.btnToggleDayStatus) {
    dom.btnToggleDayStatus.classList.toggle('completed', isCompleted);
    if (dom.dayStatusText) dom.dayStatusText.textContent = isCompleted ? 'Completed ✓' : 'Mark Complete';
    if (dom.dayStatusIcon) {
      dom.dayStatusIcon.setAttribute('data-lucide', isCompleted ? 'check-circle' : 'circle');
      if (window.lucide) lucide.createIcons();
    }
  }

  // Update Course Mission & Tasks Checklist Card
  const weekInfo = state.roadmap.weeks ? state.roadmap.weeks.find(w => w.week === dayData.week) : null;
  const phaseInfo = state.roadmap.phases ? state.roadmap.phases.find(p => p.id === (weekInfo ? weekInfo.phaseId : 1)) : null;

  if (dom.taskWeekBadge) dom.taskWeekBadge.textContent = `WEEK ${String(dayData.week).padStart(2, '0')}`;
  if (dom.taskPhaseBadge) dom.taskPhaseBadge.textContent = phaseInfo ? phaseInfo.name : 'Technical Foundations';
  if (dom.taskGoalText) dom.taskGoalText.textContent = weekInfo ? weekInfo.goal : 'Understand the technical foundations';
  if (dom.taskResourceLink && weekInfo) {
    dom.taskResourceLink.href = weekInfo.resourceUrl || '#';
    if (dom.taskResourceName) dom.taskResourceName.textContent = weekInfo.resource || 'Official Resource';
  }
  if (dom.task1Desc) dom.task1Desc.textContent = `Study "${dayData.title}" in documentation & resources (15 min).`;
  if (dom.task2Desc) dom.task2Desc.textContent = `Hands-on practice & terminal diagnostics for ${dayData.title} (10 min).`;
  if (dom.task3Desc) dom.task3Desc.textContent = `Document understanding in the 5 Core Questions below (5 min).`;

  loadDayTasksState(dayNum);

  // 1. Look for existing saved note in user's vault
  const expectedPath = `${dayData.folder}/${dayData.file}`;
  const existingNote = state.vault && state.vault.find(n => 
    n.path === expectedPath || 
    n.filename === dayData.file ||
    (n.day && n.day === dayNum)
  );

  if (existingNote && existingNote.content) {
    dom.markdownEditor.value = existingNote.content;
    renderMarkdown();
    updateEditorStats();
    showToast('Vault Note Loaded', `Loaded note for Day ${dayNum} (${existingNote.title})`, 'success');
    return;
  }

  // 2. Look for existing draft
  const existingDraft = state.drafts && state.drafts.find(d => 
    d.filename === dayData.file || d.day === dayNum
  );
  if (existingDraft && existingDraft.content) {
    dom.markdownEditor.value = existingDraft.content;
    renderMarkdown();
    updateEditorStats();
    showToast('Draft Loaded', `Loaded saved draft for Day ${dayNum}`, 'info');
    return;
  }

  // 3. Auto-populate structured curriculum template for this day
  const defaultTemplate = `# Day ${String(dayNum).padStart(2, '0')}: ${dayData.title}

- **Date:** ${new Date().toISOString().split('T')[0]}
- **Phase:** ${phaseInfo ? phaseInfo.name : 'Technical Foundations'}
- **Curriculum:** Week ${dayData.week} — ${weekInfo ? weekInfo.title : ''}
- **Module Directory:** \`${dayData.folder}/\`
- **Primary Resource:** [${weekInfo ? weekInfo.resource : 'Documentation'}](${weekInfo ? weekInfo.resourceUrl : '#'})
- **Practical Goal:** ${weekInfo ? weekInfo.goal : ''}

---

## 1. What is it?
Explain **${dayData.title}** in your own words. Focus on the core architectural mechanism and technical definition.

## 2. How does it work?
Detail the step-by-step mechanism, request/response cycles, packet headers, or operating system structures.

## 3. Why does a Red Teamer / Security Professional need it?
How do adversaries abuse or bypass this? What is the offensive attack surface and defensive detection strategy?

## 4. What did I practise today?
Detail hands-on terminal commands, packet analyses, scripts written, or labs solved during your 30-minute protocol.

\`\`\`bash
# Commands executed and terminal output:
\`\`\`

## 5. What did I learn from the exercise?
Key engineering takeaways, pitfalls encountered, and active recall summary.
`;

  dom.markdownEditor.value = defaultTemplate;
  renderMarkdown();
  updateEditorStats();
}

// ==========================================
// Templates
// ==========================================
function insert5QuestionsTemplate() {
  const day = dom.daySelect.value;
  const title = dom.titleInput.value.trim() || 'Concept Title';
  const folder = dom.folderSelect.value;
  const today = new Date().toISOString().split('T')[0];

  dom.markdownEditor.value = `# ${title}

- **Date:** ${today}
- **Module:** \`${folder}\`
- **Track:** Red Team Foundation Roadmap (Day ${day} of 90)
- **Status:** In Progress / Completed
- **Session Duration:** 30 Minutes

---

## 1. What is it?
> Briefly define the concept or technology in simple, clear terms.

[Write definition here...]

---

## 2. How does it work?
> Explain the underlying architecture, mechanism, protocol flow, or data structure.

[Explain mechanics, diagrams, packet flows, or architecture here...]

---

## 3. Why does a security professional need it?
> Connect this technical foundation to offensive/defensive cybersecurity. How do attackers exploit it, or how do defenders monitor it?

[Explain the security perspective, attack vectors, or defense importance here...]

---

## 4. What did I practise?
> Document hands-on action: commands run, Wireshark packets analyzed, scripts executed, or challenges solved.

\`\`\`bash
# Commands executed during the 30-minute practice session
\`\`\`

- Observations:
  - 

---

## 5. What did I learn from the exercise?
> Key takeaways, mistakes made, "aha" moments, and one sentence summary of understanding.

- Key takeaway:
- What surprised me:
- Next step:
`;

  renderMarkdown();
  updateEditorStats();
}

function loadDay1Kickoff() {
  dom.daySelect.value = "1";
  dom.folderSelect.value = "01-networking";
  dom.folderPrefixLabel.textContent = "01-networking/";
  dom.filenameInput.value = "day-01-networking-fundamentals.md";
  dom.titleInput.value = "Client-Server Architecture, IP & MAC Addresses, DNS Intro";
  updateCommitMessageSuggestion();

  dom.markdownEditor.value = `# Day 01: Computer & Networking Fundamentals

- **Date:** 2026-11-16
- **Module:** \`01-networking\`
- **Track:** Red Team Foundation Roadmap (Day 1 of 90)
- **Status:** In Progress
- **Session Focus:** Client-Server Architecture, IP & MAC Addresses, DNS Resolution

---

## 1. What is it?
Computer networking is the interconnected system of computing devices exchanging data over communication links. 

On Day 1, we focus on three core building blocks:
1. **Client-Server Architecture:** A distributed computing framework where service requestors (*clients*, e.g., web browser) communicate with centralized service providers (*servers*, e.g., Nginx, Apache).
2. **Addressing (IP vs MAC):**
   - **MAC Address:** Hardware Layer-2 physical identifier burned into NIC.
   - **IP Address:** Logical Layer-3 routable identifier.
3. **DNS:** Translates hostnames into IP addresses.

---

## 2. How does it work?
What happens when you open \`google.com\` (5-Line Summary):
1. **Resolution:** Browser checks cache and queries DNS server for Google's IP.
2. **Routing:** Client resolves gateway MAC address via ARP.
3. **Handshake:** TCP 3-way handshake (SYN, SYN-ACK, ACK) and TLS negotiation on port 443.
4. **Request:** Browser sends HTTP GET request over secure tunnel.
5. **Rendering:** Google server returns HTTP 200 response with DOM assets.

---

## 3. Why does a security professional need it?
- Reconnaissance & Subdomain Enumeration.
- MitM attacks (ARP spoofing, DNS poisoning).
- Command & Control (C2) beaconing over DNS/HTTPS.

---

## 4. What did I practise?
\`\`\`bash
ip addr show
dig google.com +noall +answer
\`\`\`

---

## 5. What did I learn from the exercise?
- IP gets a packet across the globe; MAC delivers it inside the physical segment.
`;

  renderMarkdown();
  updateEditorStats();
}

function loadLabReportTemplate() {
  dom.folderSelect.value = "06-red-team/lab-reports";
  dom.folderPrefixLabel.textContent = "06-red-team/lab-reports/";
  dom.filenameInput.value = "juice-shop-assessment.md";
  dom.titleInput.value = "OWASP Juice Shop Security Assessment Report";
  updateCommitMessageSuggestion();

  dom.markdownEditor.value = `# Security Assessment Lab Report: OWASP Juice Shop

- **Date:** ${new Date().toISOString().split('T')[0]}
- **Target:** OWASP Juice Shop
- **Tester:** [Your Name]
- **Status:** In Progress

---

## 1. Scope & Objective
Authorized security assessment of the target web application to identify vulnerabilities and document reproducible proofs-of-concept.

---

## 2. Methodology & Findings
- Tools: Burp Suite, Browser DevTools, Curl
- Vulnerability: SQL Injection / Broken Access Control
- PoC Steps:
  1. Intercept request in proxy.
  2. Test payload.

---

## 3. Remediation
- Use parameterized queries and robust access control enforcement.
`;

  renderMarkdown();
  updateEditorStats();
}

// ==========================================
// Local Vault & Drafts
// ==========================================
function loadStoredVault() {
  try {
    const raw = localStorage.getItem('redteam_community_vault');
    if (raw) state.vault = JSON.parse(raw);
    else state.vault = [];
  } catch (e) { state.vault = []; }
  if (dom.vaultCountBadge) dom.vaultCountBadge.textContent = `${state.vault.length} Notes`;
  if (dom.mobileVaultBadge) dom.mobileVaultBadge.textContent = `${state.vault.length}`;
}

function saveVaultToStorage() {
  localStorage.setItem('redteam_community_vault', JSON.stringify(state.vault));
  if (dom.vaultCountBadge) dom.vaultCountBadge.textContent = `${state.vault.length} Notes`;
  if (dom.mobileVaultBadge) dom.mobileVaultBadge.textContent = `${state.vault.length}`;
}

function saveCurrentNoteToVault() {
  const content = dom.markdownEditor.value.trim();
  if (!content) {
    showToast('Error', 'Note content is empty', 'error');
    return;
  }

  const day = parseInt(dom.daySelect.value, 10);
  const title = dom.titleInput.value.trim() || 'Untitled Note';
  const folder = dom.folderSelect.value;
  const filename = dom.filenameInput.value.trim();
  const relPath = `${folder}/${filename}`;

  const existingIdx = state.vault.findIndex(n => n.path === relPath);
  const noteObj = {
    id: `note_${Date.now()}`,
    day,
    title,
    folder,
    filename,
    path: relPath,
    content,
    updatedAt: new Date().toISOString(),
    githubSynced: false
  };

  if (existingIdx >= 0) {
    state.vault[existingIdx] = noteObj;
  } else {
    state.vault.unshift(noteObj);
  }

  saveVaultToStorage();
  markDayCompleted(day);
  showToast('Saved to Local Vault', `"${title}" stored in your browser`, 'success');
  soundFx.playBeep(650, 0.1);
}

function loadStoredProgress() {
  try {
    const raw = localStorage.getItem('redteam_community_progress');
    if (raw) state.progress = JSON.parse(raw);
  } catch (e) { console.warn(e); }
  updateProgressDisplays();
}

function saveProgressToStorage() {
  localStorage.setItem('redteam_community_progress', JSON.stringify(state.progress));
  updateProgressDisplays();
  renderVisualMatrix();
  renderRoadmapWeeks();
}

function markDayCompleted(dayNum) {
  if (!state.progress.completedDays.includes(dayNum)) {
    state.progress.completedDays.push(dayNum);
    state.progress.completedDays.sort((a, b) => a - b);
    state.progress.currentStreak = (state.progress.currentStreak || 0) + 1;
    state.progress.lastActivityDate = new Date().toISOString().split('T')[0];
    saveProgressToStorage();
  }
}

// Auto-save & Restore Drafts
function autoSaveLocalDraft() {
  const content = dom.markdownEditor.value;
  if (!content.trim()) return;

  const draftData = {
    day: dom.daySelect.value,
    folder: dom.folderSelect.value,
    filename: dom.filenameInput.value,
    title: dom.titleInput.value,
    content: content,
    updatedAt: new Date().toLocaleTimeString()
  };

  localStorage.setItem('redteam_community_current_draft', JSON.stringify(draftData));
  dom.draftStatusText.textContent = `Auto-saved at ${draftData.updatedAt}`;
}

function restoreLocalDraft() {
  try {
    const raw = localStorage.getItem('redteam_community_current_draft');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.content && !dom.markdownEditor.value) {
        dom.markdownEditor.value = data.content;
        if (data.day) dom.daySelect.value = data.day;
        if (data.folder) {
          dom.folderSelect.value = data.folder;
          dom.folderPrefixLabel.textContent = `${data.folder}/`;
        }
        if (data.filename) dom.filenameInput.value = data.filename;
        if (data.title) dom.titleInput.value = data.title;
        renderMarkdown();
        updateEditorStats();
        dom.draftStatusText.textContent = `Restored draft from ${data.updatedAt || 'cache'}`;
      }
    } else {
      loadDay1Kickoff();
    }
  } catch (e) { console.warn(e); }
}

function saveDraftManual() {
  const content = dom.markdownEditor.value.trim();
  if (!content) return;

  const draftItem = {
    id: `draft_${Date.now()}`,
    day: dom.daySelect.value,
    folder: dom.folderSelect.value,
    filename: dom.filenameInput.value,
    title: dom.titleInput.value || 'Untitled Draft',
    content: content,
    updatedAt: new Date().toISOString()
  };

  state.drafts.unshift(draftItem);
  localStorage.setItem('redteam_community_drafts', JSON.stringify(state.drafts));
  if (dom.draftCountBadge) dom.draftCountBadge.textContent = state.drafts.length;
  showToast('Draft Saved', `Draft "${draftItem.title}" saved`, 'success');
}

function loadStoredDrafts() {
  try {
    const raw = localStorage.getItem('redteam_community_drafts');
    if (raw) state.drafts = JSON.parse(raw);
    if (dom.draftCountBadge) dom.draftCountBadge.textContent = state.drafts.length;
  } catch (e) { state.drafts = []; }
}

function openDraftsModal() {
  if (state.drafts.length === 0) {
    dom.draftsListContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox" class="empty-icon"></i>
        <p>No saved drafts yet. Click "Save Draft" in Studio to store your work!</p>
      </div>`;
    lucide.createIcons();
  } else {
    dom.draftsListContainer.innerHTML = state.drafts.map(d => `
      <div class="draft-item-card">
        <div class="draft-item-info">
          <h4>${escapeHtml(d.title)}</h4>
          <p>${escapeHtml(d.folder)}/${escapeHtml(d.filename)} • ${new Date(d.updatedAt).toLocaleDateString()}</p>
        </div>
        <div class="draft-item-actions">
          <button class="btn btn-primary btn-xs" onclick="loadDraftItem('${d.id}')">Load</button>
          <button class="btn btn-secondary btn-xs" onclick="deleteDraftItem('${d.id}')">Delete</button>
        </div>
      </div>
    `).join('');
    lucide.createIcons();
  }
  dom.draftsModal.classList.add('open');
}

window.loadDraftItem = (id) => {
  const draft = state.drafts.find(d => d.id === id);
  if (!draft) return;
  dom.titleInput.value = draft.title;
  dom.folderSelect.value = draft.folder;
  dom.folderPrefixLabel.textContent = `${draft.folder}/`;
  dom.filenameInput.value = draft.filename;
  if (draft.day) dom.daySelect.value = draft.day;
  dom.markdownEditor.value = draft.content;
  renderMarkdown();
  updateEditorStats();
  dom.draftsModal.classList.remove('open');
  showToast('Draft Restored', draft.title, 'info');
};

window.deleteDraftItem = (id) => {
  state.drafts = state.drafts.filter(d => d.id !== id);
  localStorage.setItem('redteam_community_drafts', JSON.stringify(state.drafts));
  if (dom.draftCountBadge) dom.draftCountBadge.textContent = state.drafts.length;
  openDraftsModal();
};

// ==========================================
// Direct GitHub REST API & Post Engine
// ==========================================
async function handlePostOrCommit() {
  if (state.config.mode !== 'github' || !state.config.token || !state.config.repo) {
    // If GitHub is not configured, offer to save to vault or configure GitHub
    const wantConfig = confirm('You are currently using Local Vault mode. Would you like to connect your personal GitHub repository now? Click OK to configure GitHub, or Cancel to save to your Local Vault.');
    if (wantConfig) {
      switchTab('settings');
      return;
    } else {
      saveCurrentNoteToVault();
      return;
    }
  }

  // User has connected GitHub! Use GitHub REST API directly from browser
  const content = dom.markdownEditor.value.trim();
  if (!content) {
    showToast('Empty Note', 'Please write your learning notes before committing.', 'error');
    return;
  }

  const folder = dom.folderSelect.value;
  const filename = dom.filenameInput.value.trim();
  const filePath = `${folder}/${filename}`;
  const title = dom.titleInput.value.trim();
  const commitMessage = dom.commitMsgInput.value.trim() || `feat(notes): ${title}`;
  const day = parseInt(dom.daySelect.value, 10);

  dom.btnPostToGitHub.disabled = true;
  dom.btnPostToGitHub.innerHTML = `<i data-lucide="loader" class="spin"></i> <span>COMMITTING TO GITHUB...</span>`;
  lucide.createIcons();

  try {
    const owner = state.config.username;
    const repo = state.config.repo;
    const branch = state.config.branch || 'main';
    const token = state.config.token;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    // Step 1: Check if file already exists to get its SHA
    let existingSha = null;
    try {
      const checkRes = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (checkRes.ok) {
        const fileData = await checkRes.json();
        existingSha = fileData.sha;
      }
    } catch (e) { console.warn('File check:', e); }

    // Step 2: UTF-8 Base64 encode content
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    // Step 3: PUT request to GitHub
    const putPayload = {
      message: commitMessage,
      content: base64Content,
      branch: branch
    };
    if (existingSha) putPayload.sha = existingSha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putPayload)
    });

    const putResult = await putRes.json();

    if (!putRes.ok) {
      throw new Error(putResult.message || `GitHub API error (${putRes.status})`);
    }

    // Success!
    saveCurrentNoteToVault(); // Also save in local vault
    markDayCompleted(day);

    soundFx.playVictory();
    confetti({ particleCount: 140, spread: 90 });

    const githubFileUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`;
    dom.successTitle.textContent = "Committed to Your GitHub!";
    dom.successDesc.textContent = `Your note was successfully committed directly to your repository ${owner}/${repo} on branch ${branch}.`;
    dom.successFileLink.href = githubFileUrl;
    dom.successFileLink.textContent = `${owner}/${repo}/${filePath}`;
    dom.successModal.classList.add('open');

    showToast('Committed to GitHub!', `${filePath} successfully pushed`, 'success');

  } catch (err) {
    showToast('GitHub Commit Failed', err.message, 'error', 6000);
  } finally {
    dom.btnPostToGitHub.disabled = false;
    dom.btnPostToGitHub.innerHTML = `<i data-lucide="rocket"></i> <span>${state.config.mode === 'github' ? 'POST TO MY GITHUB' : 'SAVE TO VAULT'}</span>`;
    lucide.createIcons();
  }
}

// ==========================================
// Settings UI & GitHub Connection Test
// ==========================================
function setupSettingsUI() {
  if (dom.cfgUsername) dom.cfgUsername.value = state.config.username || '';
  if (dom.cfgRepo) dom.cfgRepo.value = state.config.repo || '';
  if (dom.cfgBranch) dom.cfgBranch.value = state.config.branch || 'main';
  if (dom.cfgToken) dom.cfgToken.value = state.config.token || '';

  updateSettingsCardStyles();

  if (dom.btnSaveGitHubConfig) {
    dom.btnSaveGitHubConfig.addEventListener('click', () => {
      state.config.username = dom.cfgUsername.value.trim();
      state.config.repo = dom.cfgRepo.value.trim();
      state.config.branch = dom.cfgBranch.value.trim() || 'main';
      state.config.token = dom.cfgToken.value.trim();
      state.config.mode = 'github';

      saveUserConfig();
      showToast('Settings Saved', 'GitHub repository configuration updated', 'success');
      updateSettingsCardStyles();
    });
  }

  if (dom.btnDisconnectGitHub) {
    dom.btnDisconnectGitHub.addEventListener('click', () => {
      state.config.token = '';
      state.config.mode = 'local';
      if (dom.cfgToken) dom.cfgToken.value = '';
      saveUserConfig();
      showToast('Disconnected', 'Switched back to Local Browser Vault mode', 'info');
      updateSettingsCardStyles();
    });
  }

  if (dom.btnTestGitHubConnection) {
    dom.btnTestGitHubConnection.addEventListener('click', async () => {
      const username = dom.cfgUsername.value.trim();
      const repo = dom.cfgRepo.value.trim();
      const token = dom.cfgToken.value.trim();

      if (!token) {
        showToast('Token Missing', 'Please enter your GitHub Personal Access Token', 'error');
        return;
      }

      dom.btnTestGitHubConnection.disabled = true;
      dom.btnTestGitHubConnection.innerHTML = `<i data-lucide="loader" class="spin"></i> Testing...`;
      lucide.createIcons();

      try {
        const userRes = await fetch('https://api.github.com/user', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!userRes.ok) throw new Error('Token is invalid or expired');
        const userData = await userRes.json();

        let repoMsg = '';
        if (username && repo) {
          const repoRes = await fetch(`https://api.github.com/repos/${username}/${repo}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (repoRes.ok) repoMsg = ` and repo "${username}/${repo}" verified!`;
          else repoMsg = ` but repository "${username}/${repo}" was not found (make sure it exists or is public/private with token access).`;
        }

        showToast('Connection Successful!', `Authenticated as @${userData.login}${repoMsg}`, 'success', 5000);
        soundFx.playBeep(650, 0.1);
      } catch (e) {
        showToast('Connection Failed', e.message, 'error', 5000);
      } finally {
        dom.btnTestGitHubConnection.disabled = false;
        dom.btnTestGitHubConnection.innerHTML = `<i data-lucide="plug"></i> Test Connection`;
        lucide.createIcons();
      }
    });
  }
}

// ==========================================
// 90-Day Roadmap, Matrix & Progress
// ==========================================
async function loadRoadmap() {
  if (typeof window !== 'undefined' && window.ROADMAP_DATA && !state.roadmap) {
    state.roadmap = window.ROADMAP_DATA;
    populateDaySelect();
    renderDaysSidebar();
    renderRoadmapWeeks();
    renderVisualMatrix();
  }
  try {
    const res = await fetch('/api/roadmap');
    if (res.ok) {
      const data = await res.json();
      if (data && data.days) {
        state.roadmap = data;
        populateDaySelect();
        renderDaysSidebar();
        renderRoadmapWeeks();
        renderVisualMatrix();
      }
    }
  } catch (err) {
    console.warn('Roadmap API fetch fallback to preloaded data:', err);
  }
}

function renderDaysSidebar(filterQuery = '') {
  if (!state.roadmap || !state.roadmap.days || !dom.daysSidebarList) return;
  const completed = (state.progress && state.progress.completedDays) || [];
  const currentSelectedDay = parseInt(dom.daySelect ? dom.daySelect.value : '1', 10) || 1;
  const q = (filterQuery || '').toLowerCase().trim();

  const filtered = state.roadmap.days.filter(d => {
    if (!q) return true;
    const dayStr = `day ${d.day}`;
    return d.title.toLowerCase().includes(q) || 
           dayStr.includes(q) || 
           String(d.day) === q ||
           (d.folder && d.folder.toLowerCase().includes(q));
  });

  if (dom.sidebarCountBadge) {
    dom.sidebarCountBadge.textContent = `${filtered.length} Days`;
  }

  if (filtered.length === 0) {
    dom.daysSidebarList.innerHTML = `
      <div style="padding: 18px 12px; text-align: center; color: var(--fg-muted); font-size: 12px;">
        No curriculum days matching "${escapeHtml(q)}"
      </div>
    `;
    return;
  }

  dom.daysSidebarList.innerHTML = filtered.map(d => {
    const isDone = completed.includes(d.day);
    const isActive = d.day === currentSelectedDay;
    return `
      <div class="days-sidebar-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}" 
           data-day="${d.day}"
           onclick="handleSidebarDayClick(${d.day})"
           title="Day ${d.day}: ${escapeHtml(d.title)}">
        <span class="day-chip-badge">D${String(d.day).padStart(2, '0')}</span>
        <span class="day-chip-title">${escapeHtml(d.title)}</span>
        ${isDone ? '<i data-lucide="check" class="day-chip-icon"></i>' : ''}
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.handleSidebarDayClick = (dayNum) => {
  selectDayAndLoadContent(dayNum);
};

function populateDaySelect() {
  if (!state.roadmap || !state.roadmap.days) return;
  dom.daySelect.innerHTML = state.roadmap.days.map(d => `
    <option value="${d.day}">Day ${String(d.day).padStart(2, '0')}: ${escapeHtml(d.title)} (Week ${d.week})</option>
  `).join('');
}

function renderVisualMatrix() {
  if (!state.roadmap || !Array.isArray(state.roadmap.days) || !dom.matrixGridContainer) return;
  const completed = (state.progress && state.progress.completedDays) || [];
  const currentActiveDay = completed.length > 0 ? Math.max(...completed) + 1 : 1;

  let html = '';
  for (let i = 1; i <= 90; i++) {
    const isDone = completed.includes(i);
    const isCurrent = i === currentActiveDay && !isDone;
    const dayData = state.roadmap.days.find(d => d.day === i);
    const title = dayData ? dayData.title : `Day ${i}`;

    let statusClass = 'pending';
    if (isDone) statusClass = 'done';
    else if (isCurrent) statusClass = 'current';

    html += `
      <div class="matrix-cell ${statusClass}" 
           onclick="startWritingForDay(${i})" 
           title="Day ${i}: ${escapeHtml(title)} [${statusClass.toUpperCase()}]">
        ${i}
      </div>
    `;
  }

  dom.matrixGridContainer.innerHTML = html;
}

function renderRoadmapWeeks() {
  if (!state.roadmap || !Array.isArray(state.roadmap.weeks) || !Array.isArray(state.roadmap.days) || !dom.weeksAccordionContainer) return;
  const { weeks, days } = state.roadmap;
  const completed = (state.progress && state.progress.completedDays) || [];

  const filteredWeeks = weeks.filter(w => {
    if (state.activePhaseFilter === 'all') return true;
    return w.phaseId === parseInt(state.activePhaseFilter, 10);
  });

  dom.weeksAccordionContainer.innerHTML = filteredWeeks.map((w, index) => {
    const weekDays = days.filter(d => d.week === w.week);
    const completedInWeek = weekDays.filter(d => completed.includes(d.day)).length;
    const isWeekComplete = completedInWeek === weekDays.length;

    return `
      <div class="week-card ${index === 0 ? 'open' : ''}" id="weekCard-${w.week}">
        <div class="week-card-header" onclick="toggleWeekCard('${w.week}')">
          <div class="week-card-title-group">
            <span class="week-number-pill">WEEK ${w.week}</span>
            <div>
              <h3>${escapeHtml(w.title)}</h3>
              <p>${escapeHtml(w.summary)}</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-family: var(--font-mono); font-size: 11px; color: ${isWeekComplete ? 'var(--accent-green)' : 'var(--text-sub)'}">
              ${completedInWeek}/${weekDays.length} Done
            </span>
            <i data-lucide="chevron-down" class="chevron"></i>
          </div>
        </div>

        <div class="week-card-body">
          <div class="week-meta-bar">
            <span><strong>Goal:</strong> ${escapeHtml(w.goal)}</span>
            <span><strong>Resource:</strong> <a href="${w.resourceUrl}" target="_blank" class="cyber-link">${escapeHtml(w.resource)}</a></span>
          </div>

          <div class="days-list">
            ${weekDays.map(d => {
              const isDone = completed.includes(d.day);
              return `
                <div class="day-item-row">
                  <div class="day-item-left">
                    <button class="day-check-btn ${isDone ? 'checked' : ''}" onclick="toggleDayProgress(${d.day})" title="Toggle Day Status">
                      <i data-lucide="check"></i>
                    </button>
                    <div>
                      <span class="day-badge">DAY ${String(d.day).padStart(2, '0')}</span>
                      <span class="day-title-text">${escapeHtml(d.title)}</span>
                    </div>
                  </div>
                  <div class="day-actions">
                    <span class="day-file-hint">${escapeHtml(d.folder)}/${escapeHtml(d.file || '')}</span>
                    <button class="btn btn-outline btn-xs" onclick="startWritingForDay(${d.day})">
                      <i data-lucide="edit-3"></i> Write Note
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

window.toggleWeekCard = (weekNum) => {
  const card = document.getElementById(`weekCard-${weekNum}`);
  if (card) card.classList.toggle('open');
};

window.toggleDayProgress = (dayNum) => {
  const idx = state.progress.completedDays.indexOf(dayNum);
  if (idx >= 0) {
    state.progress.completedDays.splice(idx, 1);
    showToast('Progress Updated', `Day ${dayNum} marked incomplete`, 'info');
  } else {
    state.progress.completedDays.push(dayNum);
    soundFx.playBeep(650, 0.1);
    showToast('Goal Accomplished!', `Day ${dayNum} marked completed`, 'success');
  }

  const isDoneNow = state.progress.completedDays.includes(dayNum);
  if (dom.btnToggleDayStatus && parseInt(dom.daySelect.value, 10) === dayNum) {
    dom.btnToggleDayStatus.classList.toggle('completed', isDoneNow);
    if (dom.dayStatusText) dom.dayStatusText.textContent = isDoneNow ? 'Completed ✓' : 'Mark Complete';
    if (dom.dayStatusIcon) {
      dom.dayStatusIcon.setAttribute('data-lucide', isDoneNow ? 'check-circle' : 'circle');
      if (window.lucide) lucide.createIcons();
    }
  }

  saveProgressToStorage();
};

window.startWritingForDay = (dayNum) => {
  selectDayAndLoadContent(dayNum);
  switchTab('studio');
};

dom.phaseBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    dom.phaseBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activePhaseFilter = btn.getAttribute('data-phase');
    renderRoadmapWeeks();
  });
});

function updateProgressDisplays() {
  const count = state.progress.completedDays ? state.progress.completedDays.length : 0;
  const percent = ((count / 90) * 100).toFixed(1);
  const remaining = 90 - count;

  dom.roadmapPercent.textContent = `${percent}%`;
  dom.roadmapProgressBar.style.width = `${Math.max(0, percent)}%`;
  dom.completedCountText.textContent = `${count} of 90 Days Completed`;
  dom.daysRemainingText.textContent = `${remaining} Days Remaining`;
  if (dom.roadmapProgressBadge) dom.roadmapProgressBadge.textContent = `Day ${count}/90`;
  if (dom.mobileRoadmapBadge) dom.mobileRoadmapBadge.textContent = `Day ${count}/90`;
}

// ==========================================
// My Notes Vault Viewer & Exporter
// ==========================================
function renderVaultTree() {
  if (state.vault.length === 0) {
    dom.vaultTreeContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="archive" class="empty-icon"></i>
        <p>Your local vault is currently empty. Write a daily note and click "Save to Vault"!</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  dom.vaultTreeContainer.innerHTML = state.vault.map(n => `
    <div class="note-tree-item" onclick="inspectVaultNote('${n.id}')">
      <span class="note-tree-title">${escapeHtml(n.title)}</span>
      <div class="note-tree-meta">
        <span class="note-tree-folder">${escapeHtml(n.folder)}</span>
        <span>•</span>
        <span>${new Date(n.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

window.inspectVaultNote = (noteId) => {
  const note = state.vault.find(n => n.id === noteId);
  if (!note) return;

  dom.viewerPath.textContent = note.path;
  dom.viewerContent.innerHTML = marked.parse(note.content);
  dom.viewerActions.style.display = 'flex';

  dom.btnEditInStudio.onclick = () => {
    dom.titleInput.value = note.title;
    dom.folderSelect.value = note.folder;
    dom.folderPrefixLabel.textContent = `${note.folder}/`;
    dom.filenameInput.value = note.filename;
    if (note.day) dom.daySelect.value = String(note.day);
    dom.markdownEditor.value = note.content;
    renderMarkdown();
    updateEditorStats();
    switchTab('studio');
    showToast('Loaded into Studio', note.title, 'info');
  };

  dom.btnDownloadSingleVaultNote.onclick = () => {
    const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = note.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  dom.btnDeleteVaultNote.onclick = () => {
    if (confirm(`Delete "${note.title}" from your vault?`)) {
      state.vault = state.vault.filter(n => n.id !== noteId);
      saveVaultToStorage();
      renderVaultTree();
      dom.viewerActions.style.display = 'none';
      dom.viewerContent.innerHTML = `<div class="empty-state"><p>Note deleted from vault.</p></div>`;
      showToast('Deleted', 'Note removed from local vault', 'info');
    }
  };
};

dom.btnExportAllNotes.addEventListener('click', () => {
  if (state.vault.length === 0) {
    showToast('Vault Empty', 'No notes to export', 'info');
    return;
  }
  const exportData = {
    exportDate: new Date().toISOString(),
    totalNotes: state.vault.length,
    notes: state.vault
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `red-team-notes-vault-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Export Complete', 'All notes downloaded as JSON backup', 'success');
});

dom.btnRefreshVault.addEventListener('click', () => {
  loadStoredVault();
  renderVaultTree();
  showToast('Vault Refreshed', `${state.vault.length} notes in vault`, 'info');
});

// ==========================================
// 30-Minute Protocol Timer & Ambient Sound
// ==========================================
function setupTimer() {
  dom.btnTimerToggle.addEventListener('click', toggleTimer);
  dom.btnTimerReset.addEventListener('click', resetTimer);
  dom.btnTimerSoundTest.addEventListener('click', () => {
    soundFx.playBeep(700, 0.2);
  });
}

function setupAmbientAudio() {
  if (!dom.btnToggleAmbient) return;
  dom.btnToggleAmbient.addEventListener('click', () => {
    const vol = (dom.ambientVolume && parseFloat(dom.ambientVolume.value)) || 0.25;
    const isPlaying = soundFx.toggleAmbient(vol);

    if (dom.ambientIcon) dom.ambientIcon.setAttribute('data-lucide', isPlaying ? 'volume-2' : 'volume-x');
    if (dom.ambientText) dom.ambientText.textContent = isPlaying ? 'Mute Focus Drone' : 'Turn On Ambient';
    dom.btnToggleAmbient.classList.toggle('active', isPlaying);
    if (window.lucide) lucide.createIcons();
    showToast('Focus Audio', isPlaying ? 'Synthesized ambient drone active' : 'Audio muted', 'info');
  });

  if (dom.ambientVolume) {
    dom.ambientVolume.addEventListener('input', (e) => {
      soundFx.setAmbientVolume(parseFloat(e.target.value));
    });
  }
}

function toggleTimer() {
  if (state.timer.isRunning) pauseTimer();
  else startTimer();
}

function startTimer() {
  state.timer.isRunning = true;
  dom.timerToggleText.textContent = "Pause Session";
  dom.timerToggleIcon.setAttribute('data-lucide', 'pause');
  lucide.createIcons();
  soundFx.playBeep(520, 0.12);

  state.timer.intervalId = setInterval(() => {
    if (state.timer.remainingSeconds > 0) {
      state.timer.remainingSeconds--;
      updateTimerUI();
    } else {
      pauseTimer();
      soundFx.playVictory();
      confetti({ particleCount: 100, spread: 70 });
      showToast('Session Complete!', '🎯 30-Minute Practice Protocol Completed!', 'success', 8000);
    }
  }, 1000);
}

function pauseTimer() {
  state.timer.isRunning = false;
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  dom.timerToggleText.textContent = "Resume Session";
  dom.timerToggleIcon.setAttribute('data-lucide', 'play');
  lucide.createIcons();
}

function resetTimer() {
  pauseTimer();
  state.timer.remainingSeconds = 30 * 60;
  dom.timerToggleText.textContent = "Start 30-Min Session";
  dom.timerToggleIcon.setAttribute('data-lucide', 'play');
  lucide.createIcons();
  updateTimerUI();
}

function updateTimerUI() {
  const mins = Math.floor(state.timer.remainingSeconds / 60);
  const secs = state.timer.remainingSeconds % 60;
  dom.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const rem = state.timer.remainingSeconds;
  let newPhase = 1;
  let phaseText = "Phase 1: Active Recall (5m)";

  if (rem > 1500) {
    newPhase = 1;
    phaseText = "Phase 1: Active Recall";
  } else if (rem > 600) {
    newPhase = 2;
    phaseText = "Phase 2: Deep Concept Study";
  } else {
    newPhase = 3;
    phaseText = "Phase 3: Hands-on Practice & Notes";
  }

  if (newPhase !== state.timer.currentPhase) {
    state.timer.currentPhase = newPhase;
    soundFx.playBeep(880, 0.25, 'triangle');
    showToast('Phase Transition', phaseText, 'info');
  }

  dom.timerCurrentPhaseName.textContent = phaseText;
  dom.phaseBox1.classList.toggle('active', newPhase === 1);
  dom.phaseBox2.classList.toggle('active', newPhase === 2);
  dom.phaseBox3.classList.toggle('active', newPhase === 3);

  const progressRatio = state.timer.remainingSeconds / state.timer.totalSeconds;
  const circumference = 2 * Math.PI * 45;
  dom.timerProgressCircle.style.strokeDashoffset = circumference * (1 - progressRatio);
}

// ==========================================
// Modals & Helpers
// ==========================================
function setupModals() {
  if (dom.btnCloseSetupModal) {
    dom.btnCloseSetupModal.addEventListener('click', () => dom.setupModal.classList.remove('open'));
  }
  if (dom.btnCloseDraftsModal) {
    dom.btnCloseDraftsModal.addEventListener('click', () => dom.draftsModal.classList.remove('open'));
  }
  if (dom.btnCloseSuccessModal) {
    dom.btnCloseSuccessModal.addEventListener('click', () => dom.successModal.classList.remove('open'));
  }
  if (dom.btnOpenCheatsheet && dom.cheatsheetModal) {
    dom.btnOpenCheatsheet.addEventListener('click', () => dom.cheatsheetModal.classList.add('open'));
  }
  if (dom.btnCloseCheatsheetModal && dom.cheatsheetModal) {
    dom.btnCloseCheatsheetModal.addEventListener('click', () => dom.cheatsheetModal.classList.remove('open'));
  }

  window.addEventListener('click', (e) => {
    if (e.target === dom.setupModal) dom.setupModal.classList.remove('open');
    if (e.target === dom.draftsModal) dom.draftsModal.classList.remove('open');
    if (e.target === dom.cheatsheetModal) dom.cheatsheetModal.classList.remove('open');
    if (e.target === dom.successModal) dom.successModal.classList.remove('open');
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
