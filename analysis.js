const findValue = (obj, keyword) => {
    if (!obj || typeof obj !== 'object') return '';
    const keys = Object.keys(obj);
    const exact = keys.find(k => k === keyword);
    if (exact) return obj[exact];
    const fallback = keys.find(k => k.toLowerCase().includes(keyword.toLowerCase()));
    return fallback ? obj[fallback] : '';
};

const CONFIG = {
    GEMINI_API_KEY: "AIzaSyA2pRpV1Ez4QkvWD3maW8wWvKV-kbwKj0M",
    MODEL: 'gemini-flash-latest',
    ADMIN_LOCK_ENABLED: true,
    PERSISTENCE_ENABLED: true,
    STORAGE_KEYS: {
        BARRIER_DATA: 'patent_barrier_data',
        TREND_DATA: 'patent_trend_data',
        LAST_UPDATED: 'patent_last_updated'
    },
    DATABASE: {
        BARRIER: `__BARRIER_DATA__`,
        TREND: `__TREND_DATA__`
    }
};

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// UI Logic Helpers
const debugBox = document.getElementById('debug-logs');
function logToUI(msg) {
    if (debugBox) {
        debugBox.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
        debugBox.scrollTop = debugBox.scrollHeight;
    }
    console.log(msg);
}
logToUI.firstRun = true;

function setLocalLoading(id, isLoading) {
    const el = document.getElementById(id);
    if (el) el.style.display = isLoading ? 'block' : 'none';
}

const fileInputCompetitor = document.getElementById('file-input-competitor');
const dropZoneCompetitor = document.getElementById('drop-zone-competitor');
const dropZoneOurs = document.getElementById('drop-zone-ours');
const fileInputOursFolder = document.getElementById('file-input-ours-folder');
const fileInputOursFiles = document.getElementById('file-input-ours-files');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsContainer = document.getElementById('results-container');
const ourFilesList = document.getElementById('our-files-list');

logToUI("System initialized. Waiting for files...");

// Admin State
let isAdmin = !CONFIG.ADMIN_LOCK_ENABLED;
let logoClickCount = 0;
let logoClickTimeout = null;

const systemLogo = document.getElementById('system-logo');
if (systemLogo) {
    systemLogo.addEventListener('click', () => {
        logoClickCount++;
        clearTimeout(logoClickTimeout);
        logoClickTimeout = setTimeout(() => { logoClickCount = 0; }, 2000);

        if (logoClickCount >= 5) {
            isAdmin = !isAdmin;
            logToUI(`Admin Mode: ${isAdmin ? 'ENABLED' : 'DISABLED'}`);
            updateAdminUI();
            logoClickCount = 0;
        }
    });
}

function updateAdminUI() {
    if (isAdmin) {
        document.body.classList.add('admin-mode');
        document.getElementById('admin-indicator').style.display = 'inline';
        logToUI("Admin privileges granted. Upload tools unlocked.");
    } else {
        document.body.classList.remove('admin-mode');
        document.getElementById('admin-indicator').style.display = 'none';
    }
}

let competitorFiles = [];
let ourPatentFiles = [];

// Competitor Listeners
if (fileInputCompetitor) {
    fileInputCompetitor.addEventListener('change', (e) => {
        logToUI("Competitor file input changed");
        handleCompetitorFiles(e.target.files);
    });
}
if (dropZoneCompetitor) {
    setupDragDrop(dropZoneCompetitor, (files) => {
        logToUI("Competitor file dropped");
        handleCompetitorFiles(files);
    }, true);
}

// Our Patents Listeners (Folder + Files)
if (fileInputOursFolder) {
    fileInputOursFolder.addEventListener('change', (e) => {
        logToUI(`Ours folder input changed: ${e.target.files.length} files`);
        handleOurFiles(e.target.files);
    });
}
if (fileInputOursFiles) {
    fileInputOursFiles.addEventListener('change', (e) => {
        logToUI(`Ours files input changed: ${e.target.files.length} files`);
        handleOurFiles(e.target.files);
    });
}
if (dropZoneOurs) {
    setupDragDrop(dropZoneOurs, (files) => {
        logToUI(`Ours files dropped: ${files.length} files`);
        handleOurFiles(files);
    }, true);
}

function setupDragDrop(zone, handler, isMultiple = false) {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
        zone.style.borderColor = 'var(--primary)';
        zone.style.background = 'rgba(99, 102, 241, 0.05)';
    });
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
        zone.style.borderColor = 'rgba(148, 163, 184, 0.2)';
        zone.style.background = 'transparent';
    });
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        zone.style.borderColor = 'rgba(148, 163, 184, 0.2)';
        zone.style.background = 'transparent';
        if (isMultiple) {
            handler(e.dataTransfer.files);
        } else {
            handler(e.dataTransfer.files[0]);
        }
    });
}

function handleCompetitorFiles(files) {
    const fileList = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (fileList.length > 0) {
        competitorFiles = fileList;
        logToUI(`Competitor files accepted: ${fileList.length} files`);
        dropZoneCompetitor.innerHTML = `
            <div class="file-item animate-fade-in" style="background: rgba(99, 102, 241, 0.1); border: 1px solid var(--primary);">
                📄 경쟁사 준비완료 (${fileList.length}건)
            </div>
        `;
    } else {
        alert('PDF 파일만 가능합니다.');
    }
}

function handleOurFiles(files) {
    setLocalLoading('loading-ours', true);
    setTimeout(() => {
        const fileList = Array.from(files);
        logToUI(`Processing ${fileList.length} files...`);

        ourPatentFiles = fileList.filter(f =>
            f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        );

        if (ourPatentFiles.length > 0) {
            logToUI(`Internal patents loaded: ${ourPatentFiles.length} files`);
            if (ourFilesList) {
                ourFilesList.innerHTML = `
                    <div class="file-item animate-fade-in" style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--accent); color: var(--accent); margin-top: 10px;">
                        📁 COWAY 특허 ${ourPatentFiles.length}건 로드 완료
                    </div>
                `;
            }
        } else {
            logToUI("No valid PDF files found in selection.");
            alert('선택한 항목 중에 인식 가능한 PDF 파일이 없습니다.');
        }
        setLocalLoading('loading-ours', false);
    }, 100);
}

analyzeBtn.addEventListener('click', async () => {
    logToUI("Analysis button clicked");
    if (competitorFiles.length === 0 || ourPatentFiles.length === 0) {
        logToUI("Missing files: competitor=" + competitorFiles.length + ", ours=" + ourPatentFiles.length);
        alert('경쟁사 특허와 비교할 우리 특허들을 모두 업로드해주세요.');
        return;
    }

    try {
        setLoadingState(true);

        // 1. Extract texts
        logToUI(`Extracting text from ${competitorFiles.length} competitor PDF(s)...`);
        let competitorText = "";
        for (const f of competitorFiles) {
            competitorText += await extractTextFromPDF(f) + "\n\n";
        }
        logToUI(`Competitor text length: ${competitorText.trim().length}`);

        logToUI("Extracting text from our patents...");
        const ourPatentsTexts = await Promise.all(ourPatentFiles.map(f => extractTextFromPDF(f)));
        const combinedOurText = ourPatentsTexts.join('\n---\n');
        logToUI(`Internal patents text length: ${combinedOurText.trim().length}`);

        if (competitorText.trim().length < 50 || combinedOurText.trim().length < 50) {
            throw new Error('PDF에서 충분한 텍스트를 추출하지 못했습니다. (스캔된 이미지 PDF일 수 있습니다)');
        }

        // 2. Gemini Analysis
        logToUI("Sending data to Gemini API...");
        const analysisResult = await runGeminiAnalysis(competitorText, combinedOurText);

        // 3. Render Results
        logToUI("Analysis completed successfully!");
        renderResults(analysisResult);

    } catch (error) {
        console.error('Analysis failed:', error);
        alert('분석 중 오류가 발생했습니다: ' + error.message);
    } finally {
        setLoadingState(false);
    }
});

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(' ') + '\n';
    }

    return fullText;
}

