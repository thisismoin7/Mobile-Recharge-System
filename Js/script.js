const MIN_WALLET_BALANCE = 500;
const WALLET_STORAGE_KEY = 'revoza-wallet-balance';
const HISTORY_STORAGE_KEY = 'revoza-transaction-history';
const ACCOUNTS_STORAGE_KEY = 'revoza-demo-accounts';
const AUTH_SESSION_STORAGE_KEY = 'revoza-demo-session';
const PASSWORD_HASH_ITERATIONS = 150000;
const DEFAULT_TRANSACTION_HISTORY = [
    { id: 'TXN-9821', date: '2026-10-01 14:20', number: '+91 9820012345', operator: 'Jio (Prepaid)', planCost: 299, totalPaid: 352.82, status: 'Success' },
    { id: 'TXN-8714', date: '2026-09-12 11:05', number: '+91 9820012345', operator: 'Jio (Prepaid)', planCost: 666, totalPaid: 785.88, status: 'Success' },
    { id: 'TXN-7631', date: '2026-08-04 18:45', number: '+91 9811098765', operator: 'Airtel (Postpaid)', planCost: 449, totalPaid: 529.82, status: 'Success' }
];
let authMode = 'login';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hide = (id, hidden = true) => $(id)?.classList.toggle('hidden', hidden);
const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
const demoHistory = () => DEFAULT_TRANSACTION_HISTORY.map(record => ({ ...record }));

// One money format everywhere: ₹1,001.82 (Indian digit grouping, always two decimals).
function formatINR(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getLocalDateTime() {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function getInitialWalletBalance() {
    const savedBalance = localStorage.getItem(WALLET_STORAGE_KEY);
    const parsedBalance = savedBalance === null ? NaN : Number(savedBalance);
    return Number.isFinite(parsedBalance) && parsedBalance >= 0 ? parsedBalance : 2500;
}

function getInitialTransactionHistory() {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory === null) return demoHistory();
    try {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.every(record =>
            record &&
            typeof record.id === 'string' &&
            typeof record.date === 'string' &&
            typeof record.number === 'string' &&
            typeof record.operator === 'string' &&
            Number.isFinite(record.planCost) &&
            Number.isFinite(record.totalPaid) &&
            (record.type === undefined || record.type === 'recharge' || record.type === 'wallet-refill') &&
            (record.type !== 'wallet-refill' || Number.isFinite(record.amount)) &&
            typeof record.status === 'string'
        )) {
            // Older saved records may use removed statuses; map them to Success / Unsuccessful.
            return parsedHistory.map(record => ({
                ...record,
                status: record.status === 'Success' || record.status === 'Simulation only' ? 'Success' : 'Unsuccessful'
            }));
        }
        console.error('Stored transaction history has an invalid format; using the demo history.');
    } catch (error) {
        console.error('Unable to load saved transaction history; using the demo history.', error);
    }
    return demoHistory();
}

// Writes history and balance together; on failure restores both so they never disagree.
function persistWalletActivity(walletBalance, history) {
    const previous = [HISTORY_STORAGE_KEY, WALLET_STORAGE_KEY].map(key => [key, localStorage.getItem(key)]);
    try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        localStorage.setItem(WALLET_STORAGE_KEY, String(walletBalance));
    } catch (error) {
        try {
            previous.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
        } catch (rollbackError) {
            console.error('Unable to roll back wallet activity after a storage failure.', rollbackError);
        }
        throw error;
    }
}

const appState = {
    walletBalance: getInitialWalletBalance(),
    selectedOperator: 'Jio',
    simType: 'prepaid',
    selectedPlanCost: 299,
    selectedPlanId: 'j1',
    discountAmount: 0,
    activeCategory: 'all',
    searchQuery: '',
    history: getInitialTransactionHistory()
};
let lastReceipt;

