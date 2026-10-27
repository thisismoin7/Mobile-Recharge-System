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
         if (savedHistory === null) return DEFAULT_TRANSACTION_HISTORY.map(record => ({ ...record }));



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
             throw new Error('Stored transaction history has an invalid format.');
         } catch (error) {
             console.error('Unable to load saved transaction history; using the demo history.', error);
             return DEFAULT_TRANSACTION_HISTORY.map(record => ({ ...record }));
         }
     }



     function saveTransactionHistory() {
         localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(appState.history));
     }



     function persistWalletActivity(walletBalance, history) {
         const previousHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
         const previousBalance = localStorage.getItem(WALLET_STORAGE_KEY);
         try {
             localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
             localStorage.setItem(WALLET_STORAGE_KEY, String(walletBalance));
         } catch (error) {
             try {
                 if (previousHistory === null) localStorage.removeItem(HISTORY_STORAGE_KEY);
                 else localStorage.setItem(HISTORY_STORAGE_KEY, previousHistory);
                 if (previousBalance === null) localStorage.removeItem(WALLET_STORAGE_KEY);
                 else localStorage.setItem(WALLET_STORAGE_KEY, previousBalance);
             } catch (rollbackError) {
                 console.error('Unable to roll back wallet activity after a storage failure.', rollbackError);
             }
             throw error;
         }
     }



     let appState = {
            walletBalance: getInitialWalletBalance(),
            selectedOperator: 'Jio',
            simType: 'prepaid',
            selectedPlanCost: 299,
            selectedPlanId: 'j1',
            discountAmount: 0,
            activeTab: 'recharge',
            activeCategory: 'all',
            searchQuery: '',
            history: getInitialTransactionHistory()
        };
        let pendingDeletionIndex = null;

  
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

        function getOperatorDisplayName(operator = appState.selectedOperator) {
            return operator === 'Vi' ? 'Vodafone Idea' : operator;
        }
        function receiptPrintPayload(found) {
            return {
                id: found.id,
                date: found.date,
                status: found.status,
                title: found.type === 'wallet-refill' ? 'Wallet Refill Receipt' :
                    found.status === 'Success' ? 'Revoza — Tax Invoice' : 'Recharge Unsuccessful',
                note: found.status === 'Success' ? '' : 'This recharge was unsuccessful. No amount was deducted from your wallet.',
                phoneLabel: found.type === 'wallet-refill' ? 'Account' : 'Mobile Number',
                phone: found.type === 'wallet-refill' ? 'Wallet account' : found.number,
                operatorLabel: found.type === 'wallet-refill' ? 'Transaction Type' : 'Operator / Type',
                operator: found.type === 'wallet-refill' ? 'Wallet refill' : found.operator,
                baseLabel: found.type === 'wallet-refill' ? 'Amount Added' : 'Base Plan Price',
                base: `₹${(found.type === 'wallet-refill' ? found.amount : found.planCost).toFixed(2)}`,
                gstLabel: 'GST (18%)',
                gst: `₹${(found.planCost * 0.18).toFixed(2)}`,
                includeGst: found.type !== 'wallet-refill',
                totalLabel: found.status === 'Success' ? 'Total Paid' : 'Total (not charged)',
                total: `₹${found.totalPaid.toFixed(2)}`
            };
        }

      document.addEventListener('keydown', event => {
          const modal = document.getElementById('modal-recharge-confirmation');
          if (!modal || modal.classList.contains('hidden')) return;
          if (event.key === 'Escape') {
              event.preventDefault();
              cancelRechargeConfirmation();
          } else if (event.key === 'Tab') {
              const firstButton = document.getElementById('confirm-recharge-yes');
              const lastButton = document.getElementById('confirm-recharge-no');
              if (event.shiftKey && document.activeElement === firstButton) {
                  event.preventDefault();
                  lastButton.focus();
              } else if (!event.shiftKey && document.activeElement === lastButton) {
                  event.preventDefault();
                  firstButton.focus();
              }
          }
      });

      window.onload = () => {
          if (document.getElementById('pay-button')) {
              setSimType('prepaid');
              refreshSummary();
              renderPlans();
          }
          saveTransactionHistory();
          renderLedger();

          updateKPIs();
          updateAuthUI();
          handlePhoneTyping(false);



          if (window.location.hash === '#login') {
              const menu = document.getElementById('user-menu');
              const loginButton = document.getElementById('avatar-btn');
              if (menu && loginButton) {
                  menu.classList.add('show');
                  loginButton.setAttribute('aria-expanded', 'true');
                  loginButton.focus();
              }
          }
      };

      window.addEventListener('storage', event => {
          if (event.key === HISTORY_STORAGE_KEY && event.newValue !== null) {
              const nextHistory = JSON.parse(event.newValue);
              if (Array.isArray(nextHistory)) {
                  appState.history = nextHistory;
                  renderLedger();
                  updateKPIs();
              }
          } else if (event.key === WALLET_STORAGE_KEY && event.newValue !== null) {
              const nextBalance = Number(event.newValue);
              if (Number.isFinite(nextBalance) && nextBalance >= 0) {
                  appState.walletBalance = nextBalance;
                  updateKPIs();
              }
          } else if (event.key === AUTH_SESSION_STORAGE_KEY || event.key === ACCOUNTS_STORAGE_KEY) {
              updateAuthUI();
          }
      });
    
        function navigateTab(tabName) {
            appState.activeTab = tabName;
            ['recharge', 'analytics', 'history'].forEach(id => {
                const navBtn = document.getElementById(`nav-btn-${id}`);
                const mobBtn = document.getElementById(`mobile-nav-${id}`);
                const viewEl = document.getElementById(`view-${id}`);

                if(navBtn) navBtn.className = `nav-link ${id === tabName ? 'active' : 'inactive'}`;
                if(mobBtn) mobBtn.className = `nav-link ${id === tabName ? 'active' : 'inactive'}`;
                if(viewEl) viewEl.classList.toggle('hidden', id !== tabName);
            });
        }

        function applyTheme(theme) {
            const allowed = new Set(['cool-dark', 'soft-white', 'cool-gray', 'warm-cream', 'soft-sage']);
            if (!allowed.has(theme)) return;
            document.documentElement.setAttribute('data-theme', theme);
            try {
                localStorage.setItem('revoza-theme', theme);
            } catch (error) {
                console.warn('[Jarvis] Unable to save the theme.', error);
            }
            document.querySelectorAll('.theme select, #theme-select').forEach(select => {
                select.value = theme;
            });
        }

     
        // The plan category tabs that exist for each recharge type (ids match the `type` field of plans).
        const CATEGORY_DEFINITIONS = {
            prepaid: [
                { id: 'all', label: 'All Plans' },
                { id: '5g', label: 'Unlimited 5G' },
                { id: 'data', label: 'Data Boosters' },
                { id: 'annual', label: 'Annual Value' },
                { id: 'ott', label: 'Entertainment / OTT' }
            ],
            postpaid: [
                { id: 'all', label: 'All Postpaid Plans' },
                { id: 'individual', label: 'Individual Plans' },
                { id: 'family', label: 'Family Plans' },
                { id: 'addon', label: 'Data Add-ons' }
            ]
        };

        function getCategoryDefinitions(type) {
            return CATEGORY_DEFINITIONS[type] || [];
        }

        // Activates a category through the app's own state (appState.activeCategory + renderPlans),
        // updates the tab highlight, and returns true only if the state and the tab really changed.
        function setSimType(type, announceSelection = false, targetPlanId = null) {
            if (type !== 'prepaid' && type !== 'postpaid') return;
            appState.simType = type;
            appState.activeCategory = 'all';

            const prepBtn = document.getElementById('type-prepaid');
            const postBtn = document.getElementById('type-postpaid');
            if (prepBtn) {
                prepBtn.classList.toggle('active', type === 'prepaid');
                prepBtn.setAttribute('aria-pressed', String(type === 'prepaid'));
            }
            if (postBtn) {
                postBtn.classList.toggle('active', type === 'postpaid');
                postBtn.setAttribute('aria-pressed', String(type === 'postpaid'));
            }

            const categoryTabs = document.getElementById('category-tabs');
            if (categoryTabs) {
                // Same buttons as before, now generated from the single category list.
                categoryTabs.innerHTML = getCategoryDefinitions(type).map((category, index) =>
                    `<button onclick="switchCategory('${category.id}', this)" data-category="${category.id}" class="cat-tab ${index === 0 ? 'active' : 'inactive'}">${category.label}</button>`
                ).join('\n');
            }

            const isPostpaid = type === 'postpaid';
            const payBtnText = document.getElementById('pay-button-text');
            if (payBtnText) payBtnText.textContent = 'Confirm & Pay';
            const catLabel = document.getElementById('catalog-op-label');
            if (catLabel) catLabel.textContent = `${appState.selectedOperator} (${isPostpaid ? 'Postpaid' : 'Prepaid'})`;
            const summaryLabel = document.getElementById('summary-base-label');
            if (summaryLabel) summaryLabel.textContent = isPostpaid ? 'Selected Postpaid Bill Plan' : 'Selected Base Plan';

            if (targetPlanId) {
                choosePlanById(targetPlanId, false);
            } else {
                const currentOpPlans = plansDatabase[type]?.[appState.selectedOperator] || [];
                if (currentOpPlans.length > 0) {
                    choosePlan(currentOpPlans[0].price);
                }
            }

            if (typeof showToast === 'function') {
                showToast(`Switched to ${isPostpaid ? 'Postpaid' : 'Prepaid'} Mode`, '🔄');
            }
            renderPlans();
            refreshSummary();
        }

      
        function chooseOperator(opName, announceSelection = false, targetPlanId = null) {
            if (!plansDatabase[appState.simType]?.[opName]) {
                const otherMode = appState.simType === 'prepaid' ? 'postpaid' : 'prepaid';
                if (plansDatabase[otherMode]?.[opName]) {
                    setSimType(otherMode, false, targetPlanId);
                } else {
                    return;
                }
            }
            appState.selectedOperator = opName;
            
            [...new Set(Object.values(plansDatabase).flatMap(operators => Object.keys(operators)))].forEach(op => {
                const card = document.getElementById(`op-card-${op}`);
                const check = document.getElementById(`op-check-${op}`);
                if(card) card.classList.toggle('selected', op === opName);
                if(check) check.classList.toggle('hidden', op !== opName);
            });

            const badge = document.getElementById('detected-op-badge');
            if (badge) badge.textContent = opName;
            const catLabel = document.getElementById('catalog-op-label');
            if (catLabel) catLabel.textContent = `${opName} (${appState.simType === 'postpaid' ? 'Postpaid' : 'Prepaid'})`;

            if (targetPlanId) {
                choosePlanById(targetPlanId, false);
            } else {
                const currentPlans = plansDatabase[appState.simType][opName] || [];
                if(currentPlans.length > 0) {
                    choosePlan(currentPlans[0].price);
                }
            }
            renderPlans();
        }

        function handlePhoneTyping(announceOperatorChange = true) {
            const input = document.getElementById('input-phone-num');
            const circleLabel = document.getElementById('detected-circle-text');
            if (!input || !circleLabel) return;
            const operatorBadge = document.getElementById('detected-op-badge');

            let number = input.value.replace(/\D/g, '');
            if (number.startsWith('0091') && number.length === 14) {
                number = number.slice(4);
            } else if (number.startsWith('91') && number.length === 12) {
                number = number.slice(2);
            }

            if (number.length !== 10) {
                circleLabel.textContent = number.length ? 'Enter a 10-digit number' : 'Not detected';
                if (operatorBadge) operatorBadge.textContent = '—';
                return;
            }

            const prefix = number.slice(0, 3);
            const prefixMap = {
                '982': { operator: 'Jio', circle: 'Mumbai & Maharashtra' },
                '887': { operator: 'Jio', circle: 'Mumbai & Maharashtra' },
                '981': { operator: 'Airtel', circle: 'Delhi NCR' },
                '991': { operator: 'Airtel', circle: 'Delhi NCR' },
                '989': { operator: 'Vi', circle: 'Gujarat & West India' },
                '900': { operator: 'Vi', circle: 'Gujarat & West India' }
            };
            const match = prefixMap[prefix];

            if (!match) {
                circleLabel.textContent = 'Circle not available';
                if (operatorBadge) operatorBadge.textContent = '—';
                return;
            }

            chooseOperator(match.operator, announceOperatorChange && appState.selectedOperator !== match.operator);
            circleLabel.textContent = match.circle;
        }

    
        function choosePlan(price, announceSelection = false) {
            const plan = (plansDatabase[appState.simType]?.[appState.selectedOperator] || [])
                .find(candidate => candidate.price === price);
            if (!plan) return;
            choosePlanById(plan.id, announceSelection);
        }

        function choosePlanById(planId, announceSelection = false) {
            const plan = (plansDatabase[appState.simType]?.[appState.selectedOperator] || [])
                .find(candidate => candidate.id === planId);
            if (!plan) return;
            appState.selectedPlanCost = plan.price;
            appState.selectedPlanId = plan.id;
            refreshSummary();
            renderPlans();
        }

        function getSelectedPlan() {
            const plans = plansDatabase[appState.simType]?.[appState.selectedOperator] || [];
            return plans.find(plan => plan.id === appState.selectedPlanId) ||
                plans.find(plan => plan.price === appState.selectedPlanCost) || null;
        }

        function switchCategory(cat, el) {
            appState.activeCategory = cat;
            const tabs = document.querySelectorAll('#category-tabs .cat-tab');
            tabs.forEach(t => t.className = 'cat-tab inactive');
            if(el) {
                el.className = 'cat-tab active';
            } else if(window.event && window.event.currentTarget) {
                window.event.currentTarget.className = 'cat-tab active';
            }
            renderPlans();
        }

        function filterPlans() {
            appState.searchQuery = document.getElementById('plan-search-input').value.toLowerCase();
            renderPlans();
        }

        function renderPlans() {
            const grid = document.getElementById('plans-scroll-grid');
            grid.innerHTML = '';

            const activeSet = plansDatabase[appState.simType] || {};
            let list = activeSet[appState.selectedOperator] || [];

            if(appState.activeCategory !== 'all') {
                list = list.filter(p => p.type === appState.activeCategory);
            }
            if(appState.searchQuery) {
                list = list.filter(p => p.desc.toLowerCase().includes(appState.searchQuery) || p.price.toString().includes(appState.searchQuery));
            }

            if(list.length === 0) {
                grid.innerHTML = `<p style="color:var(--text-muted); font-size:0.875rem; padding: 1rem;">No matching ${appState.simType} plans found.</p>`;
                return;
            }

            list.forEach(plan => {
                const isSelected = appState.selectedPlanId === plan.id;
                grid.innerHTML += `
                    <div class="plan-item-card ${isSelected ? 'selected' : ''}" role="button" tabindex="0" aria-pressed="${isSelected}" onclick="choosePlanById('${plan.id}', true)" onkeydown="if(event.target === this && (event.key === 'Enter' || event.key === ' ')){event.preventDefault(); choosePlanById('${plan.id}', true)}">
                        <div>
                            <div class="plan-card-head">
                                <span class="plan-amount">₹${plan.price}</span>
                                <div style="display:flex; gap:0.375rem; align-items:center;">
                                    ${plan.type === '5g' ? `<span class="badge badge-brand">UNLIMITED 5G</span>` : ''}
                                    ${plan.type === 'family' ? `<span class="badge badge-warning">FAMILY PLAN</span>` : ''}
                                    ${isSelected ? `<span class="selected-indicator">✓ Selected</span>` : ''}
                                </div>
                            </div>
                            <div class="plan-specs">
                                <div class="spec-col"><span class="spec-lbl">Data</span><span class="spec-val">${plan.data}</span></div>
                                <div class="spec-col"><span class="spec-lbl">${appState.simType === 'postpaid' ? 'Billing Cycle' : 'Validity'}</span><span class="spec-val">${plan.val}</span></div>
                            </div>
                            <div class="plan-perks">
                                ${plan.perks.map(p => `<span class="perk-pill">${p}</span>`).join('')}
                            </div>
                        </div>
                        <div class="plan-footer-row">
                            <p class="plan-desc-text">${plan.desc}</p>
                            <button type="button" class="inspect-link" aria-label="View ₹${plan.price} plan details" onclick="event.stopPropagation(); inspectPlan('${plan.id}')">Details →</button>
                        </div>
                    </div>
                `;
            });
        }

        function inspectPlan(planId) {
            const allPlans = Object.entries(plansDatabase).flatMap(([mode, operators]) =>
                Object.entries(operators).flatMap(([operator, plans]) =>
                    plans.map(plan => ({ ...plan, mode, operator }))
                )
            );
            const found = allPlans.find(plan => plan.id === planId);
            if(!found) return;

            document.getElementById('modal-plan-price').textContent = `₹${found.price} Plan Details`;
            document.getElementById('modal-plan-body').innerHTML = `
                <p><strong>Mode:</strong> ${found.mode.toUpperCase()}</p>
                <p><strong>Data Limit:</strong> ${found.data}</p>
                <p><strong>Cycle / Validity:</strong> ${found.val}</p>
                <p><strong>Operator:</strong> ${found.operator}</p>
                <p><strong>Perks:</strong> ${found.perks.join(', ')}</p>
                <p style="color: var(--text-muted); line-height: 1.4;">${found.desc}</p>
            `;
            const modal = document.getElementById('modal-plan-details');
            modal.classList.remove('hidden');
            modal.querySelector('.modal-close').focus();
        }

      
        function applyCoupon() {
            const code = document.getElementById('coupon-input').value.toUpperCase().trim();
            if(code === 'PROMO10') {
                appState.discountAmount = appState.selectedPlanCost * 0.10;
                showToast('10% Coupon Applied!', '🎉');
            } else if(code === 'FLAT50') {
                appState.discountAmount = 50;
                showToast('₹50 Discount Applied!', '🎉');
            } else {
                appState.discountAmount = 0;
                showToast('Invalid Coupon Code', '❌');
            }
            refreshSummary();
        }

        function refreshSummary() {
            const gst = appState.selectedPlanCost * 0.18;
            const total = Math.max(0, (appState.selectedPlanCost + gst) - appState.discountAmount);

            const isPostpaid = appState.simType === 'postpaid';
            document.getElementById('summary-pack-badge').textContent = `✓ ₹${appState.selectedPlanCost} ${isPostpaid ? 'Bill / Plan Selected' : 'Pack Selected'}`;
            document.getElementById('summary-base-val').textContent = `₹${appState.selectedPlanCost.toFixed(2)}`;
            document.getElementById('summary-gst-val').textContent = `₹${gst.toFixed(2)}`;

            const discountRow = document.getElementById('promo-discount-row');
            if(appState.discountAmount > 0) {
                discountRow.classList.remove('hidden');
                document.getElementById('summary-discount-val').textContent = `-₹${appState.discountAmount.toFixed(2)}`;
            } else {
                discountRow.classList.add('hidden');
            }

            document.getElementById('summary-total-val').textContent = `₹${total.toFixed(2)}`;
            document.getElementById('pay-button-amount').textContent = `₹${total.toFixed(2)}`;
        }

        // Logs a failed recharge in the ledger. The wallet is NOT charged.
        function recordUnsuccessfulRecharge(plan, phone, total) {
            const record = {
                id: `TXN-${Date.now()}`,
                date: getLocalDateTime(),
                type: 'recharge',
                number: `+91 ${phone}`,
                operator: `${getOperatorDisplayName()} (${appState.simType})`,
                planCost: plan.price,
                totalPaid: total,
                status: 'Unsuccessful'
            };
            const nextHistory = [record, ...appState.history];
            try {
                persistWalletActivity(appState.walletBalance, nextHistory);
                appState.history = nextHistory;
                renderLedger();
                updateKPIs();
            } catch (error) {
                console.error('Unable to save the unsuccessful recharge.', error);
            }
        }

        // Returns true only if a user is logged in; otherwise prompts them to log in.
        function requireLogin() {
            let account = null;
            try {
                account = getSignedInAccount();
            } catch (error) {
                console.error('Unable to read the local account session.', error);
            }
            if (account) return true;

            const modal = document.getElementById('modal-recharge-confirmation');
            if (modal) modal.classList.add('hidden');
            showToast('Please log in first to recharge.', '🔒');

            const menu = document.getElementById('user-menu');
            const loginButton = document.getElementById('avatar-btn');
            if (menu && loginButton) {
                menu.classList.add('show');
                loginButton.setAttribute('aria-expanded', 'true');
                const emailField = document.getElementById('login-email');
                if (emailField) emailField.focus();
            } else {
                window.location.href = 'login.html';
            }
            return false;
        }

        function processCheckout() {
            const confirmationModal = document.getElementById('modal-recharge-confirmation');
            if (confirmationModal && !confirmationModal.classList.contains('hidden')) {
                return;
            }
            if (!requireLogin()) return;
            if (!appState.selectedOperator) {
                showToast('Please select your operator first.', '⚠️');
                return;
            }
            const plan = getSelectedPlan();
            if (!plan) {
                showToast('Please select a recharge plan.', '⚠️');
                return;
            }
            const phone = document.getElementById('input-phone-num')?.value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
            if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
                showToast('Please enter a valid 10-digit mobile number.', '⚠️');
                return;
            }
            const gst = appState.selectedPlanCost * 0.18;
            const total = Math.max(0, (appState.selectedPlanCost + gst) - appState.discountAmount);

            // Minimum ₹500 wallet balance requirement
            const remainingBalance = appState.walletBalance - total;
            if (remainingBalance < MIN_WALLET_BALANCE) {
                const reqAmount = total + MIN_WALLET_BALANCE;
                recordUnsuccessfulRecharge(plan, phone, total);
                showToast(`Recharge unsuccessful. Minimum wallet balance of ₹500 required! Need ₹${reqAmount.toFixed(2)} in wallet.`, '❌');
                openRefillModal();
                return;
            }

            const operatorName = getOperatorDisplayName();
            const confirmation = `You selected ${operatorName}'s ${appState.selectedPlanCost} rupees ${appState.simType} plan  `;
            document.getElementById('recharge-confirmation-message').textContent = confirmation;
            document.getElementById('modal-recharge-confirmation').classList.remove('hidden');
            document.getElementById('confirm-recharge-no').focus();
        }

        function cancelRechargeConfirmation() {
            document.getElementById('modal-recharge-confirmation').classList.add('hidden');
            document.getElementById('pay-button').focus();
        }

        function confirmRecharge() {
            const modal = document.getElementById('modal-recharge-confirmation');
            if (!modal || modal.classList.contains('hidden')) return;
            if (!requireLogin()) return;

            const plan = getSelectedPlan();
            if (!plan) {
                modal.classList.add('hidden');
                showToast('Please select a recharge plan before continuing.', '⚠️');
                return;
            }

            const phone = document.getElementById('input-phone-num')?.value
                .replace(/\D/g, '')
                .replace(/^91(?=\d{10}$)/, '');
            if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
                modal.classList.add('hidden');
                showToast('Please enter a valid 10-digit mobile number.', '⚠️');
                return;
            }

            const gst = plan.price * 0.18;
            const total = Math.max(0, plan.price + gst - appState.discountAmount);
            const nextBalance = appState.walletBalance - total;
            if (nextBalance < MIN_WALLET_BALANCE) {
                modal.classList.add('hidden');
                recordUnsuccessfulRecharge(plan, phone, total);
                showToast(`Recharge unsuccessful. Minimum wallet balance of ₹500 required! Need ₹${(total + MIN_WALLET_BALANCE).toFixed(2)} in wallet.`, '❌');
                openRefillModal();
                return;
            }

            const record = {
                id: `TXN-${Date.now()}`,
                date: getLocalDateTime(),
                type: 'recharge',
                number: `+91 ${phone}`,
                operator: `${getOperatorDisplayName()} (${appState.simType})`,
                planCost: plan.price,
                totalPaid: total,
                status: 'Success'
            };
            const nextHistory = [record, ...appState.history];
            try {
                persistWalletActivity(nextBalance, nextHistory);
            } catch (error) {
                console.error('Unable to save the recharge.', error);
                modal.classList.add('hidden');
                recordUnsuccessfulRecharge(plan, phone, total);
                showToast('Recharge unsuccessful. Nothing was deducted from your wallet.', '❌');
                return;
            }

            appState.walletBalance = nextBalance;
            appState.history = nextHistory;
            modal.classList.add('hidden');
            updateKPIs();
            renderLedger();
            showToast(`Recharge successful! ₹${total.toFixed(2)} paid from your wallet.`, '✅');
            openReceiptModal(record);
        }

        function openReceiptModal(record) {
            const isRefill = record.type === 'wallet-refill';
            const isSuccess = record.status === 'Success';
            // Safe setter: pages (index / ledger) may not contain every receipt element.
            const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
            setText('rcpt-title', isRefill ? 'Wallet Refill Receipt' : isSuccess ? 'Revoza — Tax Invoice' : 'Recharge Unsuccessful');
            const note = document.getElementById('rcpt-simulation-note');
            if (note) {
                note.textContent = 'This recharge was unsuccessful. No amount was deducted from your wallet.';
                note.classList.toggle('hidden', isSuccess);
            }
            setText('rcpt-phone-label', isRefill ? 'Account:' : 'Mobile Number:');
            setText('rcpt-op-label', isRefill ? 'Transaction Type:' : 'Operator / Type:');
            setText('rcpt-base-label', isRefill ? 'Amount Added:' : 'Base Plan Price:');
            setText('rcpt-gst-label', 'GST (18%):');
            setText('rcpt-total-label', isSuccess ? 'Total Paid:' : 'Total (not charged):');
            setText('rcpt-id', record.id);
            setText('rcpt-date', record.date);
            setText('rcpt-phone', isRefill ? 'Wallet account' : record.number);
            setText('rcpt-op', isRefill ? 'Wallet refill' : record.operator);
            setText('rcpt-base', `₹${(isRefill ? record.amount : record.planCost).toFixed(2)}`);
            const gstRow = document.getElementById('rcpt-gst-row');
            if (gstRow) gstRow.classList.toggle('hidden', isRefill);
            setText('rcpt-gst', `₹${(record.planCost * 0.18).toFixed(2)}`);
            setText('rcpt-total', `₹${record.totalPaid.toFixed(2)}`);

            const receiptModal = document.getElementById('modal-receipt');
            if (receiptModal) receiptModal.classList.remove('hidden');
        }

        function printTxnReceipt(txnId, forcePrintWindow = false) {
            const found = appState.history.find(t => t.id === txnId);
            if (!found) return;
            const payload = receiptPrintPayload(found);
            if (forcePrintWindow) {
                openReceiptPrintWindow(payload);
                return;
            }
            if (document.getElementById('modal-receipt')) {
                openReceiptModal(found);
            } else {
                openReceiptPrintWindow(payload);
            }
        }

    
        function openRefillModal() { document.getElementById('modal-refill').classList.remove('hidden'); }
        function closeModals() {
        const modalIds = [
        'modal-refill',
        'modal-plan-details',
        'modal-recharge-confirmation',
        'modal-receipt'
    ];

    modalIds.forEach(id => {
        const modal = document.getElementById(id);

        if (modal) {
            modal.classList.add('hidden');
        }
    });
}
        function setRefillQuick(amt) { document.getElementById('refill-amount-input').value = amt; }

        function executeWalletRefill() {
            const amt = parseFloat(document.getElementById('refill-amount-input').value);
            if(!amt || isNaN(amt)) {
                showToast('Please enter a valid amount', '⚠️');
                return;
            }
            if(amt < 500) {
                showToast('Minimum refill amount is ₹500!', '⚠️');
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
                showToast('Wallet refill was not completed because it could not be saved.', '⚠️');
                return;
            }
            appState.walletBalance = nextBalance;
            appState.history = nextHistory;
            updateKPIs();
            renderLedger();
            closeModals();
            showToast(`Added ₹${amt} to Wallet!`, '💰');
            openReceiptModal(record);
        }

        function updateKPIs() {
            const formattedBal = appState.walletBalance.toLocaleString('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            const walletDisplay = document.getElementById('display-wallet-bal');
            const walletKPI = document.getElementById('kpi-wallet-bal');
            if (walletDisplay) walletDisplay.textContent = formattedBal;
            if (walletKPI) walletKPI.textContent = formattedBal;

            const recharges = appState.history.filter(item =>
                item.type !== 'wallet-refill' && item.status === 'Success'
            );
            const totalSpent = recharges.reduce((acc, curr) => acc + curr.totalPaid, 0);
            const count = recharges.length;
            const avg = count > 0 ? totalSpent / count : 0;

            const spentElement = document.getElementById('kpi-total-spent');
            const countElement = document.getElementById('kpi-total-count');
            const averageElement = document.getElementById('kpi-avg-amount');
            if (spentElement) spentElement.textContent = `₹${totalSpent.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            if (countElement) countElement.textContent = count;
            if (averageElement) averageElement.textContent = `₹${avg.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        function getTransactionStatusLabel(status) {
            return status === 'Success' ? 'Success' : 'Unsuccessful';
        }

     
        function renderLedger() {
            const tbody = document.getElementById('ledger-table-body');
            if (!tbody) return;
            if (appState.history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">No transactions yet.</td></tr>';
                return;
            }
            const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character]);
            tbody.innerHTML = appState.history.map((item, index) => {
                const isRefill = item.type === 'wallet-refill';
                return `
                <tr>
                    <td><strong>${escapeHtml(item.id)}</strong></td>
                    <td>${escapeHtml(item.date)}</td>
                    <td>${escapeHtml(isRefill ? 'Wallet account' : item.number)}<br><span style="font-size:0.6875rem; color:var(--text-muted);">${escapeHtml(isRefill ? 'Wallet refill' : item.operator)}</span></td>
                    <td>${isRefill ? 'Top-up' : `₹${item.planCost.toFixed(2)}`}</td>
                    <td>₹${item.totalPaid.toFixed(2)}</td>
                    <td><span class="badge ${item.status === 'Success' ? 'badge-success' : 'badge-warning'}">${getTransactionStatusLabel(item.status)}</span></td>
                    <td>
                        <div class="ledger-actions">
                            <button type="button" onclick="printLedgerReceipt(${index})" class="btn-secondary ledger-print-button">
                                🖨️ Print Receipt
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            }).join('');
        }

        function printLedgerReceipt(index) {
            const transaction = appState.history[index];
            if (transaction) printTxnReceipt(transaction.id);
        }

        function deleteTransaction(index) {
            const transaction = appState.history[index];
            if (!transaction) return;
            const modal = document.getElementById('modal-delete-transaction');
            if (!modal) return;

            pendingDeletionIndex = index;
            document.getElementById('delete-confirm-message').textContent =
                `Transaction ${transaction.id} will be permanently removed from your ledger. This action cannot be undone.`;
            modal.classList.remove('hidden');
            modal.querySelector('.delete-confirm-actions .btn-secondary').focus();
        }

        function cancelTransactionDeletion() {
            const modal = document.getElementById('modal-delete-transaction');
            if (modal) modal.classList.add('hidden');
            pendingDeletionIndex = null;
        }

        function confirmTransactionDeletion() {
            const index = pendingDeletionIndex;
            const transaction = appState.history[index];
            if (!transaction) {
                cancelTransactionDeletion();
                return;
            }

            const nextHistory = appState.history.filter((_, itemIndex) => itemIndex !== index);
            try {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
            } catch (error) {
                console.error('Unable to save transaction history after deletion.', error);
                showToast('Unable to delete this transaction. Please check browser storage.', '⚠️');
                return;
            }

            appState.history = nextHistory;
            cancelTransactionDeletion();
            renderLedger();
            updateKPIs();
            showToast('Transaction deleted.', '🗑️');
        }

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && pendingDeletionIndex !== null) {
                cancelTransactionDeletion();
            }
        });

        function exportCSV() {
            if (appState.history.length === 0) {
                showToast('There are no transactions to export.', '⚠️');
                return;
            }

            let url;
            try {
                const escapeCsv = value => {
                    let cell = String(value ?? '');
                    if (/^[\t\r\n ]*[=+\-@]/.test(cell)) cell = `'${cell}`;
                    return `"${cell.replace(/"/g, '""')}"`;
                };
                const rows = [[
                    'Transaction ID',
                    'Date',
                    'Type',
                    'Operator / Activity',
                    'Amount',
                    'Total',
                    'Status'
                ]];
                appState.history.forEach(row => {
                    const isRefill = row.type === 'wallet-refill';
                    rows.push([
                        row.id,
                        row.date,
                        isRefill ? 'Wallet refill' : row.operator.match(/\((Prepaid|Postpaid)\)/i)?.[1] || 'Recharge',
                        row.operator,
                        isRefill ? row.amount : row.planCost,
                        row.totalPaid,
                        getTransactionStatusLabel(row.status)
                    ]);
                });
                const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `transactions-${getLocalDateTime().slice(0, 10)}.csv`;
                link.click();
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                showToast('Transaction CSV file is ready to download.', '📥');
            } catch (error) {
                if (url) window.URL.revokeObjectURL(url);
                console.error('Unable to generate the transaction CSV file.', error);
                showToast('Unable to create the transaction CSV file.', '⚠️');
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
            if (!email) return null;
            return getStoredAccounts().find(account => account.email === email) || null;
        }

        function handleAuthButtonClick() {
            let account;
            try {
                account = getSignedInAccount();
            } catch (error) {
                console.error('Unable to read the local demo account session.', error);
                showToast('Could not read saved account data. Please try again.', '⚠️');
                return;
            }

            if (account) {
                const menu = document.getElementById('user-menu');
                if (menu) {
                    toggleUserMenu();
                } else {
                    toggleHeaderAccountMenu(account);
                }
                return;
            }

            window.location.href = document.body.dataset.authPage
                ? 'login.html'
                : (window.location.pathname.endsWith('/analytical.html') || window.location.pathname.endsWith('/ledger.html')
                    ? 'index.html#login'
                    : 'login.html');
        }

        function toggleHeaderAccountMenu(account) {
            const button = document.querySelector('.user-dropdown-container > .avatar-button');
            if (!button) return;

            let menu = document.getElementById('header-account-menu');
            if (!menu) {
                menu = document.createElement('div');
                menu.id = 'header-account-menu';
                menu.className = 'dropdown-menu';
                menu.setAttribute('aria-label', 'Account menu');

                const name = document.createElement('p');
                name.className = 'menu-user-name';
                name.id = 'header-account-name';
                const email = document.createElement('p');
                email.className = 'menu-user-email';
                email.id = 'header-account-email';
                const logoutButton = document.createElement('button');
                logoutButton.type = 'button';
                logoutButton.className = 'menu-item';
                logoutButton.textContent = 'Log out';
                logoutButton.addEventListener('click', logOut);

                menu.append(name, email, logoutButton);
                button.parentElement.appendChild(menu);
            }

            menu.querySelector('#header-account-name').textContent = account.name;
            menu.querySelector('#header-account-email').textContent = account.email;
            const isOpen = menu.classList.toggle('show');
            button.setAttribute('aria-expanded', String(isOpen));
        }

        function closeAuthFlyoutIfPresent() {
            const menu = document.getElementById('user-menu');
            if (menu) menu.classList.remove('show');
            const headerMenu = document.getElementById('header-account-menu');
            if (headerMenu) headerMenu.classList.remove('show');
            document.querySelectorAll('.user-dropdown-container > .avatar-button').forEach(button => {
                button.setAttribute('aria-expanded', 'false');
            });
        }

        function redirectAfterAuthSuccess() {
            const currentPage = document.body.dataset.authPage;
            if (!currentPage) return false;
            window.location.href = 'index.html';
            return true;
        }

        function updateAuthUI() {
            const button = document.getElementById('avatar-btn');
            const form = document.querySelector('.login-form');
            const session = document.getElementById('auth-session');
            if (!button || !form || !session) return;

            let account = null;
            try {
                account = getSignedInAccount();
            } catch (error) {
                console.error('Unable to read the local demo account session.', error);
                showAuthMessage('Could not read saved account data. Clear this site’s local storage and try again.');
            }

            const isSignedIn = Boolean(account);
            button.textContent = isSignedIn ? account.name : 'Login / Sign up';
            button.setAttribute('aria-label', isSignedIn ? `Show signed-in status for ${account.name}` : 'Open login form');
            form.classList.toggle('hidden', isSignedIn);
            session.classList.toggle('hidden', !isSignedIn);

            if (isSignedIn) {
                const firstName = account.name.trim().split(/\s+/)[0];
                document.getElementById('auth-eyebrow').textContent = 'WELCOME BACK';
                document.getElementById('auth-title').textContent = `Good to see you, ${firstName}!`;
                document.getElementById('auth-description').textContent = 'Your Revoza account is ready. Manage your wallet and stay connected.';
                document.getElementById('auth-session-name').textContent = `Ready for your next recharge, ${firstName}!`;
                document.getElementById('auth-session-email').textContent = account.email;
            } else {
                document.getElementById('auth-eyebrow').textContent = 'WELCOME TO REVOZA';
                document.getElementById('auth-title').textContent = authMode === 'signup' ? 'Create your account' : 'Sign in to your account';
                document.getElementById('auth-description').textContent = 'Manage your wallet and recharges in one place.';
            }
        }

        function logOut() {
            localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
            closeAuthFlyoutIfPresent();
            updateAuthUI();
            document.querySelectorAll('.user-dropdown-container > .avatar-button').forEach(button => {
                button.textContent = 'Login / Sign up';
                button.setAttribute('aria-label', 'Open login page');
            });
        }

        function toggleUserMenu() {
            const menu = document.getElementById('user-menu');
            const isOpen = menu.classList.toggle('show');
            document.getElementById('avatar-btn').setAttribute('aria-expanded', String(isOpen));
        }

        let authMode = 'login';

        function setAuthMode(mode) {
            authMode = mode === 'signup' ? 'signup' : 'login';
            const isSignup = authMode === 'signup';
            const switchButton = document.getElementById('auth-switch-button');
            const currentPage = document.body.dataset.authPage;
            const setRequired = (id, required) => {
                const field = document.getElementById(id);
                if (field) field.required = required;
            };

            if (currentPage === 'login' || currentPage === 'signup') {
                const goToPage = currentPage === 'login' ? 'signup.html' : 'login.html';
                if (switchButton) {
                    switchButton.textContent = currentPage === 'login' ? 'Create an account' : 'Sign in';
                    switchButton.setAttribute('onclick', `window.location.href='${goToPage}'`);
                }
            }

            const titleElement = document.getElementById('auth-title');
            if (titleElement) titleElement.textContent = isSignup ? 'Create your account' : 'Sign in to your account';
            const submitButton = document.getElementById('auth-submit');
            if (submitButton) submitButton.textContent = isSignup ? 'Create account' : 'Sign in';
            const prompt = document.getElementById('auth-switch-prompt');
            if (prompt) prompt.textContent = isSignup ? 'Already have an account?' : 'New to Revoza?';
            if (switchButton && !(currentPage === 'login' || currentPage === 'signup')) {
                switchButton.textContent = isSignup ? 'Sign in' : 'Create an account';
                switchButton.setAttribute('onclick', `setAuthMode('${isSignup ? 'login' : 'signup'}')`);
            }
            const nameField = document.getElementById('signup-name-field');
            if (nameField) nameField.classList.toggle('hidden', !isSignup);
            const confirmField = document.getElementById('signup-confirm-field');
            if (confirmField) confirmField.classList.toggle('hidden', !isSignup);
            const passwordRules = document.getElementById('password-rules');
            if (passwordRules) passwordRules.classList.toggle('hidden', !isSignup);
            const loginOptions = document.getElementById('login-options');
            if (loginOptions) loginOptions.classList.toggle('hidden', isSignup);
            const passwordInput = document.getElementById('login-password');
            if (passwordInput) passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
            const authMessage = document.getElementById('auth-message');
            if (authMessage) authMessage.classList.add('hidden');

            setRequired('signup-name', isSignup);
            setRequired('signup-confirm-password', isSignup);
            updatePasswordRules();
            updateAuthFeedback();
            updateAuthUI();
        }

        function bytesToHex(bytes) {
            return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        }

        function hexToBytes(hex) {
            if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) {
                throw new Error('Saved password hash data is invalid.');
            }
            return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
        }

        async function hashDemoPassword(password, salt) {
            if (!window.crypto || !window.crypto.subtle) {
                throw new Error('Secure password hashing is unavailable in this browser. Open the app on localhost and try again.');
            }
            const key = await window.crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(password),
                'PBKDF2',
                false,
                ['deriveBits']
            );
            const hash = await window.crypto.subtle.deriveBits({
                name: 'PBKDF2',
                salt: hexToBytes(salt),
                iterations: PASSWORD_HASH_ITERATIONS,
                hash: 'SHA-256'
            }, key, 256);
            return bytesToHex(new Uint8Array(hash));
        }

        function passwordHashesMatch(first, second) {
            if (first.length !== second.length) return false;
            let difference = 0;
            for (let index = 0; index < first.length; index++) {
                difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
            }
            return difference === 0;
        }

        async function handleAuthSubmit(event) {
            event.preventDefault();
            const email = document.getElementById('login-email').value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            const emailInput = document.getElementById('login-email');
            updateAuthFeedback(true);

            if (!emailInput.validity.valid) {
                showAuthMessage('Enter a valid email address.');
                emailInput.focus();
                return;
            }

            if (!password) {
                showAuthMessage('Enter your password.');
                document.getElementById('login-password').focus();
                return;
            }

            if (authMode === 'signup') {
                const name = document.getElementById('signup-name').value.trim();
                const rules = getPasswordRuleResults(password);
                const unmetRules = Object.values(rules).filter(passed => !passed).length;

                if (!isValidUserName(name)) {
                    showAuthMessage('This is not a valid format.');
                    document.getElementById('signup-name').focus();
                    return;
                }
                if (name.length < 3 || name.length > 25) {
                    showAuthMessage('User name must be between 3 and 25 characters.');
                    document.getElementById('signup-name').focus();
                    return;
                }
                if (unmetRules > 0) {
                    showAuthMessage('Your password must meet all five requirements shown above.');
                    document.getElementById('login-password').focus();
                    return;
                }
                if (password !== document.getElementById('signup-confirm-password').value) {
                    showAuthMessage('The passwords do not match.');
                    document.getElementById('signup-confirm-password').focus();
                    return;
                }

                try {
                    const accounts = getStoredAccounts();
                    if (accounts.some(account => account.email === email)) {
                        showAuthMessage('An account with this email already exists. Sign in instead.');
                        emailInput.focus();
                        return;
                    }
                    const salt = bytesToHex(window.crypto.getRandomValues(new Uint8Array(16)));
                    const passwordHash = await hashDemoPassword(password, salt);
                    accounts.push({ name, email, salt, passwordHash });
                    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
                    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, email);
                    closeAuthFlyoutIfPresent();
                    if (redirectAfterAuthSuccess()) {
                        return;
                    }
                    updateAuthUI();
                    showToast('Account created and saved in this browser.', '✅');
                } catch (error) {
                    console.error('Unable to create the local demo account.', error);
                    showAuthMessage(error instanceof DOMException && error.name === 'QuotaExceededError'
                        ? 'Browser storage is full; the account could not be saved.'
                        : (error.message || 'Could not save the account in this browser.'));
                }
                return;
            }

            try {
                const account = getStoredAccounts().find(savedAccount => savedAccount.email === email);
                if (!account) {
                    showAuthMessage('No account was found for this email. Create an account first.');
                    emailInput.focus();
                    return;
                }
                const attemptedHash = await hashDemoPassword(password, account.salt);
                if (!passwordHashesMatch(attemptedHash, account.passwordHash)) {
                    showAuthMessage('Incorrect email or password.');
                    document.getElementById('login-password').focus();
                    return;
                }

                localStorage.setItem(AUTH_SESSION_STORAGE_KEY, account.email);
                closeAuthFlyoutIfPresent();
                if (redirectAfterAuthSuccess()) {
                    return;
                }
                updateAuthUI();
                showToast(`Welcome back, ${account.name}.`, '✅');
            } catch (error) {
                console.error('Unable to sign in to the local demo account.', error);
                showAuthMessage(error instanceof DOMException && error.name === 'QuotaExceededError'
                    ? 'Browser storage is full; sign-in state could not be saved.'
                    : (error.message || 'Could not sign in using this browser.'));
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            const pageMode = document.body.dataset.authPage;
            if (pageMode === 'signup') {
                authMode = 'signup';
                setAuthMode('signup');
            } else if (pageMode === 'login') {
                authMode = 'login';
                setAuthMode('login');
            }
        });

        window.onclick = function(event) {
            if (!event.target.closest('.user-dropdown-container')) {
                const menus = document.getElementsByClassName("dropdown-menu");
                for (let i = 0; i < menus.length; i++) {
                    menus[i].classList.remove('show');
                }
                document.querySelectorAll('.user-dropdown-container > .avatar-button').forEach(button => {
                    button.setAttribute('aria-expanded', 'false');
                });
            }
        }

        function showToast(msg, icon = 'ℹ️') {
            let shelf = document.getElementById('toast-shelf');
            if (!shelf) {
                shelf = document.createElement('div');
                shelf.id = 'toast-shelf';
                shelf.setAttribute('aria-live', 'polite');
                shelf.setAttribute('aria-atomic', 'true');
                document.body.appendChild(shelf);
            }
            const card = document.createElement('div');
            card.className = 'toast-card';
            card.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
            shelf.appendChild(card);
            setTimeout(() => { card.remove(); }, 3500);
        }

       

    function printReceipt() {
    const text = (id, stripColon = false) => {
        const el = document.getElementById(id);
        const value = el ? el.textContent.trim() : '';
        return stripColon ? value.replace(/:$/, '') : value;
    };
    const noteEl = document.getElementById('rcpt-simulation-note');
    const gstRowEl = document.getElementById('rcpt-gst-row');
    const receipt = {
        id: text('rcpt-id'),
        date: text('rcpt-date'),
        title: text('rcpt-title'),
        note: noteEl && !noteEl.classList.contains('hidden') ? noteEl.textContent.trim() : '',
        phoneLabel: text('rcpt-phone-label', true),
        phone: text('rcpt-phone'),
        operatorLabel: text('rcpt-op-label', true),
        operator: text('rcpt-op'),
        baseLabel: text('rcpt-base-label', true),
        base: text('rcpt-base'),
        gstLabel: text('rcpt-gst-label', true) || 'GST (18%)',
        gst: text('rcpt-gst'),
        includeGst: gstRowEl ? !gstRowEl.classList.contains('hidden') : true,
        totalLabel: text('rcpt-total-label', true) || 'Total Paid',
        total: text('rcpt-total')
    };
    openReceiptPrintWindow(receipt);
}