async function runGeminiAnalysis(competitorText, ourPatentsContext) {
    const prompt = `
        COWAY 연구소 소속 안티그래비티 전문가로서 다음 특허들을 정밀 비교 분석하라.
        
        [경쟁사 특허 내용 (분석 대상)]
        ${competitorText.substring(0, 5000)}
        
        [COWAY 핵심 기술 데이터 (비교 기준)]
        ${ourPatentsContext.substring(0, 8000)}
        
        [응답 지침 및 디자인 가이드라인]
        - **배경 절대 투명**: 어떠한 태그에도 불투명한 배경색(회색, 흰색 등)을 넣지 마라.
        - **최적의 대비**: 어두운 배경에서 가독성이 극대화되도록 텍스트 색상을 선택하라 (기본:#f1f5f9, 강조:#fbbf24, 제목:#818cf8).
        - **구조화**: div와 h3를 사용하여 섹션을 명확히 구분하되, 디자인은 절제되고 프리미엄하게 유지하라.
        - 본론(유사도 요약)부터 시작하라.
        
        [분석 형식]
        1. 📋 유사도 요약 (핵심 기술 메커니즘 일치 여부)
        2. 🔍 주요 매칭 포인트 (경쟁사가 우리 기술의 어느 부분을 참고했는지)
        3. 🛡️ COWAY 우위 사항 (기술적 차별성 및 특허적 보호 강점)
        4. ⚖️ 회피 설계 가능성 및 취약점 분석 (경쟁사의 현재 우회 경로)
        5. 💡 특허 대응/강화 전략 (향후 회피를 원천 차단하기 위한 청구항 강화 및 추가 출원 제언)
        
        각 섹션을 가독성 좋게 div와 h3로 구분하여 전문적으로 작성하라.
    `;

    // Diagnostic: List models if failure occurs or on init
    async function checkModels() {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${CONFIG.GEMINI_API_KEY}`);
            const data = await res.json();
            if (data.models) {
                const names = data.models.map(m => m.name.replace('models/', ''));
                logToUI("Available models: " + names.join(', '));
            }
        } catch (e) { logToUI("Model check failed: " + e.message); }
    }
    if (logToUI.firstRun) { checkModels(); logToUI.firstRun = false; }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();

    if (data.error) {
        logToUI("Gemini API Error: " + data.error.message);
        throw new Error(`Gemini API 오류: ${data.error.message}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
        logToUI("No candidates in response. Response data: " + JSON.stringify(data));
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            throw new Error(`보안 필터에 의해 차단되었습니다: ${data.promptFeedback.blockReason}`);
        }
        throw new Error('Gemini 응답을 받지 못했습니다. (서버 응답 없음)');
    }

    return data.candidates[0].content.parts[0].text;
}

// Tab Switching Logic
const tabBtns = document.querySelectorAll('.tab-btn');
const sidebar = document.querySelector('.sidebar');
const analysisTab = document.getElementById('analysis-tab');
const dashboardTab = document.getElementById('dashboard-tab');
const strategyTab = document.getElementById('strategy-tab');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        // Update active button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show/Hide sections
        if (target === 'analysis') {
            analysisTab.style.display = 'block';
            dashboardTab.style.display = 'none';
            strategyTab.style.display = 'none';
            sidebar.style.display = 'block';
            document.querySelector('.main-grid').style.gridTemplateColumns = '350px 1fr';
        } else if (target === 'dashboard') {
            analysisTab.style.display = 'none';
            dashboardTab.style.display = 'block';
            strategyTab.style.display = 'none';
            sidebar.style.display = 'none';
            document.querySelector('.main-grid').style.gridTemplateColumns = '1fr';
            initDashboard();
        } else if (target === 'strategy') {
            analysisTab.style.display = 'none';
            dashboardTab.style.display = 'none';
            strategyTab.style.display = 'block';
            sidebar.style.display = 'none';
            document.querySelector('.main-grid').style.gridTemplateColumns = '1fr';
            initStrategyTab();
        }
    });
});

// Dashboard Logic
let charts = {};
let currentBarrierData = [];
let currentTrendData = [];

// Color Palette for Products - Modern Pastel Theme
const productColors = {
    'Water': '#93C5FD', // Pastel Blue
    'Air': '#A7F3D0',   // Pastel Mint
    'Living': '#FDE68A', // Pastel Amber/Yellow
    'BEREX': '#DDD6FE',  // Pastel Purple
    'Other': '#E2E8F0'   // Soft Gray
};

const statusColors = {
    '출원': '#93C5FD', // Light Blue
    '진행중': '#CBD5E1', // Slate Soft
    '아이디어': '#F1F5F9' // Off White
};

// Center Text Plugin for Donut
const centerTextPlugin = {
    id: 'centerText',
    afterDraw: (chart) => {
        if (chart.config.type !== 'doughnut') return;
        const { ctx, chartArea: { top, bottom, left, right, width, height } } = chart;
        ctx.save();
        const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;

        // Dynamic sizing based on innerRadius
        const scaleFactor = chart.innerRadius / 100;

        ctx.fillStyle = '#94a3b8';
        ctx.font = `bold ${Math.round(14 * scaleFactor)}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('총 합계', centerX, centerY - (25 * scaleFactor));

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(40 * scaleFactor)}px Inter`;
        ctx.fillText(total, centerX, centerY + (15 * scaleFactor));
        ctx.restore();
    }
};
Chart.register(centerTextPlugin);

// Chart.js Global Defaults for Executive Readability
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
Chart.defaults.plugins.tooltip.titleFont = { size: 14, weight: 'bold' };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;


const strategyColors = {
    '적용': '#475569', // Slate
    '방어': '#94a3b8'  // Silver
};

// CSV Upload Listeners for Real Data
const uploadBarrier = document.getElementById('csv-upload-barrier');
const uploadTrend = document.getElementById('csv-upload-trend');

if (uploadBarrier) {
    uploadBarrier.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleRealCSV(file, 'barrier');
    });
}

if (uploadTrend) {
    uploadTrend.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleRealCSV(file, 'trend');
    });
}

function handleRealCSV(file, type) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        // Most Korean Excel exports are in euc-kr (ANSI)
        const decoder = new TextDecoder('euc-kr');
        const text = decoder.decode(arrayBuffer);
        processCSVContent(text, type);
    };
    reader.readAsArrayBuffer(file);
}