const plansDatabase = {
    prepaid: {
        'Jio': [
            { id: 'j1', price: 299, data: '2GB/day', val: '28 Days', type: '5g', perks: ['Unlimited 5G', 'JioTV'], desc: 'Unlimited Calls + 100 SMS/day + Free 5G Data in eligible areas.' },
            { id: 'j2', price: 666, data: '1.5GB/day', val: '84 Days', type: 'all', perks: ['JioCinema', '1.5GB/day'], desc: 'Long validity value pack with high speed 4G/5G data.' },
            { id: 'j3', price: 849, data: '2GB/day', val: '84 Days', type: 'ott', perks: ['Disney+ Hotstar', 'Unlimited 5G'], desc: 'Includes 3 Months Disney+ Hotstar Mobile Subscription.' },
            { id: 'j4', price: 2999, data: '2.5GB/day', val: '365 Days', type: 'annual', perks: ['Annual Pack', '75GB Extra'], desc: '1 Year complete freedom with unlimited calling and high daily limit.' },
            { id: 'j5', price: 61, data: '6GB Total', val: 'Active Plan', type: 'data', perks: ['Data Booster'], desc: 'Instant high speed data add-on when main pack daily limit exhausts.' }
        ],
        'Airtel': [
            { id: 'a1', price: 319, data: '2GB/day', val: '1 Month', type: '5g', perks: ['5G Plus', 'Apollo 24|7'], desc: 'Calendar month validity with unlimited calling and Airtel Thanks perks.' },
            { id: 'a2', price: 719, data: '1.5GB/day', val: '84 Days', type: 'all', perks: ['Unlimited Voice', 'Wynk Music'], desc: 'Best selling 84-day plan with national roaming.' },
            { id: 'a3', price: 999, data: '2.5GB/day', val: '84 Days', type: 'ott', perks: ['Amazon Prime', 'Extreme Play'], desc: 'Includes Amazon Prime Membership for 84 days.' },
            { id: 'a4', price: 3359, data: '2.5GB/day', val: '365 Days', type: 'annual', perks: ['Disney+ Hotstar', 'Annual'], desc: '1 Year Disney+ Hotstar + Unlimited 5G Data.' },
            { id: 'a5', price: 65, data: '4GB Total', val: 'Active Plan', type: 'data', perks: ['Booster'], desc: 'Data top-up pack for active subscribers.' }
        ],
        'Vi': [
            { id: 'v1', price: 299, data: '1.5GB/day', val: '28 Days', type: 'all', perks: ['Binge All Night', 'Weekend Rollover'], desc: 'Unlimited data from 12 AM to 6 AM without deduction.' },
            { id: 'v2', price: 479, data: '1.5GB/day', val: '56 Days', type: 'all', perks: ['Hero Unlimited'], desc: 'Includes weekend data rollover and nightly bingeing.' },
            { id: 'v3', price: 701, data: '3GB/day', val: '56 Days', type: 'ott', perks: ['Disney+ Hotstar'], desc: 'Heavy data user pack with Disney+ streaming perks.' }
        ],
        'BSNL': [
            { id: 'b1', price: 153, data: '1GB/day', val: '26 Days', type: 'all', perks: ['BSNL Tunes'], desc: 'Affordable connectivity with national roaming.' },
            { id: 'b2', price: 398, data: 'Truly Unlimited', val: '30 Days', type: 'all', perks: ['No FUP Limit'], desc: 'Truly unlimited data without speed cap.' }
        ]
    },
    postpaid: {
        'Jio': [
            { id: 'jp1', price: 399, data: '75GB/month', val: '1 Billing Cycle', type: 'individual', perks: ['Netflix Basic', 'Amazon Prime', 'JioTV'], desc: 'Postpaid Plus plan with 75GB data rollover up to 200GB and premium OTT access.' },
            { id: 'jp2', price: 699, data: '100GB/month', val: '1 Billing Cycle', type: 'family', perks: ['3 Family Add-ons', 'Netflix Standard', 'Prime'], desc: 'Family postpaid plan with 3 family connections included and 100GB shared data.' },
            { id: 'jp3', price: 1499, data: '300GB/month', val: '1 Billing Cycle', type: 'family', perks: ['5 Family Add-ons', 'International Roaming', 'Netflix'], desc: 'Premium international roaming & unlimited postpaid suite with high data limit.' },
            { id: 'jp4', price: 249, data: '30GB Add-on', val: 'Current Bill', type: 'addon', perks: ['Data Booster', 'High Speed'], desc: 'Postpaid extra data add-on token for existing billing cycle.' }
        ],
        'Airtel': [
            { id: 'ap1', price: 449, data: '40GB/month', val: '1 Billing Cycle', type: 'individual', perks: ['Airtel Thanks', 'Wynk Premium', 'Xstream'], desc: 'Standard individual postpaid bill plan with 200GB rollover data.' },
            { id: 'ap2', price: 549, data: '75GB/month', val: '1 Billing Cycle', type: 'individual', perks: ['Disney+ Hotstar', 'Amazon Prime'], desc: 'Entertainment individual postpaid pack with VIP streaming subscriptions.' },
            { id: 'ap3', price: 999, data: '100GB/month', val: '1 Billing Cycle', type: 'family', perks: ['3 Add-on SIMs', 'Disney+ Hotstar', 'Prime'], desc: 'Family postpaid plan with 1 Primary + 3 Add-on connections.' }
        ],
        'Vi': [
            { id: 'vp1', price: 401, data: '50GB/month', val: '1 Billing Cycle', type: 'individual', perks: ['Unlimited Night 12-6', 'SonyLIV', 'VIP Care'], desc: 'Vi Max Postpaid with night data without limits and subscription choice.' },
            { id: 'vp2', price: 501, data: '90GB/month', val: '1 Billing Cycle', type: 'individual', perks: ['Amazon Prime', 'Disney+ Hotstar'], desc: 'High data postpaid plan with complete entertainment bundle.' }
        ],
        'BSNL': [
            { id: 'bp1', price: 199, data: '25GB/month', val: '1 Billing Cycle', type: 'individual', perks: ['100 SMS/day', 'National Roaming'], desc: 'Budget individual postpaid plan with rollover up to 75GB.' },
            { id: 'bp2', price: 399, data: '70GB/month', val: '1 Billing Cycle', type: 'individual', perks: ['Unlimited Calls', 'BSNL TV'], desc: 'High usage individual postpaid plan with zero FUP caps.' }
        ]
    }
};

function getOperatorDisplayName() {
    return appState.selectedOperator === 'Vi' ? 'Vodafone Idea' : appState.selectedOperator;
}

function receiptPrintPayload(found) {
    const refill = found.type === 'wallet-refill';
    const ok = found.status === 'Success';
    return {
        id: found.id,
        date: found.date,
        status: found.status,
        title: refill ? 'Wallet Refill Receipt' : ok ? 'Revoza — Tax Invoice' : 'Recharge Unsuccessful',
        note: ok ? '' : 'This recharge was unsuccessful. No amount was deducted from your wallet.',
        phoneLabel: refill ? 'Account' : 'Mobile Number',
        phone: refill ? 'Wallet account' : found.number,
        operatorLabel: refill ? 'Transaction Type' : 'Operator / Type',
        operator: refill ? 'Wallet refill' : found.operator,
        baseLabel: refill ? 'Amount Added' : 'Base Plan Price',
        base: formatINR(refill ? found.amount : found.planCost),
        gstLabel: 'GST (18%)',
        gst: formatINR(found.planCost * 0.18),
        includeGst: !refill,
        totalLabel: ok ? 'Total Paid' : 'Total (not charged)',
        total: formatINR(found.totalPaid)
    };
}