function openReceiptPrintWindow(receipt, targetWindow = null) {
    const printWindow = targetWindow || window.open('', '_blank', 'width=800,height=700');

    if (!printWindow) {
        showToast('Allow pop-ups for this site to print your receipt.', '⚠️');
        return false;
    }

    const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);

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
                <h1>${escapeHtml(receipt.title || 'Revoza — Tax Invoice')}</h1>
                ${receipt.note ? `<p>${escapeHtml(receipt.note)}</p>` : ''}
                <p>Transaction ID: <strong>${escapeHtml(receipt.id)}</strong></p>
                <p>Date &amp; Time: <strong>${escapeHtml(receipt.date)}</strong></p>
                ${receipt.status ? `<p>Status: <strong>${escapeHtml(receipt.status)}</strong></p>` : ''}
                <p>${escapeHtml(receipt.phoneLabel || 'Mobile Number')}: <strong>${escapeHtml(receipt.phone)}</strong></p>
                <p>${escapeHtml(receipt.operatorLabel || 'Operator / Type')}: <strong>${escapeHtml(receipt.operator)}</strong></p>
                <hr>
                <p>${escapeHtml(receipt.baseLabel || 'Base Plan Price')}: <strong>${escapeHtml(receipt.base)}</strong></p>
                ${receipt.includeGst === false ? '' : `<p>${escapeHtml(receipt.gstLabel || 'GST (18%)')}: <strong>${escapeHtml(receipt.gst)}</strong></p>`}
                <p class="total">${escapeHtml(receipt.totalLabel || 'Total Paid')}: ${escapeHtml(receipt.total)}</p>
            </main>
        </body>
        </html>`);
    printWindow.document.close();
    // When a target window (hidden iframe) is supplied, the caller controls when print() runs.
    if (targetWindow) return true;
    printWindow.focus();
    window.setTimeout(() => {
        try { printWindow.print(); } catch (error) {
            console.warn('[Jarvis] Automatic print was blocked.', error);
        }
    }, 400);
    return true;
}