function processCSVContent(text, type) {
    // Clean up potential BOM or markers
    const cleanText = text.replace('__BARRIER_DATA__', '').replace('__TREND_DATA__', '').trim();
    if (!cleanText) return;

    const data = parseCSV(cleanText);
    if (data.length > 0) {
        logToUI(`Processed ${type}: ${data.length} rows.`);

        if (type === 'barrier') {
            currentBarrierData = data;
            if (CONFIG.PERSISTENCE_ENABLED) localStorage.setItem(CONFIG.STORAGE_KEYS.BARRIER_DATA, cleanText);
        } else {
            currentTrendData = data;
            if (CONFIG.PERSISTENCE_ENABLED) localStorage.setItem(CONFIG.STORAGE_KEYS.TREND_DATA, cleanText);
        }

        // Update Timestamp
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (CONFIG.PERSISTENCE_ENABLED) localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_UPDATED, timestamp);
        updateTimestampUI(timestamp);

        updateFullDashboard();
    } else {
        logToUI(`Warning: No valid data found in uploaded ${type} CSV.`);
    }
}

function updateTimestampUI(time) {
    const el = document.getElementById('last-updated-time');
    if (el) el.innerText = time;
}

function loadPersistedData() {
    if (!CONFIG.PERSISTENCE_ENABLED) return;

    logToUI("Checking for data sources...");
    const savedBarrier = localStorage.getItem(CONFIG.STORAGE_KEYS.BARRIER_DATA);
    const savedTrend = localStorage.getItem(CONFIG.STORAGE_KEYS.TREND_DATA);
    const lastTime = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_UPDATED);

    if (lastTime) updateTimestampUI(lastTime);

    // Barrier Data Priority: LocalStorage -> Embedded Database
    if (savedBarrier && savedBarrier.length > 10) {
        logToUI("Restoring Barrier data from local storage...");
        currentBarrierData = parseCSV(savedBarrier);
    } else if (CONFIG.DATABASE.BARRIER && !CONFIG.DATABASE.BARRIER.startsWith('__')) {
        logToUI("Loading embedded default Barrier data...");
        currentBarrierData = parseCSV(CONFIG.DATABASE.BARRIER);
        logToUI(`Embedded Barrier Data rows: ${currentBarrierData.length}`);
    }

    // Trend Data Priority: LocalStorage -> Embedded Database
    if (savedTrend && savedTrend.length > 10) {
        logToUI("Restoring Trend data from local storage...");
        currentTrendData = parseCSV(savedTrend);
    } else if (CONFIG.DATABASE.TREND && !CONFIG.DATABASE.TREND.startsWith('__')) {
        logToUI("Loading embedded default Trend data...");
        currentTrendData = parseCSV(CONFIG.DATABASE.TREND);
        logToUI(`Embedded Trend Data rows: ${currentTrendData.length}`);
    }

    if (currentBarrierData.length > 0 || currentTrendData.length > 0) {
        updateFullDashboard();
    }
}

// Initial Run
window.addEventListener('load', () => {
    updateAdminUI();
    loadPersistedData();
    initDashboard();
});

function parseCSV(text) {
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delim = semicolonCount > commaCount ? ';' : ',';

    const headers = lines[0].split(delim).map(h => h.trim().replace(/^"/, '').replace(/"$/, ''));

    return lines.slice(1).map(line => {
        const values = [];
        let cur = '', inQ = false;
        for (let c of line) {
            if (c === '"') inQ = !inQ;
            else if (c === delim && !inQ) { values.push(cur.trim()); cur = ''; }
            else cur += c;
        }
        values.push(cur.trim());
        const obj = {};
        headers.forEach((h, i) => {
            let val = values[i] || '';
            obj[h] = val.replace(/^"/, '').replace(/"$/, '').trim();
        });
        return obj;
    }).filter(row => {
        // Filter out rows where all values are empty or just whitespace
        return Object.values(row).some(val => val !== '');
    });
}

function updateFullDashboard() {
    if (currentBarrierData.length > 0) {
        updateCounterBoard(currentBarrierData);
        updateProductStatusChart(currentBarrierData);
        updateProgressDistributionChart(currentBarrierData);
        updatePurposeCharts(currentBarrierData);
        updateRow5Charts(currentBarrierData); // Consolidated Workload, Collab, Density
        updateCategoricalRadars(currentBarrierData); // 4-Radar Row 6
        updateExecutiveCharts(currentBarrierData); // Row 7 Strategic Analysis
        resetDetailTable();
    }
    if (currentTrendData.length > 0) {
        updateTrendChart(currentTrendData);
        updateAIInsights(currentBarrierData); // Add AI Insight
    }
}