document.addEventListener('keydown', event => {
    const modal = $('modal-recharge-confirmation');
    if (!modal || modal.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        cancelRechargeConfirmation();
    } else if (event.key === 'Tab') {
        const first = $('confirm-recharge-yes');
        const last = $('confirm-recharge-no');
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});

window.onload = () => {
    if ($('pay-button')) {
        setSimType('prepaid');
        refreshSummary();
        renderPlans();
    }
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(appState.history));
    renderLedger();
    updateKPIs();
    updateAuthUI();
    handlePhoneTyping();
    if (window.location.hash === '#login' && openLoginMenu()) $('avatar-btn').focus();
};

window.addEventListener('storage', ({ key, newValue }) => {
    if (key === HISTORY_STORAGE_KEY && newValue !== null) {
        const history = JSON.parse(newValue);
        if (Array.isArray(history)) {
            appState.history = history;
            renderLedger();
            updateKPIs();
        }
    } else if (key === WALLET_STORAGE_KEY && newValue !== null) {
        const balance = Number(newValue);
        if (Number.isFinite(balance) && balance >= 0) {
            appState.walletBalance = balance;
            updateKPIs();
        }
    } else if (key === AUTH_SESSION_STORAGE_KEY || key === ACCOUNTS_STORAGE_KEY) {
        updateAuthUI();
    }
});

// The plan category tabs that exist for each recharge type (ids match the `type` field of plans).
const CATEGORY_DEFINITIONS = {
    prepaid: [
        { id: 'all', label: 'All plans' },
        { id: '5g', label: 'Unlimited 5G' },
        { id: 'data', label: 'Data boosters' },
        { id: 'annual', label: 'Annual value' },
        { id: 'ott', label: 'Entertainment / OTT' }
    ],
    postpaid: [
        { id: 'all', label: 'All postpaid plans' },
        { id: 'individual', label: 'Individual plans' },
        { id: 'family', label: 'Family plans' },
        { id: 'addon', label: 'Data add-ons' }
    ]
};

function setSimType(type, announceSelection = false) {
    if (type !== 'prepaid' && type !== 'postpaid') return;
    const isPostpaid = type === 'postpaid';
    appState.simType = type;
    appState.activeCategory = 'all';

    ['prepaid', 'postpaid'].forEach(mode => {
        const button = $(`type-${mode}`);
        if (!button) return;
        button.classList.toggle('active', mode === type);
        button.setAttribute('aria-pressed', String(mode === type));
    });
    const categoryTabs = $('category-tabs');
    if (categoryTabs) {
        categoryTabs.innerHTML = CATEGORY_DEFINITIONS[type].map((category, index) =>
            `<button onclick="switchCategory('${category.id}', this)" data-category="${category.id}" class="cat-tab ${index === 0 ? 'active' : 'inactive'}">${category.label}</button>`
        ).join('\n');
    }
    setText('catalog-op-label', `${appState.selectedOperator} (${isPostpaid ? 'Postpaid' : 'Prepaid'})`);
    setText('summary-base-label', isPostpaid ? 'Postpaid bill plan' : 'Base plan');

    selectFirstPlan();
    if (announceSelection) showToast(`Switched to ${isPostpaid ? 'postpaid' : 'prepaid'} plans.`, 'info');
    renderPlans();
    refreshSummary();
}

function chooseOperator(opName) {
    if (!plansDatabase[appState.simType][opName]) {
        const otherMode = appState.simType === 'prepaid' ? 'postpaid' : 'prepaid';
        if (!plansDatabase[otherMode][opName]) return;
        setSimType(otherMode, true);
    }
    appState.selectedOperator = opName;

    new Set(Object.values(plansDatabase).flatMap(Object.keys)).forEach(op => {
        const card = $(`op-card-${op}`);
        if (card) {
            card.classList.toggle('selected', op === opName);
            card.setAttribute('aria-pressed', String(op === opName));
        }
        hide(`op-check-${op}`, op !== opName);
    });
    setText('detected-op-badge', opName);
    setText('catalog-op-label', `${opName} (${appState.simType === 'postpaid' ? 'Postpaid' : 'Prepaid'})`);
    selectFirstPlan();
    renderPlans();
}

function handlePhoneTyping() {
    const input = $('input-phone-num');
    const circleLabel = $('detected-circle-text');
    if (!input || !circleLabel) return;

    let number = input.value.replace(/\D/g, '');
    if (number.startsWith('0091') && number.length === 14) {
        number = number.slice(4);
    } else if (number.startsWith('91') && number.length === 12) {
        number = number.slice(2);
    }

    const prefixMap = {
        '982': { operator: 'Jio', circle: 'Mumbai & Maharashtra' },
        '887': { operator: 'Jio', circle: 'Mumbai & Maharashtra' },
        '981': { operator: 'Airtel', circle: 'Delhi NCR' },
        '991': { operator: 'Airtel', circle: 'Delhi NCR' },
        '989': { operator: 'Vi', circle: 'Gujarat & West India' },
        '900': { operator: 'Vi', circle: 'Gujarat & West India' }
    };
    const match = number.length === 10 && prefixMap[number.slice(0, 3)];
    if (!match) {
        circleLabel.textContent = number.length === 10 ? 'Circle not available' : number.length ? 'Enter a 10-digit number' : 'Not detected';
        setText('detected-op-badge', '—');
        return;
    }
    chooseOperator(match.operator);
    circleLabel.textContent = match.circle;
}

