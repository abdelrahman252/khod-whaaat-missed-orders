(function () {
  'use strict';

  function tr(key, fallback) {
    if (window.DashboardI18n && typeof window.DashboardI18n.t === 'function') {
      return window.DashboardI18n.t(key, fallback);
    }
    return fallback || key;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatError(error) {
    if (!error) return '';
    var clean = String(error).trim();
    if (clean === 'supabase_function_timeout') {
      return tr('marketing.supabaseTimeout', 'Connection is slow. Please wait and try again later.');
    }
    if (clean === 'WINDSOR_RECONNECT_REQUIRED') {
      return tr('marketing.reconnectRequiredBody', 'TikTok authorization has expired or was revoked in Windsor. Reconnect TikTok, then sync again.');
    }
    if (clean === 'WINDSOR_AUTH_FAILED') {
      return tr('marketing.windsorAuthFailed', 'Windsor rejected the marketing request. Refresh status or reconnect TikTok.');
    }
    return clean;
  }

  function formatDate(value) {
    if (!value) return tr('marketing.neverSynced', 'Not synced yet');
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  }

  function formatNumber(value, decimals) {
    if (value == null || value === '') return '--';
    var number = Number(value);
    if (!Number.isFinite(number)) return '--';
    return number.toLocaleString(undefined, {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals || 0
    });
  }

  function accountIdOf(account) {
    return String(account && (account.id || account.accountId || account.key || '') || '');
  }

  function accountLabelOf(account) {
    return String(account && (
      account.easyEmail ||
      account.easy_email ||
      account.khodEmail ||
      account.khod_email ||
      account.email ||
      account.label ||
      account.name ||
      accountIdOf(account)
    ) || '');
  }

  function accountMappingKey(account) {
    return String(accountLabelOf(account) || accountIdOf(account) || '').trim().toLowerCase();
  }

  function listKhodAccounts(data, selectedAccountId) {
    var source = data && data.meta && Array.isArray(data.meta.accountOptions)
      ? data.meta.accountOptions
      : (Array.isArray(window.dashboardAccountsList) ? window.dashboardAccountsList : []);
    var seen = {};
    var accounts = source.map(function (account) {
      var id = accountIdOf(account);
      if (!id || id === '__all__' || seen[id]) return null;
      seen[id] = true;
      return { id: id, key: accountMappingKey(account), label: accountLabelOf(account) || id };
    }).filter(Boolean);

    if (selectedAccountId && selectedAccountId !== '__all__' && !seen[selectedAccountId]) {
      accounts.push({ id: selectedAccountId, key: String(selectedAccountId).toLowerCase(), label: selectedAccountId });
    }
    return accounts;
  }

  window.renderSectionMarketingConnections = function renderSectionMarketingConnections(mount, data, ctx) {
    var fullData = ctx && ctx.data ? ctx.data : (data || {});
    var selectedAccountId = String(
      fullData && fullData.meta && fullData.meta.activeAccountId ||
      (typeof window.getActiveAccountId === 'function' ? window.getActiveAccountId() : '__all__')
    );
    var allMode = selectedAccountId === '__all__';
    var khodAccounts = listKhodAccounts(fullData, selectedAccountId);
    var shownAccounts = allMode
      ? khodAccounts
      : khodAccounts.filter(function (account) { return account.id === selectedAccountId; });
    var store = window.DashboardMarketingState;
    var pollTimer = null;
    var debugEvents = [];
    var busyLabel = '';

    function state() {
      return store && typeof store.get === 'function'
        ? store.get(selectedAccountId)
        : { status: 'disconnected', summary: null, linkedAccounts: [], mappings: {}, loading: false, error: '' };
    }

    function log(event, data) {
      var entry = {
        at: new Date().toLocaleTimeString(),
        event: event,
        data: data || {}
      };
      debugEvents.unshift(entry);
      debugEvents = debugEvents.slice(0, 8);
      console.log('[Marketing][UI] ' + event, data || {});
    }

    function mappedAccounts(current, dashboardAccount) {
      var mappings = current.mappings && typeof current.mappings === 'object' ? current.mappings : {};
      var id = typeof dashboardAccount === 'string' ? dashboardAccount : accountIdOf(dashboardAccount);
      var key = typeof dashboardAccount === 'string' ? String(dashboardAccount).toLowerCase() : accountMappingKey(dashboardAccount);
      return Array.isArray(mappings[key]) ? mappings[key] : (Array.isArray(mappings[id]) ? mappings[id] : []);
    }

    function ownerOfSource(current, sourceId) {
      var mappings = current.mappings && typeof current.mappings === 'object' ? current.mappings : {};
      var owner = '';
      Object.keys(mappings).some(function (dashboardAccountId) {
        var hasSource = Array.isArray(mappings[dashboardAccountId]) && mappings[dashboardAccountId].some(function (source) {
          return String(source.id || '') === sourceId;
        });
        if (hasSource) owner = dashboardAccountId;
        return hasSource;
      });
      return owner;
    }

    function currencyOptions(selectedCurrency) {
      return '<option value="">' + escapeHtml(tr('marketing.selectCurrency', 'Select currency')) + '</option>' +
        ['SAR', 'USD', 'EGP'].map(function (currency) {
          return '<option value="' + currency + '"' + (selectedCurrency === currency ? ' selected' : '') + '>' + currency + '</option>';
        }).join('');
    }

    function mappingRows(current) {
      var linkedAccounts = Array.isArray(current.linkedAccounts) ? current.linkedAccounts : [];
      if (!shownAccounts.length) {
        return '<p class="marketing-map-empty">' + escapeHtml(tr('marketing.noKhodAccounts', 'No Khod accounts are available to map.')) + '</p>';
      }

      return shownAccounts.map(function (dashboardAccount) {
        var assigned = mappedAccounts(current, dashboardAccount);
        var assignedIds = {};
        var assignedCurrencies = {};
        assigned.forEach(function (source) {
          assignedIds[String(source.id)] = true;
          assignedCurrencies[String(source.id)] = String(source.currency || '').toUpperCase();
        });
        var choices = linkedAccounts.map(function (source) {
          var id = String(source.id || '');
          var name = String(source.name || id);
          var detectedCurrency = String(source.currency || '').toUpperCase();
          var ownerId = ownerOfSource(current, id);
          var dashboardKey = accountMappingKey(dashboardAccount);
          var ownedElsewhere = !!ownerId && ownerId !== dashboardAccount.id && ownerId !== dashboardKey;
          var ownerAccount = shownAccounts.concat(khodAccounts).filter(function (account) {
            return account.id === ownerId || accountMappingKey(account) === ownerId;
          })[0];
          var currency = detectedCurrency || assignedCurrencies[id] || '';
          var currencyLocked = !!detectedCurrency || ownedElsewhere;
          return '<label class="marketing-mapping-choice">' +
            '<input type="checkbox" value="' + escapeHtml(id) + '"' + (assignedIds[id] ? ' checked' : '') +
              (ownedElsewhere ? ' disabled data-locked="1"' : '') + '>' +
            '<span class="marketing-source-copy"><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(id) + '</small>' +
              (ownedElsewhere ? '<em>' + escapeHtml(tr('marketing.assignedTo', 'Assigned to')) + ' ' + escapeHtml(ownerAccount ? ownerAccount.label : ownerId) + '</em>' : '') +
            '</span>' +
            '<select class="marketing-source-currency" data-source-currency="' + escapeHtml(id) + '"' + (detectedCurrency ? ' data-detected-currency="1"' : '') + (currencyLocked ? ' disabled' : '') + '>' +
              currencyOptions(currency) +
            '</select>' +
          '</label>';
        }).join('');

        return '<details class="marketing-mapping-row"' + (allMode ? '' : ' open') + ' data-marketing-map-row="' + escapeHtml(dashboardAccount.id) + '" data-marketing-map-key="' + escapeHtml(accountMappingKey(dashboardAccount)) + '">' +
          '<summary>' +
            '<span class="marketing-account-label">' + escapeHtml(dashboardAccount.label) + '</span>' +
            '<span class="marketing-assigned-pill">' + assigned.length + ' ' + escapeHtml(tr('marketing.assigned', 'assigned')) + '</span>' +
          '</summary>' +
          '<div class="marketing-mapping-choices">' + choices + '</div>' +
          (allMode ? '' :
            '<button class="marketing-secondary marketing-save-map-btn" type="button" data-marketing-save-map="' + escapeHtml(dashboardAccount.id) + '"' +
              (current.loading ? ' disabled' : '') + '>' + escapeHtml(tr('marketing.saveMapping', 'Save mapping')) + '</button>') +
        '</details>';
      }).join('');
    }

    function assignedAccountsMarkup(current, assigned) {
      return '<section class="marketing-mapping-board">' +
        '<h4>' + escapeHtml(tr('marketing.assignedTitle', 'Assigned TikTok account')) + '</h4>' +
        '<p>' + escapeHtml(tr('marketing.assignedBody', 'This Khod account is linked only to the TikTok account assigned to it.')) + '</p>' +
        '<div class="marketing-mapping-choices">' + assigned.map(function (source) {
          var id = String(source.id || '');
          var name = String(source.name || id);
          var currency = String(source.currency || '').toUpperCase();
          return '<div class="marketing-mapping-choice is-readonly">' +
            '<span class="marketing-source-copy"><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(id) + '</small></span>' +
            (currency ? '<span class="marketing-source-currency is-readonly">' + escapeHtml(currency) + '</span>' : '') +
          '</div>';
        }).join('') + '</div>' +
      '</section>';
    }

    function unassignedMarkup(current) {
      return '<section class="marketing-mapping-board">' +
        '<h4>' + escapeHtml(tr('marketing.assignmentTitle', 'TikTok account not assigned')) + '</h4>' +
        '<div class="marketing-inline-warning">' + escapeHtml(tr('marketing.assignmentMemberBody', 'No TikTok ad account has been assigned to this Khod account yet. Connect TikTok or ask an admin to assign the correct account.')) + '</div>' +
      '</section>';
    }

    function diagnosticMarkup(current) {
      var diagnostics = current.diagnostics || {};
      var events = debugEvents.map(function (event) {
        return '<div><span>' + escapeHtml(event.at) + '</span> ' + escapeHtml(event.event) + '</div>';
      }).join('');
      var lookup = diagnostics.optionsShape || {};
      return '<details class="marketing-diagnostics">' +
        '<summary>' + escapeHtml(tr('marketing.diagnostics', 'Connection diagnostics')) + '</summary>' +
        '<div class="marketing-diagnostic-stats">' +
          '<span>' + escapeHtml(tr('marketing.savedConnection', 'Saved link')) + '</span><strong>' + escapeHtml(diagnostics.hasSavedConnection ? tr('marketing.yes', 'Yes') : tr('marketing.no', 'No')) + '</strong>' +
          '<span>' + escapeHtml(tr('marketing.tokenStored', 'Link token stored')) + '</span><strong>' + escapeHtml(diagnostics.tokenPresent ? tr('marketing.yes', 'Yes') : tr('marketing.no', 'No')) + '</strong>' +
          '<span>' + escapeHtml(tr('marketing.windsorRows', 'Rows returned by Windsor')) + '</span><strong>' + escapeHtml(diagnostics.rawLinkedRows == null ? '--' : diagnostics.rawLinkedRows) + '</strong>' +
          '<span>' + escapeHtml(tr('marketing.optionsAccounts', 'Selectable accounts')) + '</span><strong>' + escapeHtml(current.linkedAccountCount == null ? '--' : current.linkedAccountCount) + '</strong>' +
        '</div>' +
        (lookup.lookup ? '<p class="marketing-diagnostic-shape">' + escapeHtml(tr('marketing.optionsShape', 'Windsor account lookup')) + ': ' + escapeHtml(JSON.stringify(lookup)) + '</p>' : '') +
        (diagnostics.optionsError ? '<p class="marketing-diagnostic-error">' + escapeHtml(diagnostics.optionsError) + '</p>' : '') +
        '<div class="marketing-debug-events">' + events + '</div>' +
      '</details>';
    }

    function render() {
      var current = state();
      var summary = current.summary;
      var connectionClass = current.status === 'connected' ? ' is-connected' : ' is-disconnected';
      var statusLabel = current.reconnectRequired
        ? tr('marketing.reconnectRequired', 'Reconnect required')
        : current.status === 'connected'
        ? tr('marketing.connected', 'Connected')
        : tr('marketing.notConnected', 'Not connected');
      var activeAccount = shownAccounts.filter(function (account) { return account.id === selectedAccountId; })[0];
      var currentMapping = allMode ? [] : mappedAccounts(current, activeAccount || selectedAccountId);
      var canSync = !allMode && current.status === 'connected' && currentMapping.length > 0 && !current.loading;
      var syncButtonLabel = currentMapping.length > 1
        ? tr('marketing.syncMapped', 'Sync Mapped TikTok Accounts')
        : tr('marketing.syncNow', 'Sync Now');
      var canSyncAll = allMode && current.status === 'connected' &&
        Object.keys(current.mappings || {}).some(function (key) { return Array.isArray(current.mappings[key]) && current.mappings[key].length; }) &&
        !current.loading;
      var canConnect = shownAccounts.length > 0 && !current.loading;
      var connectedAccounts = Array.isArray(current.linkedAccounts) ? current.linkedAccounts : [];
      var assignmentRequired = !allMode && current.diagnostics && current.diagnostics.assignmentRequired;
      var mappingContent = '';

      if (!allMode && currentMapping.length) {
        mappingContent = assignedAccountsMarkup(current, currentMapping);
      } else if (current.status === 'connected' && connectedAccounts.length && allMode) {
        mappingContent =
          '<section class="marketing-mapping-board">' +
            '<h4>' + escapeHtml(tr('marketing.mappingTitle', 'Map TikTok accounts to Khod accounts')) + '</h4>' +
            '<p>' + escapeHtml(tr('marketing.mappingBody', 'One Khod account can use multiple TikTok ad accounts. Select all that belong to each account.')) + '</p>' +
            '<div class="marketing-inline-info">' + escapeHtml(tr('marketing.allModeHint', 'Assign currencies, save all mappings once, then sync every mapped account together.')) + '</div>' +
            mappingRows(current) +
            '<div class="marketing-save-all-wrap"><button class="marketing-primary marketing-save-all-btn" id="marketing-save-all-mappings" type="button"' +
              (current.loading ? ' disabled' : '') + '>' + escapeHtml(tr('marketing.saveAllMappings', 'Save all mappings')) + '</button></div>' +
          '</section>';
      } else if (assignmentRequired) {
        mappingContent = unassignedMarkup(current);
      }

      mount.innerHTML =
        '<div class="marketing-section">' +
          '<header class="marketing-hero">' +
            '<div>' +
              '<p class="marketing-kicker">' + escapeHtml(tr('marketing.kicker', 'Marketing Integrations')) + '</p>' +
              '<h2>' + escapeHtml(tr('marketing.title', 'Connect advertising data')) + '</h2>' +
              '<p>' + escapeHtml(tr('marketing.subtitle', 'Sync TikTok spend into your existing account calculator. Your operational order metrics stay unchanged.')) + '</p>' +
            '</div>' +
            '<aside class="marketing-security"><strong>' + escapeHtml(tr('marketing.secureTitle', 'Secure connection')) + '</strong><span>' + escapeHtml(tr('marketing.secureBody', 'Authorization and API secrets run through the protected backend, not this dashboard.')) + '</span></aside>' +
          '</header>' +
          (current.error ? '<div class="marketing-message is-error">' + escapeHtml(formatError(current.error)) + '</div>' : '') +
          (current.loading ? '<div class="marketing-loading"><span class="dash-preloader-spinner"></span><span>' + escapeHtml(busyLabel || tr('marketing.working', 'Working...')) + '</span></div>' : '') +
          '<div class="marketing-platform-grid">' +
            '<article class="marketing-platform-card">' +
              '<div class="marketing-platform-head">' +
                '<div class="marketing-platform-brand"><span class="marketing-platform-mark">TT</span>' +
                '<div><strong>TikTok Ads</strong><small>' + escapeHtml(tr('marketing.liveFirst', 'Available now')) + '</small></div></div>' +
                '<span class="marketing-status' + connectionClass + '">' + escapeHtml(statusLabel) + '</span>' +
              '</div>' +
              '<div class="marketing-metric-grid">' +
                '<div><span>' + escapeHtml(tr('marketing.spend', 'Ad spend')) + '</span><strong>' + (summary ? formatNumber(summary.adSpend, 2) : '--') + '</strong></div>' +
                '<div><span>' + escapeHtml(tr('marketing.campaigns', 'Campaign rows')) + '</span><strong>' + (summary ? formatNumber(summary.campaignCount, 0) : '--') + '</strong></div>' +
                '<div><span>' + escapeHtml(tr('marketing.impressions', 'Impressions')) + '</span><strong>' + (summary ? formatNumber(summary.impressions, 0) : '--') + '</strong></div>' +
                '<div><span>' + escapeHtml(tr('marketing.clicks', 'Clicks')) + '</span><strong>' + (summary ? formatNumber(summary.clicks, 0) : '--') + '</strong></div>' +
              '</div>' +
              mappingContent +
              diagnosticMarkup(current) +
              '<div class="marketing-last-sync"><span>' + escapeHtml(tr('marketing.lastSync', 'Last sync')) + '</span><strong>' + escapeHtml(formatDate(current.lastSyncAt)) + '</strong></div>' +
              '<div class="marketing-actions">' +
                '<button class="marketing-primary" id="marketing-connect-tiktok" type="button"' + (canConnect ? '' : ' disabled') + '>' + escapeHtml((current.status === 'connected' && !assignmentRequired) || current.reconnectRequired ? tr('marketing.reconnect', 'Reconnect') : tr('marketing.connectTiktok', 'Connect TikTok')) + '</button>' +
                '<button class="marketing-secondary" id="marketing-sync-now" type="button"' + (canSync ? '' : ' disabled') + '>' + escapeHtml(syncButtonLabel) + '</button>' +
                (allMode ? '<button class="marketing-secondary" id="marketing-sync-all" type="button"' + (canSyncAll ? '' : ' disabled') + '>' + escapeHtml(tr('marketing.syncAll', 'Sync All Accounts')) + '</button>' : '') +
                '<button class="marketing-secondary" id="marketing-refresh-status" type="button"' + (shownAccounts.length && !current.loading ? '' : ' disabled') + '>' + escapeHtml(tr('marketing.refreshStatus', 'Refresh Status')) + '</button>' +
              '</div>' +
              (allMode ? '<p class="marketing-sync-note">' + escapeHtml(tr('marketing.syncSingleOnly', 'Sync all mapped accounts here, then select any account to view the same saved sync result without syncing again.')) + '</p>' : '') +
              '<p class="marketing-sync-note">' + escapeHtml(tr('marketing.windsorCacheNote', 'After renaming TikTok campaigns or adding SKUs, Windsor may return cached report rows for up to 6 hours. For historical changes, clear the Windsor cache, then sync again.')) + '</p>' +
            '</article>' +
            '<article class="marketing-platform-card is-coming">' +
              '<div class="marketing-platform-head">' +
                '<div class="marketing-platform-brand"><span class="marketing-platform-mark meta">FB</span>' +
                '<div><strong>Facebook Ads</strong><small>' + escapeHtml(tr('marketing.comingLater', 'Next phase')) + '</small></div></div>' +
                '<span class="marketing-status is-muted">' + escapeHtml(tr('marketing.comingSoon', 'Coming soon')) + '</span>' +
              '</div>' +
              '<p class="marketing-coming-copy">' + escapeHtml(tr('marketing.facebookLater', 'Facebook integration will follow after TikTok sync is verified.')) + '</p>' +
            '</article>' +
          '</div>' +
        '</div>';
      bind();
    }

    function setBusy(label) {
      busyLabel = label || '';
      if (store && typeof store.setLoading === 'function') {
        store.setLoading(true, selectedAccountId);
      }
      render();
    }

    function loadStatus() {
      if (!shownAccounts.length || !store || typeof store.load !== 'function') return Promise.resolve();
      log('refresh_status:started', { accountId: selectedAccountId });
      setBusy(tr('marketing.loadingStatus', 'Checking TikTok connection...'));
      return store.load(selectedAccountId).then(function (result) {
        busyLabel = '';
        log('refresh_status:finished', {
          status: result && result.status,
          error: result && result.error || '',
          linkedAccountCount: result && result.linkedAccountCount || 0
        });
        render();
        return result;
      });
    }

    function sourcesForRow(row) {
      return row ? Array.prototype.map.call(row.querySelectorAll('input[type="checkbox"]:checked'), function (input) {
        var currency = row.querySelector('[data-source-currency="' + CSS.escape(input.value) + '"]');
        return { id: input.value, currency: currency ? currency.value : '' };
      }) : [];
    }

    function missingCurrency(payloads) {
      return payloads.some(function (payload) {
        return payload.sourceAccounts.some(function (source) { return !source.currency; });
      });
    }

    function saveMapping(button) {
      var targetId = button.getAttribute('data-marketing-save-map') || '';
      var row = mount.querySelector('[data-marketing-map-row="' + CSS.escape(targetId) + '"]');
      var sourceAccounts = sourcesForRow(row);
      if (missingCurrency([{ sourceAccounts: sourceAccounts }])) {
        store.set(Object.assign({}, state(), { loading: false, error: tr('marketing.currencyRequired', 'Select a currency for every assigned TikTok account.') }), selectedAccountId);
        render();
        return Promise.resolve();
      }
      log('mapping:save_started', { dashboardAccountId: targetId, selectedCount: sourceAccounts.length });
      setBusy(tr('marketing.loadingSave', 'Saving mapping...'));
      return window.api.saveMarketingMapping(targetId, 'tiktok', sourceAccounts).then(function (result) {
        busyLabel = '';
        log('mapping:save_finished', {
          dashboardAccountId: targetId,
          ok: !!(result && result.ok),
          selectedCount: sourceAccounts.length,
          error: result && result.error || ''
        });
        store.set(result && result.ok ? result : Object.assign({}, state(), {
          loading: false,
          error: result && result.error || tr('marketing.mappingFailed', 'Unable to save mapping.')
        }), selectedAccountId);
        render();
      });
    }

    function saveAllMappings() {
      var rows = Array.prototype.slice.call(mount.querySelectorAll('[data-marketing-map-row]'));
      var payloads = rows.map(function (row) {
        return {
          dashboardAccountId: row.getAttribute('data-marketing-map-row') || '',
          dashboardAccountKey: row.getAttribute('data-marketing-map-key') || '',
          sourceAccounts: sourcesForRow(row)
        };
      }).filter(function (mapping) { return !!mapping.dashboardAccountId; });
      if (missingCurrency(payloads)) {
        store.set(Object.assign({}, state(), { loading: false, error: tr('marketing.currencyRequired', 'Select a currency for every assigned TikTok account.') }), selectedAccountId);
        render();
        return Promise.resolve();
      }

      log('mapping:save_all_started', { accountCount: payloads.length });
      setBusy(tr('marketing.loadingSaveAll', 'Saving all mappings...'));
      return window.api.saveAllMarketingMappings('tiktok', payloads).then(function (result) {
        if (!result || !result.ok) throw new Error(result && result.error || tr('marketing.mappingFailed', 'Unable to save mapping.'));
        log('mapping:save_all_finished', { accountCount: payloads.length, ok: true });
        busyLabel = '';
        store.set(result, selectedAccountId);
        render();
      }).catch(function (error) {
        busyLabel = '';
        log('mapping:save_all_finished', { accountCount: payloads.length, ok: false, error: error.message || String(error) });
        store.set(Object.assign({}, state(), {
          loading: false,
          error: error.message || tr('marketing.mappingFailed', 'Unable to save mapping.')
        }), selectedAccountId);
        render();
      });
    }

    function bind() {
      var connectButton = mount.querySelector('#marketing-connect-tiktok');
      var syncButton = mount.querySelector('#marketing-sync-now');
      var syncAllButton = mount.querySelector('#marketing-sync-all');
      var refreshButton = mount.querySelector('#marketing-refresh-status');
      var saveAllButton = mount.querySelector('#marketing-save-all-mappings');
      var saveButtons = mount.querySelectorAll('[data-marketing-save-map]');

      if (connectButton) {
        connectButton.addEventListener('click', function () {
          log('button:connect', { accountId: selectedAccountId });
          setBusy(tr('marketing.loadingConnect', 'Opening TikTok connection...'));
          window.api.connectMarketing(selectedAccountId, 'tiktok').then(function (result) {
            busyLabel = '';
            log('connect:finished', result || {});
            store.set(result, selectedAccountId);
            render();
            if (result && result.authorizationUrl && typeof window.api.openExternalUrl === 'function') {
              window.api.openExternalUrl(result.authorizationUrl);
              pollTimer = setInterval(loadStatus, 5000);
            }
          });
        });
      }

      Array.prototype.forEach.call(saveButtons, function (button) {
        button.addEventListener('click', function () {
          saveMapping(button);
        });
      });

      function applyDraftLocks() {
        var owners = {};
        var persistedMappings = state().mappings || {};
        Object.keys(persistedMappings).forEach(function (ownerId) {
          (Array.isArray(persistedMappings[ownerId]) ? persistedMappings[ownerId] : []).forEach(function (source) {
            var sourceId = String(source && source.id || '');
            if (sourceId && !owners[sourceId]) owners[sourceId] = ownerId;
          });
        });
        Array.prototype.forEach.call(mount.querySelectorAll('[data-marketing-map-row]'), function (row) {
          var ownerId = row.getAttribute('data-marketing-map-row') || '';
          Array.prototype.forEach.call(row.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]:checked'), function (input) {
            if (!owners[input.value]) owners[input.value] = ownerId;
          });
        });
        Array.prototype.forEach.call(mount.querySelectorAll('[data-marketing-map-row]'), function (row) {
          var ownerId = row.getAttribute('data-marketing-map-row') || '';
          Array.prototype.forEach.call(row.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]'), function (input) {
            var locked = !!owners[input.value] && owners[input.value] !== ownerId;
            input.disabled = locked;
            var currencySelect = row.querySelector('[data-source-currency="' + CSS.escape(input.value) + '"]');
            if (currencySelect) currencySelect.disabled = locked || currencySelect.getAttribute('data-detected-currency') === '1';
          });
        });
      }

      Array.prototype.forEach.call(mount.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]'), function (input) {
        input.addEventListener('change', function () {
          if (input.checked) {
            Array.prototype.forEach.call(mount.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]'), function (other) {
              if (other !== input && other.value === input.value) other.checked = false;
            });
          }
          applyDraftLocks();
        });
      });
      applyDraftLocks();

      if (saveAllButton) {
        saveAllButton.addEventListener('click', function () {
          saveAllMappings();
        });
      }

      if (syncButton) {
        syncButton.addEventListener('click', function () {
          log('button:sync', { accountId: selectedAccountId });
          setBusy(tr('marketing.loadingSync', 'Syncing marketing data...'));
          var period = fullData && fullData.meta && fullData.meta.period || {};
          var roi = window.DashboardRoiState ? window.DashboardRoiState.get(selectedAccountId, {}) : {};
          var syncPayload = {
            dateFrom: period.from || period.dateFrom || period.start || '',
            dateTo: period.to || period.dateTo || period.end || '',
            targetCurrency: 'SAR',
            egpRate: roi.egpRate || 52
          };
          var syncRequest = store && typeof store.sync === 'function'
            ? store.sync(selectedAccountId, syncPayload)
            : window.api.syncMarketingData(selectedAccountId, 'tiktok', syncPayload);
          syncRequest.then(function (result) {
            busyLabel = '';
            log('sync:finished', result || {});
            if (!store || typeof store.sync !== 'function') store.set(result, selectedAccountId);
            render();
            if (result && result.ok && window.DashboardRoiState && typeof window.DashboardRoiState.notify === 'function') {
              window.DashboardRoiState.notify();
            }
          });
        });
      }

      if (syncAllButton) {
        syncAllButton.addEventListener('click', function () {
          var period = fullData && fullData.meta && fullData.meta.period || {};
          var accountSettings = khodAccounts.map(function (account) {
            var roi = window.DashboardRoiState ? window.DashboardRoiState.get(account.id, {}) : {};
            return { dashboardAccountId: account.id, dashboardAccountKey: account.key, currency: 'SAR', egpRate: roi.egpRate || 52 };
          });
          log('button:sync_all', { accountCount: accountSettings.length });
          setBusy(tr('marketing.loadingSyncAll', 'Syncing all accounts...'));
          window.api.syncAllMarketingData('tiktok', {
            dateFrom: period.from || period.dateFrom || period.start || '',
            dateTo: period.to || period.dateTo || period.end || '',
            accountSettings: accountSettings
          }).then(function (result) {
            busyLabel = '';
            log('sync_all:finished', result || {});
            if (result && result.ok && result.accountStatuses) {
              Object.keys(result.accountStatuses).forEach(function (accountId) {
                store.set(result.accountStatuses[accountId], accountId);
              });
            }
            store.set(result, selectedAccountId);
            render();
          });
        });
      }

      if (refreshButton) {
        refreshButton.addEventListener('click', function () {
          log('button:refresh', { accountId: selectedAccountId, status: state().status });
          loadStatus();
        });
      }
    }

    log('section:mounted', { accountId: selectedAccountId, allMode: allMode, shownAccounts: shownAccounts.length });
    render();
    loadStatus();

    return function cleanupMarketingConnections() {
      if (pollTimer) clearInterval(pollTimer);
    };
  };
})();