// 0. AI Insight Engine
function updateAIInsights(data) {
    const insightSection = document.getElementById('ai-insight-section');
    const insightContent = document.getElementById('ai-insight-content');
    if (!data || data.length === 0) return;

    insightSection.style.display = 'block';

    const products = [...new Set(data.map(d => findValue(d, '구분')))].filter(Boolean);
    const progressAvg = data.reduce((acc, d) => acc + (parseInt(findValue(d, '진행률')) || 0), 0) / data.length;

    // Simple analysis logic to simulate AI insights
    let summary = `<ul style="padding-left: 1.2rem; margin: 0;">`;

    // Progress Insight
    summary += `<li><b>전체 진행 현황:</b> 평균 진행률은 <b>${progressAvg.toFixed(1)}%</b>이며, `;
    const filedCount = data.filter(d => parseInt(findValue(d, '진행률')) === 100).length;
    summary += `총 ${data.length}건 중 ${filedCount}건(${((filedCount / data.length) * 100).toFixed(0)}%)이 출원 완료되었습니다.</li>`;

    // Project Concentration Insight
    const pjtCounts = {};
    data.forEach(d => {
        const p = findValue(d, 'PJT');
        if (p) pjtCounts[p] = (pjtCounts[p] || 0) + 1;
    });
    const sortedPjts = Object.entries(pjtCounts).sort((a,b) => b[1] - a[1]);
    if (sortedPjts.length > 0) {
        const topPjt = sortedPjts[0];
        const bottomPjt = sortedPjts[sortedPjts.length - 1];
        summary += `<li><b>프로젝트 집중도 분석:</b> 현재 <b>${topPjt[0]}</b> 프로젝트에 가장 많은 특허(${topPjt[1]}건)가 집중되어 있으며, 상대적으로 <b>${bottomPjt[0]}</b> 및 신규 프로젝트의 특허 보호망 보완이 필요해 보입니다.</li>`;
    }

    // Strategic Insight
    const purposeCounts = { '적용': data.filter(d => (findValue(d, '목적') || '').includes('적용')).length, '방어': data.filter(d => (findValue(d, '목적') || '').includes('방어')).length };
    if (purposeCounts['방어'] > purposeCounts['적용']) {
        summary += `<li><b>특허 전략 의견:</b> 현재 '방어형' 특허 비중이 높습니다. 핵심 기술의 시장 지배력을 강화하기 위해 '적용형(공격형)' 특허 확보에 더 집중할 것을 권고합니다.</li>`;
    }

    // Trend Insight
    const ideaCount = data.filter(d => parseInt(findValue(d, '진행률')) < 50).length;
    if (ideaCount > data.length * 0.4) {
        summary += `<li><b>미래 확보 역량:</b> 초기 아이디어 단계의 특허가 40% 이상으로 매우 풍부합니다. 이들이 적기에 출원(100%)으로 이어지도록 마일스톤 관리가 중요합니다.</li>`;
    }

    insightContent.innerHTML = summary;

    // Categorical Insights
    let categoricalSummary = `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">`;

    products.forEach(p => {
        const prodData = data.filter(d => findValue(d, '구분') === p);
        if (prodData.length === 0) return;

        const avg = prodData.reduce((acc, d) => acc + (parseInt(findValue(d, '진행률')) || 0), 0) / prodData.length;

        // Fix Strategy Counting Logic
        const stratCounts = { app: 0, def: 0 };
        prodData.forEach(d => {
            const val = (findValue(d, '목적') || findValue(d, '전략') || '').toLowerCase();
            if (val.includes('적용')) stratCounts.app++;
            else if (val.includes('방어')) stratCounts.def++;
        });

        const prodPjtCounts = {};
        prodData.forEach(d => {
            const p = findValue(d, 'PJT');
            if (p) prodPjtCounts[p] = (prodPjtCounts[p] || 0) + 1;
        });
        const sortedProdPjts = Object.entries(prodPjtCounts).sort((a,b) => b[1] - a[1]);
        const topProdPjt = sortedProdPjts[0] ? sortedProdPjts[0][0] : "N/A";

        let advice = "";
        let techTrend = "";
        let proposedChart = "";
        if (p === 'Water') {
            advice = `현재 <b>${topProdPjt}</b> 관련 기술 선점도는 높으나, 신규 필터링 소재 중심의 적용형 특허 확보가 시급합니다.`;
            techTrend = `정수/온수 프로젝트의 역량은 상위권이나, 환경 가전 및 미세 미네랄 제어 프로젝트의 특허 밀도가 낮아 보강이 필요함.`;
            proposedChart = "💡 제언: '환경 가전용 친환경 소재 기술 트리' 시각화 시 경쟁사 대비 우위 강조 가능";
        } else if (p === 'Air') {
            advice = `<b>${topProdPjt}</b> 기반 살균 성능은 고도화되었으나, 저소음 제어 및 에너지 효율 관련 신규 프로젝트의 방어막 강화가 필요합니다.`;
            techTrend = "가장 높은 집중도를 보이는 '공기질/청정' 대비 차세대 스마트 풍량 제어 프로젝트의 특허 확보가 기술적 병목 해결의 열쇠임.";
            proposedChart = "💡 제언: '제품 소음 대비 살균 효율 상관관계 분석 차트' 가독성 차별화 가능";
        } else if (p === 'Living') {
            advice = `매트리스 케어 솔루션의 서비스 특허 범위를 <b>${topProdPjt}</b> 외 영역으로 확장하여 시장 진입 장벽을 높여야 합니다.`;
            techTrend = "'스마트홈/케어' 인프라는 탄탄하나, 슬립테크 고도화 및 수면 진단 알고리즘 프로젝트의 특허 면적이 좁아 집중 투자가 권고됨.";
            proposedChart = "💡 제언: '맞춤형 숙면 유도 센싱 알고리즘 특허 가치 평가'를 통한 IP 장벽 구축";
        } else if (p === 'BEREX') {
            advice = `<b>${topProdPjt}</b> 브랜드 인지도에 맞는 프리미엄 디자인 및 외장재 특허 보호가 강화되어야 합니다.`;
            techTrend = "'디자인/소재' 기반의 강점이 뚜렷하지만, 인체공학적 마사지 로직 및 사용자 인식 기술 프로젝트의 특허 포트폴리오는 상대적으로 부족함.";
            proposedChart = "💡 제언: '마사지 부위별 사용자 만족도 연동 특허 맵'으로 시장 리더십 공고화";
        }

        categoricalSummary += `
            <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 8px; border-top: 2px solid var(--accent);">
                <h4 style="margin: 0 0 0.4rem 0; color: var(--accent); font-size: 0.85rem;">${p} Intelligence</h4>
                <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted); opacity: 0.9; line-height: 1.4;">
                    <b>전략:</b> 적용 ${stratCounts.app}건 / 방어 ${stratCounts.def}건<br>
                    <b>의견:</b> ${advice}<br>
                    <b>트렌드:</b> ${techTrend}<br>
                    <b style="color: #fbbf24;">${proposedChart}</b>
                </p>
            </div>`;
    });

    categoricalSummary += `</div>`;
    insightContent.innerHTML += categoricalSummary;
}

// 1. Counter Board
function updateCounterBoard(data) {

    document.querySelector('#count-total .counter-value').innerText = data.length;
    document.querySelector('#count-filed .counter-value').innerText = data.filter(d => parseInt(findValue(d, '진행률')) === 100).length;
    document.querySelector('#count-progress .counter-value').innerText = data.filter(d => {
        const p = parseInt(findValue(d, '진행률'));
        return p >= 50 && p < 100;
    }).length;
    document.querySelector('#count-idea .counter-value').innerText = data.filter(d => {
        const p = parseInt(findValue(d, '진행률'));
        return !isNaN(p) && p < 50;
    }).length;
}

// Interactivity & Tables
function resetDetailTable() {
    if (currentBarrierData.length === 0) return;
    document.getElementById('detail-table-title').innerText = `📂 전체 특허 리스트 (${currentBarrierData.length}건)`;
    renderTableRows(currentBarrierData);
}

// 6. Categorical Radar Charts (Row 6)
function updateCategoricalRadars(data) {
    const products = ['Water', 'Air', 'Living', 'BEREX'];
    const radars = ['waterRadar', 'airRadar', 'livingRadar', 'berexRadar'];

    products.forEach((prod, i) => {
        const prodData = data.filter(d => findValue(d, '구분') === prod);
        const techs = [...new Set(prodData.map(d => findValue(d, '기술')).filter(Boolean))];
        const techCounts = techs.map(t => prodData.filter(d => findValue(d, '기술') === t).length);

        const ctx = document.getElementById(radars[i]).getContext('2d');
        if (charts[radars[i]]) charts[radars[i]].destroy();

        charts[radars[i]] = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: techs,
                datasets: [{
                    label: prod,
                    data: techCounts,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: '#3b82f6',
                    pointBackgroundColor: '#3b82f6'
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255,255,255,0.1)' },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        pointLabels: { color: '#fff', font: { size: 10 } },
                        ticks: { display: false }
                    }
                }
            }
        });
    });
}

function renderTableRows(data) {

    const tbody = document.getElementById('detail-table-body');
    tbody.innerHTML = '';
    data.forEach((d, index) => {
        const row = document.createElement('tr');
        const pStr = findValue(d, '진행률');
        const p = parseInt(pStr);
        row.innerHTML = `
            <td>${index + 1}</td>
            <td style="color:${getProductColor(findValue(d, '구분'))}; font-weight:600;">${findValue(d, '구분') || '-'}</td>
            <td>${findValue(d, 'PJT') || '-'}</td>
            <td>${findValue(d, '기술') || '-'}</td>
            <td>${findValue(d, '목적') || findValue(d, '전략') || findValue(d, '방어') || '-'}</td>
            <td>${findValue(d, '부서') || '-'}</td>
            <td>${findValue(d, '담당자') || '-'}</td>
            <td>${findValue(d, '출원일') || '-'}</td>
            <td><strong style="color:${p == 100 ? 'var(--accent)' : 'inherit'}">${pStr || '0'}%</strong></td>
        `;
        tbody.appendChild(row);
    });
}