function choosePlanById(planId) {
    const plan = (plansDatabase[appState.simType][appState.selectedOperator] || []).find(candidate => candidate.id === planId);
    if (!plan) return;
    appState.selectedPlanCost = plan.price;
    appState.selectedPlanId = plan.id;
    refreshSummary();
    renderPlans();
}

function selectFirstPlan() {
    const first = plansDatabase[appState.simType][appState.selectedOperator]?.[0];
    if (first) choosePlanById(first.id);
}

function getSelectedPlan() {
    const plans = plansDatabase[appState.simType][appState.selectedOperator] || [];
    return plans.find(plan => plan.id === appState.selectedPlanId) ||
        plans.find(plan => plan.price === appState.selectedPlanCost) || null;
}

function switchCategory(category, tab) {
    appState.activeCategory = category;
    document.querySelectorAll('#category-tabs .cat-tab').forEach(t => { t.className = `cat-tab ${t === tab ? 'active' : 'inactive'}`; });
    renderPlans();
}

function filterPlans() {
    appState.searchQuery = $('plan-search-input').value.toLowerCase();
    renderPlans();
}

function renderPlans() {
    let list = plansDatabase[appState.simType][appState.selectedOperator] || [];
    if (appState.activeCategory !== 'all') list = list.filter(p => p.type === appState.activeCategory);
    if (appState.searchQuery) list = list.filter(p => p.desc.toLowerCase().includes(appState.searchQuery) || String(p.price).includes(appState.searchQuery));

    $('plans-scroll-grid').innerHTML = list.length === 0
        ? `<p class="plans-empty">No matching ${appState.simType} plans found.</p>`
        : list.map(plan => {
            const isSelected = appState.selectedPlanId === plan.id;
            return `
                <div class="plan-item-card ${isSelected ? 'selected' : ''}" role="button" tabindex="0" aria-pressed="${isSelected}" onclick="choosePlanById('${plan.id}')" onkeydown="if(event.target === this && (event.key === 'Enter' || event.key === ' ')){event.preventDefault(); choosePlanById('${plan.id}')}">
                    <div>
                        <div class="plan-card-head">
                            <span class="plan-amount">₹${plan.price.toLocaleString('en-IN')}</span>
                            <div class="plan-flags">
                                ${plan.type === '5g' ? '<span class="badge badge-brand">Unlimited 5G</span>' : ''}
                                ${plan.type === 'family' ? '<span class="badge badge-warning">Family plan</span>' : ''}
                                ${isSelected ? '<span class="chip-selected">Selected</span>' : ''}
                            </div>
                        </div>
                        <div class="plan-specs">
                            <div class="spec-col"><span class="spec-lbl">Data</span><span class="spec-val">${plan.data}</span></div>
                            <div class="spec-col"><span class="spec-lbl">${appState.simType === 'postpaid' ? 'Billing cycle' : 'Validity'}</span><span class="spec-val">${plan.val}</span></div>
                        </div>
                        <p class="plan-perks">${plan.perks.join(' · ')}</p>
                    </div>
                    <div class="plan-footer-row">
                        <p class="plan-desc-text">${plan.desc}</p>
                        <button type="button" class="inspect-link" aria-label="View ₹${plan.price} plan details" onclick="event.stopPropagation(); inspectPlan('${plan.id}')">Details</button>
                    </div>
                </div>`;
        }).join('');
}

function inspectPlan(planId) {
    const found = Object.entries(plansDatabase)
        .flatMap(([mode, operators]) => Object.entries(operators).flatMap(([operator, plans]) => plans.map(plan => ({ ...plan, mode, operator }))))
        .find(plan => plan.id === planId);
    if (!found) return;

    setText('modal-plan-price', `₹${found.price.toLocaleString('en-IN')} plan details`);
    $('modal-plan-body').innerHTML = `
        <dl class="detail-list">
            <dt>Mode</dt><dd>${found.mode === 'postpaid' ? 'Postpaid' : 'Prepaid'}</dd>
            <dt>Data limit</dt><dd>${found.data}</dd>
            <dt>Cycle / validity</dt><dd>${found.val}</dd>
            <dt>Operator</dt><dd>${found.operator}</dd>
            <dt>Perks</dt><dd>${found.perks.join(', ')}</dd>
            <dd class="detail-note">${found.desc}</dd>
        </dl>`;
    hide('modal-plan-details', false);
    $('modal-plan-details').querySelector('.modal-close').focus();
}

function applyCoupon() {
    const coupons = {
        PROMO10: [appState.selectedPlanCost * 0.10, '10% discount applied.'],
        FLAT50: [50, '₹50 discount applied.']
    };
    const [amount, message] = coupons[$('coupon-input').value.toUpperCase().trim()] || [0];
    appState.discountAmount = amount;
    showToast(message || 'Invalid promo code.', message ? 'success' : 'error');
    refreshSummary();
}

// Plan price + 18% GST, minus any promo discount.
function getTotal(cost) {
    return Math.max(0, cost + cost * 0.18 - appState.discountAmount);
}

function refreshSummary() {
    const cost = appState.selectedPlanCost;
    const total = formatINR(getTotal(cost));
    setText('summary-pack-badge', `₹${cost.toLocaleString('en-IN')} ${appState.simType === 'postpaid' ? 'bill plan' : 'pack'} selected`);
    setText('summary-base-val', formatINR(cost));
    setText('summary-gst-val', formatINR(cost * 0.18));
    hide('promo-discount-row', appState.discountAmount <= 0);
    if (appState.discountAmount > 0) setText('summary-discount-val', `-${formatINR(appState.discountAmount)}`);
    setText('summary-total-val', total);
    setText('pay-button-amount', total);
}

function makeRechargeRecord(plan, phone, total, status) {
    return {
        id: `TXN-${Date.now()}`,
        date: getLocalDateTime(),
        type: 'recharge',
        number: `+91 ${phone}`,
        operator: `${getOperatorDisplayName()} (${appState.simType})`,
        planCost: plan.price,
        totalPaid: total,
        status
    };
}

// Logs a failed recharge in the ledger. The wallet is NOT charged.
function recordUnsuccessfulRecharge(plan, phone, total) {
    const nextHistory = [makeRechargeRecord(plan, phone, total, 'Unsuccessful'), ...appState.history];
    try {
        persistWalletActivity(appState.walletBalance, nextHistory);
        appState.history = nextHistory;
        renderLedger();
        updateKPIs();
    } catch (error) {
        console.error('Unable to save the unsuccessful recharge.', error);
    }
}

function openLoginMenu() {
    const menu = $('user-menu');
    const button = $('avatar-btn');
    if (!menu || !button) return false;
    menu.classList.add('show');
    button.setAttribute('aria-expanded', 'true');
    return true;
}

// Returns true only if a user is logged in; otherwise prompts them to log in.
function requireLogin() {
    try {
        if (getSignedInAccount()) return true;
    } catch (error) {
        console.error('Unable to read the local account session.', error);
    }
    hide('modal-recharge-confirmation');
    showToast('Please log in first to recharge.', 'warning');
    if (openLoginMenu()) $('login-email')?.focus();
    else window.location.href = 'login.html';
    return false;
}

// Validates the plan and phone number; returns the order, or null after a warning toast.
function getRechargeOrder() {
    const plan = getSelectedPlan();
    const phone = $('input-phone-num')?.value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    const message = !plan ? 'Please select a recharge plan.'
        : !/^[6-9]\d{9}$/.test(phone || '') ? 'Please enter a valid 10-digit mobile number.' : '';
    if (message) {
        hide('modal-recharge-confirmation');
        showToast(message, 'warning');
        return null;
    }
    return { plan, phone, total: getTotal(plan.price) };
}

// Minimum ₹500 wallet balance requirement: logs the failed recharge and opens the refill dialog.
function isWalletTooLow({ plan, phone, total }) {
    if (appState.walletBalance - total >= MIN_WALLET_BALANCE) return false;
    hide('modal-recharge-confirmation');
    recordUnsuccessfulRecharge(plan, phone, total);
    showToast(`Recharge unsuccessful. Your wallet needs ${formatINR(total + MIN_WALLET_BALANCE)} to complete this recharge and keep the ₹500 minimum balance.`, 'error');
    openRefillModal();
    return true;
}

function processCheckout() {
    if (!$('modal-recharge-confirmation').classList.contains('hidden') || !requireLogin()) return;
    const order = getRechargeOrder();
    if (!order || isWalletTooLow(order)) return;
    setText('recharge-confirmation-message', `You selected ${getOperatorDisplayName()}'s ${appState.selectedPlanCost} rupees ${appState.simType} plan  `);
    hide('modal-recharge-confirmation', false);
    $('confirm-recharge-no').focus();
}

function cancelRechargeConfirmation() {
    hide('modal-recharge-confirmation');
    $('pay-button').focus();
}

function confirmRecharge() {
    if ($('modal-recharge-confirmation').classList.contains('hidden') || !requireLogin()) return;
    const order = getRechargeOrder();
    if (!order || isWalletTooLow(order)) return;

    const { plan, phone, total } = order;
    const record = makeRechargeRecord(plan, phone, total, 'Success');
    const nextBalance = appState.walletBalance - total;
    const nextHistory = [record, ...appState.history];
    try {
        persistWalletActivity(nextBalance, nextHistory);
    } catch (error) {
        console.error('Unable to save the recharge.', error);
        hide('modal-recharge-confirmation');
        recordUnsuccessfulRecharge(plan, phone, total);
        showToast('Recharge unsuccessful. Nothing was deducted from your wallet.', 'error');
        return;
    }
    appState.walletBalance = nextBalance;
    appState.history = nextHistory;
    hide('modal-recharge-confirmation');
    updateKPIs();
    renderLedger();
    showToast(`Recharge successful. ${formatINR(total)} paid from your wallet.`, 'success');
    openReceiptModal(record);
}

function openReceiptModal(record) {
    const r = lastReceipt = receiptPrintPayload(record);
    Object.entries({
        title: r.title, id: r.id, date: r.date,
        'phone-label': r.phoneLabel, phone: r.phone,
        'op-label': r.operatorLabel, op: r.operator,
        'base-label': r.baseLabel, base: r.base,
        'gst-label': r.gstLabel, gst: r.gst,
        'total-label': r.totalLabel, total: r.total
    }).forEach(([key, text]) => setText(`rcpt-${key}`, text));
    setText('rcpt-simulation-note', r.note);
    hide('rcpt-simulation-note', !r.note);
    hide('rcpt-gst-row', !r.includeGst);
    hide('modal-receipt', false);
}