function getProductColor(p) { return productColors[p] || productColors['Other']; }

// 2. Product Status Chart (Row 1-1)
function updateProductStatusChart(data) {
    const products = [...new Set(data.map(d => findValue(d, '구분')))].filter(Boolean);
    const statuses = ['출원', '진행중', '아이디어'];

    const datasets = statuses.map(status => ({
        label: status,
        data: products.map(p => data.filter(d => findValue(d, '구분') === p && getStatusLabel(findValue(d, '진행률')) === status).length),
        backgroundColor: statusColors[status]
    }));

    const ctx = document.getElementById('productStatusChart').getContext('2d');
    if (charts.pStatus) charts.pStatus.destroy();
    charts.pStatus = new Chart(ctx, {
        type: 'bar',
        data: { labels: products, datasets },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#fff', font: { size: 11 }, boxWidth: 10 } }
            },
            onClick: (e, items) => {
                if (items.length > 0) {
                    const { index, datasetIndex } = items[0];
                    const p = products[index];
                    const s = statuses[datasetIndex];
                    const filtered = currentBarrierData.filter(d => findValue(d, '구분') === p && getStatusLabel(findValue(d, '진행률')) === s);
                    document.getElementById('detail-table-title').innerText = `📂 ${p} - ${s} 상세 리스트 (${filtered.length}건)`;
                    renderTableRows(filtered);
                }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#fff', font: { size: 11 } } },
                y: { stacked: true, ticks: { color: '#fff', font: { size: 11 } } }
            }
        }
    });
}

function getStatusLabel(pStr) {
    const p = parseInt(pStr);
    if (p === 100) return '출원';
    if (p >= 50) return '진행중';
    return '아이디어';
}

// 3. Monthly Trends (Row 1-2)
function updateTrendChart(data) {
    const dKey = Object.keys(data[0]).find(k => k.includes('날짜') || k.includes('월'));
    const pKey = Object.keys(data[0]).find(k => k.includes('제품군') || k.includes('구분'));
    const vKey = Object.keys(data[0]).find(k => k.includes('건 수') || k.includes('수량'));

    const dates = [...new Set(data.map(d => d[dKey]))].sort();
    const products = [...new Set(data.map(d => d[pKey]))];

    const datasets = products.map(p => ({
        label: p,
        data: dates.map(date => {
            const row = data.find(d => d[dKey] === date && d[pKey] === p);
            return row ? parseInt(row[vKey]) || 0 : 0;
        }),
        backgroundColor: getProductColor(p)
    }));

    const ctx = document.getElementById('monthlyFilingChart').getContext('2d');
    if (charts.trend) charts.trend.destroy();
    charts.trend = new Chart(ctx, {
        type: 'bar',
        data: { labels: dates.map(d => d.includes('-') ? d.split('-')[1] + '월' : d), datasets },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#fff', font: { size: 11 }, boxWidth: 10, padding: 10 }
                }
            },
            onClick: (e, items) => {
                if (items.length > 0) {
                    const { index, datasetIndex } = items[0];
                    const m = dates[index]; // e.g., "2024-03"
                    const p = products[datasetIndex];
                    const filtered = currentBarrierData.filter(d => {
                        const dVal = (findValue(d, '날짜') || findValue(d, '월') || '').toString();
                        return dVal.includes(m) && findValue(d, '구분') === p;
                    });
                    document.getElementById('detail-table-title').innerText = `📂 ${m} - ${p} 상세 리스트 (${filtered.length}건)`;
                    renderTableRows(filtered);
                }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#fff', font: { size: 11 } } },
                y: { stacked: true, ticks: { color: '#fff', font: { size: 11 } } }
            }
        }
    });
}

// 4. Progress Distribution (Row 1-3)
function updateProgressDistributionChart(data) {
    const bins = ['0%', '25%', '50%', '75%', '100%'];
    const products = [...new Set(data.map(d => findValue(d, '구분')))].filter(Boolean);

    const datasets = products.map(p => ({
        label: p,
        data: bins.map(bin => {
            const targetP = parseInt(bin);
            return data.filter(d => findValue(d, '구분') === p && parseInt(findValue(d, '진행률')) === targetP).length;
        }),
        backgroundColor: getProductColor(p)
    }));

    const ctx = document.getElementById('progressDistributionChart').getContext('2d');
    if (charts.dist) charts.dist.destroy();
    charts.dist = new Chart(ctx, {
        type: 'bar',
        data: { labels: bins, datasets },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#fff', font: { size: 11 }, boxWidth: 10 } }
            },
            onClick: (e, items) => {
                if (items.length > 0) {
                    const { index, datasetIndex } = items[0];
                    const b = bins[index];
                    const p = products[datasetIndex];
                    const filtered = currentBarrierData.filter(d => parseInt(findValue(d, '진행률')) === parseInt(b) && findValue(d, '구분') === p);
                    document.getElementById('detail-table-title').innerText = `📂 진행률 ${b} - ${p} 상세 리스트 (${filtered.length}건)`;
                    renderTableRows(filtered);
                }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#fff', font: { size: 11 } } },
                y: { stacked: true, ticks: { color: '#fff', font: { size: 11 } } }
            }
        }
    });
}