function printLedgerReceipt(index) {
    const found = appState.history[index];
    if (!found) return;
    if ($('modal-receipt')) openReceiptModal(found);
    else openReceiptPrintWindow(receiptPrintPayload(found));
}

function printReceipt() {
    openReceiptPrintWindow(lastReceipt);
}

function openRefillModal() { hide('modal-refill', false); }
function closeModals() {
    ['modal-refill', 'modal-plan-details', 'modal-recharge-confirmation', 'modal-receipt'].forEach(id => hide(id));
}
function setRefillQuick(amt) { $('refill-amount-input').value = amt; }

function executeWalletRefill() {
    const amt = parseFloat($('refill-amount-input').value);
    if (!amt) {
        showToast('Please enter a valid amount.', 'warning');
        return;
    }
    if (amt < 500) {
        showToast('Minimum refill amount is ₹500.', 'warning');
        return;
    }

    const record = {
        id: `REF-${Date.now()}`,
        date: getLocalDateTime(),
        type: 'wallet-refill',
        number: 'Wallet account',
        operator: 'Wallet refill',
        amount: amt,
        planCost: amt,
        totalPaid: amt,
        status: 'Success'
    };
    const nextBalance = appState.walletBalance + amt;
    const nextHistory = [record, ...appState.history];
    try {
        persistWalletActivity(nextBalance, nextHistory);
    } catch (error) {
        console.error('Unable to save the wallet refill.', error);
        showToast('Wallet refill was not completed because it could not be saved.', 'warning');
        return;
    }
    appState.walletBalance = nextBalance;
    appState.history = nextHistory;
    updateKPIs();
    renderLedger();
    closeModals();
    showToast(`Added ₹${amt} to your wallet.`, 'success');
    openReceiptModal(record);
}

function updateKPIs() {
    setText('display-wallet-bal', formatINR(appState.walletBalance));
    setText('kpi-wallet-bal', formatINR(appState.walletBalance));
    const recharges = appState.history.filter(item => item.type !== 'wallet-refill' && item.status === 'Success');
    const totalSpent = recharges.reduce((sum, item) => sum + item.totalPaid, 0);
    setText('kpi-total-spent', formatINR(totalSpent));
    setText('kpi-total-count', recharges.length);
    setText('kpi-avg-amount', formatINR(recharges.length ? totalSpent / recharges.length : 0));
}

function renderLedger() {
    const tbody = $('ledger-table-body');
    if (!tbody) return;
    tbody.innerHTML = appState.history.length === 0
        ? '<tr><td class="ledger-empty" colspan="7">No transactions yet.</td></tr>'
        : appState.history.map((item, index) => {
            const isRefill = item.type === 'wallet-refill';
            return `
                <tr>
                    <td>${escapeHtml(item.id)}</td>
                    <td>${escapeHtml(item.date)}</td>
                    <td>${escapeHtml(isRefill ? 'Wallet account' : item.number)}<span class="cell-sub">${escapeHtml(isRefill ? 'Wallet refill' : item.operator)}</span></td>
                    <td>${isRefill ? 'Top-up' : formatINR(item.planCost)}</td>
                    <td>${formatINR(item.totalPaid)}</td>
                    <td><span class="badge ${item.status === 'Success' ? 'badge-success' : 'badge-warning'}">${escapeHtml(item.status)}</span></td>
                    <td>
                        <div class="ledger-actions">
                            <button type="button" onclick="printLedgerReceipt(${index})" class="btn-secondary btn-sm ledger-print-button">Print receipt</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
}

function exportCSV() {
    if (appState.history.length === 0) {
        showToast('There are no transactions to export.', 'warning');
        return;
    }
    let url;
    try {
        // Leading = + - @ would run as a spreadsheet formula, so those cells get a quote prefix.
        const escapeCsv = value => {
            let cell = String(value ?? '');
            if (/^[\t\r\n ]*[=+\-@]/.test(cell)) cell = `'${cell}`;
            return `"${cell.replace(/"/g, '""')}"`;
        };
        const rows = [['Transaction ID', 'Date', 'Type', 'Operator / Activity', 'Amount', 'Total', 'Status']];
        appState.history.forEach(row => {
            const isRefill = row.type === 'wallet-refill';
            rows.push([
                row.id,
                row.date,
                isRefill ? 'Wallet refill' : row.operator.match(/\((Prepaid|Postpaid)\)/i)?.[1] || 'Recharge',
                row.operator,
                isRefill ? row.amount : row.planCost,
                row.totalPaid,
                row.status
            ]);
        });
        const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');
        url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `transactions-${getLocalDateTime().slice(0, 10)}.csv`;
        link.click();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        showToast('Transaction CSV file is ready to download.', 'success');
    } catch (error) {
        if (url) window.URL.revokeObjectURL(url);
        console.error('Unable to generate the transaction CSV file.', error);
        showToast('Unable to create the transaction CSV file.', 'warning');
    }
}

function getStoredAccounts() {
    const storedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (storedAccounts === null) return [];
    const accounts = JSON.parse(storedAccounts);
    if (!Array.isArray(accounts) || !accounts.every(account =>
        account &&
        typeof account.name === 'string' &&
        typeof account.email === 'string' &&
        typeof account.salt === 'string' &&
        typeof account.passwordHash === 'string'
    )) {
        throw new Error('Saved account data has an invalid format.');
    }
    return accounts;
}