// 5. Purpose Analysis (Restored & Optimized for Low-spec PC)
function updatePurposeCharts(data) {
    if (!data || data.length === 0) return;

    // 변경사항 1: 100ms 의도적 휴식 타임 (레이더/트렌드 차트 생성 후 부하 분산)
    setTimeout(async () => {
        const canvas = document.getElementById('purposeDonutChart');
        if (!canvas) return;

        // 변경사항 2: 부모 요소(donut-wrapper) 크기를 강제로 캔버스에 주입
        const parent = canvas.parentNode;
        
        // [추가] 탭이 숨겨진 상태(offsetWidth=0)에서도 초기 크기를 가질 수 있도록 Fallback 로직 적용
        let w = parent.offsetWidth;
        let h = parent.offsetHeight;
        if (w === 0 || h === 0) {
            const style = window.getComputedStyle(parent);
            w = parseInt(style.width) || 300;
            h = parseInt(style.height) || 300;
        }

        canvas.style.width = '100%';
        canvas.style.height = `${h}px`; // 명시적 높이 유지
        canvas.width = w;
        canvas.height = h;

        const checkPurpose = (d) => {
            const rawVal = (findValue(d, '목적') || findValue(d, '전략') || findValue(d, '방어') || findValue(d, '적용') || '').toString().toLowerCase().trim();
            if (rawVal.includes('적용') || rawVal.includes('app') || rawVal.includes('target')) return '적용';
            if (rawVal.includes('방어') || rawVal.includes('def') || rawVal.includes('guard')) return '방어';
            return '';
        };

        const counts = { '적용': 0, '방어': 0 };

        // 변경사항 3: 데이터 연산 부하 분산 (50건마다 브라우저에게 제어권 양보)
        for (let i = 0; i < data.length; i++) {
            const p = checkPurpose(data[i]);
            if (p) counts[p]++;
            if (i > 0 && i % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        logToUI(`Purpose Stats (Restored): 적용=${counts['적용']}, 방어=${counts['방어']}`);

        // 도넛 차트 생성
        const ctxD = canvas.getContext('2d');
        if (charts.purpD) charts.purpD.destroy();

        charts.purpD = new Chart(ctxD, {
            type: 'doughnut',
            data: {
                labels: ['적용', '방어'],
                datasets: [{
                    data: [counts['적용'], counts['방어']],
                    backgroundColor: [strategyColors['적용'], strategyColors['방어']],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { size: 11 }, padding: 15 }
                    },
                    centerText: true
                },
                onClick: (e, items) => {
                    if (items.length > 0) {
                        const { index } = items[0];
                        const p = ['적용', '방어'][index];
                        const filtered = data.filter(d => checkPurpose(d) === p);
                        document.getElementById('detail-table-title').innerText = `📂 전략: ${p} 상세 리스트 (${filtered.length}건)`;
                        renderTableRows(filtered);
                    }
                }
            }
        });

        // PJT별 비율 차트 (기존 로직 유지하되 안정성 강화)
        const pjts = [...new Set(data.map(d => findValue(d, 'PJT')))].filter(Boolean);
        const scrollArea = document.getElementById('pjtRatioScrollArea');
        if (scrollArea) scrollArea.style.height = `${pjts.length * 35}px`;

        const datasets = ['적용', '방어'].map((m, i) => ({
            label: m,
            data: pjts.map(p => {
                const rows = data.filter(d => findValue(d, 'PJT') === p);
                if (rows.length === 0) return 0;
                return (rows.filter(d => checkPurpose(d) === m).length / rows.length) * 100;
            }),
            backgroundColor: i === 0 ? strategyColors['적용'] : strategyColors['방어'],
            barThickness: 20
        }));

        const canvasR = document.getElementById('pjtPurposeRatioChart');
        if (!canvasR) return;
        const ctxR = canvasR.getContext('2d');
        if (charts.purpR) charts.purpR.destroy();
        charts.purpR = new Chart(ctxR, {
            type: 'bar',
            data: { labels: pjts, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: '#fff', font: { size: 11 }, boxWidth: 10 } }
                },
                scales: {
                    x: { stacked: true, max: 100, ticks: { color: '#94a3b8' } },
                    y: { stacked: true, ticks: { color: '#fff', autoSkip: false } }
                },
                onClick: (e, items) => {
                    if (items.length > 0) {
                        const { index, datasetIndex } = items[0];
                        const pjt = pjts[index];
                        const strategy = ['적용', '방어'][datasetIndex];
                        const filtered = currentBarrierData.filter(d => 
                            (findValue(d, 'PJT') || '').toString().includes(pjt) && 
                            checkPurpose(d) === strategy
                        );
                        document.getElementById('detail-table-title').innerText = `📂 ${pjt} - ${strategy} 상세 리스트 (${filtered.length}건)`;
                        renderTableRows(filtered);
                    }
                }
            }
        });
    }, 100); 
}

// 5. Row 5 Consolidated Charts (Workload, Collab, Density)
function updateRow5Charts(data) {
    updateWorkloadChart(data);
    updateIPCollabChart(data);
    updatePjtDensityChart(data);
}

function updateWorkloadChart(data) {
    const workloads = {};
    data.forEach(d => { const p = findValue(d, '담당자'); if (p) workloads[p] = (workloads[p] || 0) + 1; });
    const sorted = Object.entries(workloads).sort((a, b) => b[1] - a[1]).slice(0, 15);

    const ctx = document.getElementById('workloadChart').getContext('2d');
    if (charts.work) charts.work.destroy();
    charts.work = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(x => x[0]),
            datasets: [{ label: '보유 건수', data: sorted.map(x => x[1]), backgroundColor: '#334155' }]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            interaction: {
                mode: 'index',
                intersect: false,
                axis: 'y'
            },
            onClick: (e, items) => {
                if (items.length > 0) {
                    const p = sorted[items[0].index][0];
                    const filtered = currentBarrierData.filter(d => findValue(d, '담당자') === p);
                    document.getElementById('detail-table-title').innerText = `📂 담당자: ${p} 상세 리스트 (${filtered.length}건)`;
                    renderTableRows(filtered);
                }
            },
            scales: {
                x: { ticks: { color: '#fff', font: { size: 11 } } },
                y: { ticks: { color: '#fff', font: { size: 11 } } }
            }
        }
    });
}

function updateIPCollabChart(data) {
    const ips = [...new Set(data.map(d => findValue(d, 'IP담당자')))].filter(Boolean);
    const ctxC = document.getElementById('ipCollabChart').getContext('2d');
    if (charts.collab) charts.collab.destroy();
    charts.collab = new Chart(ctxC, {
        type: 'bar',
        data: {
            labels: ips,
            datasets: [{ label: '협업 건수', data: ips.map(ip => data.filter(d => findValue(d, 'IP담당자') === ip).length), backgroundColor: '#475569' }]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            interaction: {
                mode: 'index',
                intersect: false,
                axis: 'y'
            },
            onClick: (e, items) => {
                if (items.length > 0) {
                    const p = ips[items[0].index];
                    const filtered = currentBarrierData.filter(d => findValue(d, 'IP담당자') === p);
                    document.getElementById('detail-table-title').innerText = `📂 IP담당자: ${p} 상세 리스트 (${filtered.length}건)`;
                    renderTableRows(filtered);
                }
            },
            scales: {
                x: { ticks: { color: '#fff', font: { size: 11 } } },
                y: { ticks: { color: '#fff', font: { size: 11 } } }
            }
        }
    });
}

function updatePjtDensityChart(data) {
    const pjtCounts = {};
    data.forEach(d => { const p = findValue(d, 'PJT'); if (p) pjtCounts[p] = (pjtCounts[p] || 0) + 1; });
    const topPjts = Object.entries(pjtCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const ctxDen = document.getElementById('pjtDensityChart').getContext('2d');
    if (charts.dens) charts.dens.destroy();
    charts.dens = new Chart(ctxDen, {
        type: 'bar',
        data: { labels: topPjts.map(x => x[0]), datasets: [{ label: '특허 밀도', data: topPjts.map(x => x[1]), backgroundColor: '#64748b' }] },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            interaction: {
                mode: 'index',
                intersect: false,
                axis: 'y'
            },
            onClick: (e, items) => {
                if (items.length > 0) {
                    const p = topPjts[items[0].index][0];
                    const filtered = currentBarrierData.filter(d => findValue(d, 'PJT') === p);
                    document.getElementById('detail-table-title').innerText = `📂 프로젝트: ${p} 상세 리스트 (${filtered.length}건)`;
                    renderTableRows(filtered);
                }
            },
            scales: {
                x: { ticks: { color: '#fff', font: { size: 11 } } },
                y: { ticks: { color: '#fff', font: { size: 11 } } }
            }
        }
    });
}

// 6. Categorical Radar Charts (Row 6) - Optimized Tech Keywords
function updateCategoricalRadars(data) {
    const products = ['Water', 'Air', 'Living', 'BEREX'];
    const radarIds = ['waterRadar', 'airRadar', 'livingRadar', 'berexRadar'];

    const categoryKeywords = {
        'Water': ['정수', '필터', '미네랄', '자가관리', '살균', '직수', '환경', '온수'],
        'Air': ['공기질', '청정', '살균', '저소음', '에너지', '센싱', '미세먼지', '풍량'],
        'Living': ['매트리스', '슬립테크', '탑퍼', '케어', '위생', '스마트홈', '수면', '숙면'],
        'BEREX': ['안마', '안마의자', '리클라이너', '마사지', '디자인', '소재', '폼팩터', '인체공학']
    };

    products.forEach((prod, i) => {
        const prodData = data.filter(d => findValue(d, '구분') === prod);
        const labels = categoryKeywords[prod];
        const techCounts = labels.map(keyword =>
            prodData.filter(d => (findValue(d, '기술') || '').includes(keyword)).length
        );

        const canvas = document.getElementById(radarIds[i]);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (charts[radarIds[i]]) charts[radarIds[i]].destroy();

        charts[radarIds[i]] = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: prod,
                    data: techCounts,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: '#2563eb',
                    pointBackgroundColor: '#2563eb'
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255,255,255,0.1)' },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        pointLabels: { color: '#fff', font: { size: 11, weight: '500' } },
                        ticks: { display: false },
                        suggestedMax: 5
                    }
                },
                onClick: (e, items) => {
                    if (items.length > 0) {
                        const prod = products[i];
                        const keyword = categoryKeywords[prod][items[0].index];
                        const filtered = currentBarrierData.filter(d => 
                            findValue(d, '구분') === prod && 
                            (findValue(d, '기술') || '').toString().includes(keyword)
                        );
                        document.getElementById('detail-table-title').innerText = `📂 ${prod} - ${keyword} 관련 상세 리스트 (${filtered.length}건)`;
                        renderTableRows(filtered);
                    }
                }
            }
        });
    });
}

function initDashboard() {
    logToUI("Refined Dashboard Ready with 4-Categorical Radars.");
    // 탭 전환 시 차트가 올바른 크기로 렌더링되도록 업데이트 트리거
    if (typeof currentBarrierData !== 'undefined' && currentBarrierData.length > 0) {
        updateFullDashboard(); 
    }
}

function renderResults(htmlContent) {
    const cleanHTML = htmlContent.replace(/```html|```/g, '');
    resultsContainer.innerHTML = `
        <div class="analysis-report animate-fade-in" style="text-align: left; width: 100%;">
            ${cleanHTML}
        </div>
    `;
    resultsContainer.classList.remove('analysis-placeholder');
}

function setLoadingState(isLoading) {
    if (isLoading) {
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span>⏳</span> 분석 중...';
        resultsContainer.innerHTML = `
            <div class="spinner"></div>
            <p>Gemini가 특허를 정밀 분석하고 있습니다...</p>
        `;
    } else {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span>✨</span> 분석 시작하기';
    }
}

// --- Strategy Tab Logic ---
let strategyFiles = [];

function initStrategyTab() {
    logToUI("Strategy Tab Initialized.");
    const dropZone = document.getElementById('drop-zone-strategy');
    const folderInput = document.getElementById('file-input-strategy-folder');
    const filesInput = document.getElementById('file-input-strategy-files');
    const generateBtn = document.getElementById('generate-strategy-btn');
    const techInput = document.getElementById('tech-note-input');

    if (folderInput && !folderInput.dataset.listenerAdded) {
        folderInput.addEventListener('change', (e) => {
            handleStrategyFiles(e.target.files);
        });
        folderInput.dataset.listenerAdded = 'true';
    }

    if (filesInput && !filesInput.dataset.listenerAdded) {
        filesInput.addEventListener('change', (e) => {
            handleStrategyFiles(e.target.files);
        });
        filesInput.dataset.listenerAdded = 'true';
    }

    if (dropZone && !dropZone.dataset.setupDone) {
        setupDragDrop(dropZone, (files) => {
            handleStrategyFiles(files);
        });
        dropZone.dataset.setupDone = 'true';
    }

    if (generateBtn && !generateBtn.dataset.listenerAdded) {
        generateBtn.addEventListener('click', async () => {
            const techNote = techInput.value.trim();
            if (!techNote && strategyFiles.length === 0) {
                alert("기술 설명 내용을 입력하거나 PDF 파일을 업로드해주세요.");
                return;
            }
            await runProtectionStrategyAnalysis(techNote, strategyFiles);
        });
        generateBtn.dataset.listenerAdded = 'true';
    }
}

function handleStrategyFiles(files) {
    const newFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (newFiles.length > 0) {
        // Accumulate files instead of overwriting
        strategyFiles = [...strategyFiles, ...newFiles];
        logToUI(`Strategy tech documents added: ${newFiles.length} files. Total: ${strategyFiles.length}`);
        
        const dropZone = document.getElementById('drop-zone-strategy');
        if (dropZone) {
            dropZone.innerHTML = `<div class="file-item" style="background: rgba(99, 102, 241, 0.1); border: 1px solid var(--primary); margin: 0.5rem;">✅ 문서 준비완료 (${strategyFiles.length}건)</div>
            <p style="font-size: 0.7rem; color: var(--text-muted);">파일을 추가하시려면 버튼을 누르거나 드롭하세요.</p>`;
        }
    }
}