function getSignedInAccount() {
    const email = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    return email ? getStoredAccounts().find(account => account.email === email) || null : null;
}

function handleAuthButtonClick() {
    let account;
    try {
        account = getSignedInAccount();
    } catch (error) {
        console.error('Unable to read the local demo account session.', error);
        showToast('Could not read saved account data. Please try again.', 'warning');
        return;
    }
    if (account) {
        if ($('user-menu')) toggleUserMenu();
        else toggleHeaderAccountMenu(account);
        return;
    }
    const onSubPage = /\/(analytical|ledger)\.html$/.test(window.location.pathname);
    window.location.href = !document.body.dataset.authPage && onSubPage ? 'index.html#login' : 'login.html';
}

function toggleHeaderAccountMenu(account) {
    const button = document.querySelector('.user-dropdown-container > .avatar-button');
    if (!button) return;
    let menu = $('header-account-menu');
    if (!menu) {
        menu = Object.assign(document.createElement('div'), { id: 'header-account-menu', className: 'dropdown-menu' });
        menu.setAttribute('aria-label', 'Account menu');
        menu.innerHTML = '<p class="menu-user-name" id="header-account-name"></p><p class="menu-user-email" id="header-account-email"></p><button type="button" class="menu-item">Log out</button>';
        menu.lastElementChild.addEventListener('click', logOut);
        button.parentElement.appendChild(menu);
    }
    setText('header-account-name', account.name);
    setText('header-account-email', account.email);
    button.setAttribute('aria-expanded', String(menu.classList.toggle('show')));
}

function closeAuthFlyout() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
    document.querySelectorAll('.user-dropdown-container > .avatar-button').forEach(button => button.setAttribute('aria-expanded', 'false'));
}

// After a successful sign-in or sign-up: go home from the auth pages, else refresh the flyout.
function finishAuth(message) {
    closeAuthFlyout();
    if (document.body.dataset.authPage) {
        window.location.href = 'index.html';
        return;
    }
    updateAuthUI();
    showToast(message, 'success');
}

function updateAuthUI() {
    const button = $('avatar-btn');
    const form = document.querySelector('.login-form');
    if (!button || !form || !$('auth-session')) return;

    let account = null;
    try {
        account = getSignedInAccount();
    } catch (error) {
        console.error('Unable to read the local demo account session.', error);
        showAuthMessage('Could not read saved account data. Clear this site’s local storage and try again.');
    }

    button.textContent = account ? account.name : 'Log in';
    button.setAttribute('aria-label', account ? `Show signed-in status for ${account.name}` : 'Open login form');
    form.classList.toggle('hidden', Boolean(account));
    hide('auth-session', !account);
    setText('auth-title', account ? `Signed in as ${account.name.trim().split(/\s+/)[0]}` : authMode === 'signup' ? 'Create your account' : 'Sign in to your account');
    setText('auth-description', account ? 'Your wallet and recharge history are available on this device.' : 'Manage your wallet and recharges in one place.');
    if (account) {
        setText('auth-session-name', account.name);
        setText('auth-session-email', account.email);
    }
}

function logOut() {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    closeAuthFlyout();
    updateAuthUI();
    document.querySelectorAll('.user-dropdown-container > .avatar-button').forEach(button => {
        button.textContent = 'Log in';
        button.setAttribute('aria-label', 'Open login page');
    });
}

function toggleUserMenu() {
    $('avatar-btn').setAttribute('aria-expanded', String($('user-menu').classList.toggle('show')));
}

function setAuthMode(mode) {
    authMode = mode === 'signup' ? 'signup' : 'login';
    const isSignup = authMode === 'signup';
    const page = document.body.dataset.authPage;
    const onAuthPage = page === 'login' || page === 'signup';
    // The switch button always offers the opposite mode: another page on login/signup, else the flyout toggle.
    const offerSignup = onAuthPage ? page === 'login' : !isSignup;
    const target = offerSignup ? 'signup' : 'login';
    const switchButton = $('auth-switch-button');
    if (switchButton) {
        switchButton.textContent = offerSignup ? 'Create an account' : 'Sign in';
        switchButton.setAttribute('onclick', onAuthPage ? `window.location.href='${target}.html'` : `setAuthMode('${target}')`);
    }

    setText('auth-title', isSignup ? 'Create your account' : 'Sign in to your account');
    setText('auth-submit', isSignup ? 'Create account' : 'Sign in');
    setText('auth-switch-prompt', isSignup ? 'Already have an account?' : 'New to Revoza?');
    hide('signup-name-field', !isSignup);
    hide('signup-confirm-field', !isSignup);
    hide('password-rules', !isSignup);
    hide('login-options', isSignup);
    hide('auth-message');
    const passwordInput = $('login-password');
    if (passwordInput) passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
    ['signup-name', 'signup-confirm-password'].forEach(id => {
        const field = $(id);
        if (field) field.required = isSignup;
    });
    updatePasswordRules();
    updateAuthFeedback();
    updateAuthUI();
}

const bytesToHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

function hexToBytes(hex) {
    if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('Saved password hash data is invalid.');
    return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
}

async function hashDemoPassword(password, salt) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Secure password hashing is unavailable in this browser. Open the app on localhost and try again.');
    }
    const key = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const hash = await window.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: hexToBytes(salt), iterations: PASSWORD_HASH_ITERATIONS, hash: 'SHA-256' }, key, 256);
    return bytesToHex(new Uint8Array(hash));
}