async function runProtectionStrategyAnalysis(techNote, file) {
    const resultsContainer = document.getElementById('strategy-results-container');
    const generateBtn = document.getElementById('generate-strategy-btn');

    try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span>⏳</span> 전략 수립 중...';
        resultsContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 400px; color: var(--text-muted);">
                <div class="spinner"></div>
                <p>Gemini AI가 기술 문서를 분석하여 최적의 보호 전략을 설계하고 있습니다...</p>
            </div>
        `;

        let extractedText = "";
        if (strategyFiles.length > 0) {
            logToUI(`Extracting text from ${strategyFiles.length} strategy PDF(s)...`);
            for (const f of strategyFiles) {
                extractedText += await extractTextFromPDF(f) + "\n\n";
            }
        }

        const combinedInput = `[입력된 기술 노트]\n${techNote}\n\n[업로드된 문서 내용]\n${extractedText}`;

        // Use existing internal patents as context if available
        let internalContext = "";
        if (currentBarrierData && currentBarrierData.length > 0) {
            internalContext = currentBarrierData.map(d => `구분:${findValue(d, '구분')}, PJT:${findValue(d, 'PJT')}, 기술:${findValue(d, '기술')}, 목적:${findValue(d, '목적')}`).join('\n');
        }

        const prompt = `
            COWAY 연구소의 수석 IP 전략가로서 다음 신규 기술에 대한 '입체적 특허 보호 전략'을 수립하라.
            
            [신규 기술 정보]
            ${combinedInput.substring(0, 8000)}
            
            [현재 보유 특허 현황 (참고)]
            ${internalContext.substring(0, 3000)}
            
            [전략 수립 지침]
            - 서론 없이 본론부터 전문적으로 작성하라.
            - **1. 패밀리 특허망(Thicket) 구축**: 메인 특허를 중심으로 핵심 부품, 제조 공정, 파생 UX를 어떻게 쪼개서 출원할지 구체적 아이디어를 제안하라.
            - **2. 청구항 권리범위 확장**: 기술 용어를 어떻게 상위 개념화하여 넓은 권리를 확보할지(예: 'A부품' -> 'A기능을 수행하는 수단') 명확한 키워드를 가이드하라.
            - **3. 경쟁사 회피 경로 차단**: 경쟁사가 기술을 보고 우회할 수 있는 시나리오 2가지를 예측하고 이를 막을 방어 특허를 제안하라.
            - **4. 기술 브랜드/디자인 연계**: 기술적 보호 외에 디자인권이나 상표권을 연계할 지점을 제안하라.
            
            [출력 형식 및 디자인 가이드라인]
            - **배경색 금지**: 모든 'div', 'table', 'th', 'td' 등에 불투명한 배경색(특히 회색, 흰색)을 절대 사용하지 마라. 모든 배경은 투명이어야 한다.
            - **글씨 색상**: 어두운 남색 배경(#0f172a)에서 가장 잘 보이는 색상만 사용하라.
                - 기본 텍스트: 밝은 회색(#cbd5e1) 또는 흰색(#ffffff)
                - 제목/헤더: 연보라(#818cf8) 또는 하늘색(#60a5fa)
                - 강조 텍스트: 노란색(#fbbf24) 또는 밝은 민트색(#34d399)
            - **박스 디자인**: 강조가 필요한 구역은 'border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);' 조합을 사용하라.
            - **테이블**: 표 가독성을 위해 테두리는 아주 연하게(rgba(255,255,255,0.1)) 처리하고 헤더만 살짝 강조하라.
            - **전문성**: 서론/결론 없이 본론만 체계적인 HTML 구조로 전달하라.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const strategyHTML = data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');
        resultsContainer.innerHTML = `<div class="analysis-report animate-fade-in">${strategyHTML}</div>`;
        logToUI("Protection Strategy generated successfully!");

    } catch (error) {
        logToUI("Strategy Analysis Error: " + error.message);
        resultsContainer.innerHTML = `<div class="analysis-placeholder"><p style="color:var(--danger);">오류 발생: ${error.message}</p></div>`;
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span>✨</span> AI 보호 전략 생성';
    }
}

// 7. Executive Strategic Analysis (Row 7)
function updateExecutiveCharts(data) {
    if (!data || data.length === 0) return;

    // 비동기 렌더링 (200ms 지연으로 부하 분산)
    setTimeout(async () => {
        // 1. 기술 선점도 vs. 시장 성숙도 분석 (Bubble Chart)
        const canvasB = document.getElementById('techMaturityMatrix');
        if (!canvasB) return;
        const parentB = canvasB.parentNode;
        
        // 부모 크기 강제 할당 (0x0 방지)
        let wB = parentB.offsetWidth || 400;
        let hB = parentB.offsetHeight || 350;
        canvasB.width = wB;
        canvasB.height = hB;

        const products = ['Water', 'Air', 'Living', 'BEREX'];
        const coreKeywords = ['최초', '원천', 'WOW', '독점'];
        
        const bubbleData = products.map(prod => {
            const pData = data.filter(d => findValue(d, '구분') === prod);
            if (pData.length === 0) return null;

            // X: 시장 성숙도 (평균 진행률)
            const xVal = pData.reduce((acc, d) => acc + (parseInt(findValue(d, '진행률')) || 0), 0) / pData.length;
            
            // Y: 기술 선점도 (원천 키워드 포함 비중)
            const coreCount = pData.filter(d => {
                const techText = (findValue(d, '기술') || '').toString();
                const pjtText = (findValue(d, 'PJT') || '').toString();
                const combined = (techText + pjtText).toLowerCase();
                return coreKeywords.some(kw => combined.includes(kw));
            }).length;
            const yVal = (coreCount / pData.length) * 100;
            
            // R: 데이터 규모 (특허 수 비례)
            const rVal = Math.max(8, Math.min(30, pData.length / 1.5)); 

            return { x: xVal, y: yVal, r: rVal, label: prod, color: productColors[prod] };
        }).filter(Boolean);

        const ctxB = canvasB.getContext('2d');
        if (charts.execB) charts.execB.destroy();
        charts.execB = new Chart(ctxB, {
            type: 'bubble',
            data: {
                datasets: bubbleData.map(d => ({
                    label: d.label,
                    data: [{ x: d.x, y: d.y, r: d.r }],
                    backgroundColor: d.color + '80', // 50% 투명도
                    borderColor: d.color,
                    borderWidth: 2
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        title: { display: true, text: '시장 성숙도 (Avg. Progress %)', color: '#94a3b8', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#64748b' },
                        min: 0, max: 100
                    },
                    y: { 
                        title: { display: true, text: '기술 선점도 (Core Tech Index)', color: '#94a3b8', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#64748b' },
                        min: 0, max: 100
                    }
                },
                plugins: {
                    legend: { position: 'top', labels: { color: '#fff', usePointStyle: true, font: { size: 11 } } },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: (context) => {
                                const d = bubbleData[context.datasetIndex];
                                return `${d.label}: 성숙도 ${d.x.toFixed(1)}%, 선점도 ${d.y.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });

        // 2. 경쟁사 우회 시나리오별 장벽 강도 (Stacked Bar Chart)
        const canvasS = document.getElementById('evasionBarrierChart');
        if (!canvasS) return;
        const parentS = canvasS.parentNode;
        
        let wS = parentS.offsetWidth || 400;
        let hS = parentS.offsetHeight || 350;
        canvasS.width = wS;
        canvasS.height = hS;

        const barrierDataSets = products.map(prod => {
            const pData = data.filter(d => findValue(d, '구분') === prod);
            
            // 가중치 계산: '방어' 목적 + '진행률 100%'
            const strongBarriers = pData.filter(d => {
                const purpose = (findValue(d, '목적') || findValue(d, '전략') || '').toString();
                const prog = parseInt(findValue(d, '진행률')) || 0;
                return (purpose.includes('방어') || purpose.toLowerCase().includes('def')) && prog === 100;
            }).length;

            const generalBarriers = pData.filter(d => {
                const purpose = (findValue(d, '목적') || findValue(d, '전략') || '').toString();
                return (purpose.includes('방어') || purpose.toLowerCase().includes('def'));
            }).length - strongBarriers;

            return { prod, strong: strongBarriers, general: Math.max(0, generalBarriers) };
        });

        const ctxS = canvasS.getContext('2d');
        if (charts.execS) charts.execS.destroy();
        charts.execS = new Chart(ctxS, {
            type: 'bar',
            data: {
                labels: products,
                datasets: [
                    { 
                        label: '강력한 장벽 (방어 100%)', 
                        data: barrierDataSets.map(s => s.strong), 
                        backgroundColor: '#818cf8',
                        borderRadius: 4
                    },
                    { 
                        label: '일반 장벽 (방어 <100%)', 
                        data: barrierDataSets.map(s => s.general), 
                        backgroundColor: 'rgba(148, 163, 184, 0.3)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                indexAxis: 'y', // 인원 보고용 가독성을 위해 가로 바 차트로 구현
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { 
                        stacked: true, 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#64748b' },
                        title: { display: true, text: '특허 건수 (Weights)', color: '#94a3b8', font: { size: 10 } }
                    },
                    y: { 
                        stacked: true, 
                        grid: { display: false }, 
                        ticks: { color: '#fff', font: { size: 11 } } 
                    }
                },
                plugins: {
                    legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 10 } } }
                }
            }
        });
    }, 200);
}