// Constant-time comparison so response timing doesn't reveal how much of a hash matched.
function passwordHashesMatch(first, second) {
    if (first.length !== second.length) return false;
    let difference = 0;
    for (let index = 0; index < first.length; index++) difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
    return difference === 0;
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const emailInput = $('login-email');
    const passwordInput = $('login-password');
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const fail = (message, field) => { showAuthMessage(message); field.focus(); };
    const storageMessage = (error, fullMessage, fallback) =>
        error instanceof DOMException && error.name === 'QuotaExceededError' ? fullMessage : (error.message || fallback);
    updateAuthFeedback(true);

    if (!emailInput.validity.valid) return fail('Enter a valid email address.', emailInput);
    if (!password) return fail('Enter your password.', passwordInput);

    if (authMode === 'signup') {
        const nameInput = $('signup-name');
        const confirmInput = $('signup-confirm-password');
        const name = nameInput.value.trim();
        const problem = [
            [!isValidUserName(name), 'This is not a valid format.', nameInput],
            [name.length < 3 || name.length > 25, 'User name must be between 3 and 25 characters.', nameInput],
            [!Object.values(getPasswordRuleResults(password)).every(Boolean), 'Your password must meet all five requirements shown above.', passwordInput],
            [password !== confirmInput.value, 'The passwords do not match.', confirmInput]
        ].find(([failed]) => failed);
        if (problem) return fail(problem[1], problem[2]);

        try {
            const accounts = getStoredAccounts();
            if (accounts.some(account => account.email === email)) return fail('An account with this email already exists. Sign in instead.', emailInput);
            const salt = bytesToHex(window.crypto.getRandomValues(new Uint8Array(16)));
            accounts.push({ name, email, salt, passwordHash: await hashDemoPassword(password, salt) });
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
            localStorage.setItem(AUTH_SESSION_STORAGE_KEY, email);
            finishAuth('Account created and saved in this browser.');
        } catch (error) {
            console.error('Unable to create the local demo account.', error);
            showAuthMessage(storageMessage(error, 'Browser storage is full; the account could not be saved.', 'Could not save the account in this browser.'));
        }
        return;
    }

    try {
        const account = getStoredAccounts().find(saved => saved.email === email);
        if (!account) return fail('No account was found for this email. Create an account first.', emailInput);
        if (!passwordHashesMatch(await hashDemoPassword(password, account.salt), account.passwordHash)) {
            return fail('Incorrect email or password.', passwordInput);
        }
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, account.email);
        finishAuth(`Welcome back, ${account.name}.`);
    } catch (error) {
        console.error('Unable to sign in to the local demo account.', error);
        showAuthMessage(storageMessage(error, 'Browser storage is full; sign-in state could not be saved.', 'Could not sign in using this browser.'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.authPage;
    if (page === 'signup' || page === 'login') setAuthMode(page);
});

window.onclick = event => {
    if (!event.target.closest('.user-dropdown-container')) closeAuthFlyout();
};

function showToast(msg, tone = 'info') {
    const card = document.createElement('div');
    card.className = 'toast-card';
    card.innerHTML = `<span class="toast-dot toast-dot--${tone}" aria-hidden="true"></span><span></span>`;
    card.lastElementChild.textContent = msg;
    $('toast-shelf').appendChild(card);
    setTimeout(() => card.remove(), 3500);
}

function openReceiptPrintWindow(receipt) {
    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) {
        showToast('Allow pop-ups for this site to print your receipt.', 'warning');
        return;
    }
    const line = (label, value) => `<p>${escapeHtml(label)}: <strong>${escapeHtml(value)}</strong></p>`;
    printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Receipt ${escapeHtml(receipt.id)}</title>
    <style>
        @page { margin: 16mm; }
        body { margin: 0; color: #111827; font: 15px Arial, sans-serif; }
        main { max-width: 680px; margin: 32px auto; padding: 28px; border: 1px solid #d1d5db; }
        h1 { margin: 0 0 24px; font-size: 24px; }
        p { margin: 12px 0; }
        hr { margin: 20px 0; border: 0; border-top: 1px solid #9ca3af; }
        .total { margin-top: 20px; padding-top: 16px; border-top: 2px solid #111827; font-size: 18px; font-weight: 700; }
        .print-action { padding: 10px 16px; border: 0; border-radius: 6px; background: #14532d; color: #fff; cursor: pointer; }
        @media print {
            main { margin: 0 auto; }
            .print-action { display: none; }
        }
    </style>
</head>
<body>
    <button class="print-action" type="button" onclick="setTimeout(()=>window.print(),500)">Print / Save as PDF</button>
    <main>
        <h1>${escapeHtml(receipt.title)}</h1>
        ${receipt.note ? `<p>${escapeHtml(receipt.note)}</p>` : ''}
        ${line('Transaction ID', receipt.id)}
        ${line('Date & Time', receipt.date)}
        ${line('Status', receipt.status)}
        ${line(receipt.phoneLabel, receipt.phone)}
        ${line(receipt.operatorLabel, receipt.operator)}
        <hr>
        ${line(receipt.baseLabel, receipt.base)}
        ${receipt.includeGst ? line(receipt.gstLabel, receipt.gst) : ''}
        <p class="total">${escapeHtml(receipt.totalLabel)}: ${escapeHtml(receipt.total)}</p>
    </main>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
        try { printWindow.print(); } catch (error) {
            console.warn('[Revoza] Automatic print was blocked.', error);
        }
    }, 400);
}
