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

  var LIVE_PLATFORMS = [
    { id: 'tiktok', name: 'TikTok Ads', mark: 'TT', connectKey: 'marketing.connectTiktok', connectFallback: 'Connect TikTok' },
    { id: 'snapchat', name: 'Snapchat Ads', mark: 'SC', markClass: 'snap', connectKey: 'marketing.connectSnapchat', connectFallback: 'Connect Snapchat' },
    { id: 'facebook', name: 'Facebook Ads', mark: 'FB', markClass: 'meta', connectKey: 'marketing.connectFacebook', connectFallback: 'Connect Facebook' }
  ];

  function platformLabel(platform) {
    return platform === 'snapchat' ? 'Snapchat' : platform === 'facebook' ? 'Facebook' : 'TikTok';
  }

  function formatError(error, platform, current) {
    var label = platformLabel(platform);
    if (!error) return '';
    var clean = String(error).trim();
    if (clean === 'supabase_function_timeout') {
      return tr('marketing.supabaseTimeout', 'Connection is slow. Please wait and try again later.');
    }
    if (clean === 'WINDSOR_RECONNECT_REQUIRED') {
      return tr('marketing.reconnectRequiredBody', label + ' authorization has expired or was revoked in Windsor. Reconnect ' + label + ', then sync again.').replace(/\{platform\}/g, label);
    }
    if (clean === 'WINDSOR_AUTH_FAILED') {
      return tr('marketing.windsorAuthFailed', 'Windsor rejected the marketing request. Refresh status or reconnect ' + label + '.').replace(/\{platform\}/g, label);
    }
    if (clean === 'PLATFORM_NOT_AVAILABLE') {
      return tr('marketing.platformNotAvailable', label + ' is not enabled on the deployed marketing backend yet. Deploy the updated Windsor marketing function, then refresh status.').replace(/\{platform\}/g, label);
    }
    if (clean === 'MARKETING_ACCOUNT_LIMIT_EXCEEDED') {
      var limit = current && current.limit && typeof current.limit === 'object' ? current.limit : {};
      return tr('marketing.limitExceeded', 'This account can use up to {max} {platform} ad accounts. You selected {selected}. Contact support to increase the limit.')
        .replace(/\{platform\}/g, label)
        .replace(/\{max\}/g, limit.max || 2)
        .replace(/\{selected\}/g, limit.used || limit.selected || '--');
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
      account.memberName ||
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
    return String(
      account && (account.khodEmail || account.khod_email || account.easyEmail || account.easy_email || account.email) ||
      accountLabelOf(account) ||
      accountIdOf(account) ||
      ''
    ).trim().toLowerCase();
  }

  function accountMappingKeys(account) {
    var keys = [];
    function push(value) {
      var key = String(value || '').trim().toLowerCase();
      if (key && keys.indexOf(key) === -1) keys.push(key);
    }
    if (typeof account === 'string') {
      push(account);
      return keys;
    }
    if (Array.isArray(account && account.keys)) account.keys.forEach(push);
    var source = account && account.source;
    push(accountIdOf(account));
    push(accountMappingKey(account));
    [
      account && account.memberName,
      account && account.easyEmail,
      account && account.easy_email,
      account && account.khodEmail,
      account && account.khod_email,
      account && account.email,
      account && account.label,
      account && account.name,
      source && source.memberName,
      source && source.easyEmail,
      source && source.easy_email,
      source && source.khodEmail,
      source && source.khod_email,
      source && source.email,
      source && source.label,
      source && source.name
    ].forEach(push);
    return keys;
  }

  function accountOwnsMappingKey(account, key) {
    var normalized = String(key || '').trim().toLowerCase();
    return !!normalized && accountMappingKeys(account).indexOf(normalized) !== -1;
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
      return {
        id: id,
        key: accountMappingKey(account),
        keys: accountMappingKeys(account),
        label: accountLabelOf(account) || id,
        source: account
      };
    }).filter(Boolean);

    if (selectedAccountId && selectedAccountId !== '__all__' && !seen[selectedAccountId]) {
      accounts.push({ id: selectedAccountId, key: String(selectedAccountId).toLowerCase(), keys: [String(selectedAccountId).toLowerCase()], label: selectedAccountId });
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
    var pollPlatform = '';
    var debugEvents = [];
    var busyLabels = {};

    function state(platform) {
      return store && typeof store.get === 'function'
        ? store.get(selectedAccountId, platform)
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
    }

    function mappedAccounts(current, dashboardAccount) {
      var mappings = current.mappings && typeof current.mappings === 'object' ? current.mappings : {};
      var keys = accountMappingKeys(dashboardAccount);
      var assigned = [];
      keys.some(function (key) {
        if (!Array.isArray(mappings[key])) return false;
        assigned = mappings[key];
        return true;
      });
      if (!assigned.length && !allMode && current.selectedSourceAccounts && accountOwnsMappingKey(dashboardAccount, selectedAccountId)) {
        assigned = Array.isArray(current.selectedSourceAccounts) ? current.selectedSourceAccounts : [];
      }
      return assigned;
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

    function platformLimit(current, assignedCount, accountId) {
      var limits = current && current.limits && typeof current.limits === 'object' ? current.limits : {};
      var limit = accountId && limits[accountId] && typeof limits[accountId] === 'object'
        ? limits[accountId]
        : (current && current.limit && typeof current.limit === 'object' ? current.limit : {});
      var max = Number(limit.max || 2) || 2;
      var used = limit.used == null ? Number(assignedCount || 0) : Number(limit.used || 0);
      return { max: max, used: used, remaining: Math.max(0, max - used) };
    }

    function limitMarkup(current, assignedCount, platform, accountId) {
      var label = platformLabel(platform);
      var limit = platformLimit(current, assignedCount, accountId);
      var stateClass = limit.used > limit.max ? ' is-over-limit' : (limit.used >= limit.max ? ' is-at-limit' : '');
      return '<div class="marketing-limit-note' + stateClass + '">' +
        '<strong>' + escapeHtml(tr('marketing.limitUsage', 'Assigned {used} / {max} {platform} accounts')
          .replace(/\{used\}/g, limit.used)
          .replace(/\{max\}/g, limit.max)
          .replace(/\{platform\}/g, label)) + '</strong>' +
        '<span>' + escapeHtml(tr('marketing.limitHelp', 'You can assign up to {max} accounts for this platform. Contact support to increase this limit.')
          .replace(/\{max\}/g, limit.max)
          .replace(/\{platform\}/g, label)) + '</span>' +
      '</div>';
    }

    function limitPillMarkup(current, assignedCount, platform, accountId) {
      var label = platformLabel(platform);
      var limit = platformLimit(current, assignedCount, accountId);
      var stateClass = limit.used > limit.max ? ' is-over-limit' : (limit.used >= limit.max ? ' is-at-limit' : '');
      return '<span class="marketing-assigned-pill marketing-limit-pill' + stateClass + '" data-marketing-limit-pill>' +
        escapeHtml(tr('marketing.limitCompact', '{used} / {max} used')
          .replace(/\{used\}/g, limit.used)
          .replace(/\{max\}/g, limit.max)
          .replace(/\{platform\}/g, label)) +
      '</span>';
    }

    function platformUsage(current, platform) {
      if (allMode) {
        return shownAccounts.reduce(function (usage, account) {
          var assigned = mappedAccounts(current, account);
          var limit = platformLimit(current, assigned.length, account.id);
          usage.used += limit.used;
          usage.max += limit.max;
          return usage;
        }, { used: 0, max: 0 });
      }
      var activeAccount = shownAccounts.filter(function (account) { return account.id === selectedAccountId; })[0];
      var assigned = activeAccount ? mappedAccounts(current, activeAccount) : [];
      return platformLimit(current, assigned.length, activeAccount && activeAccount.id);
    }

    function platformUsageMarkup(current, platform) {
      var label = platformLabel(platform);
      var usage = platformUsage(current, platform);
      var max = Number(usage.max || 2) || 2;
      var used = Number(usage.used || 0) || 0;
      var stateClass = used > max ? ' is-over-limit' : (used >= max ? ' is-at-limit' : '');
      var title = allMode
        ? tr('marketing.workspaceUsageTitle', 'Workspace usage')
        : tr('marketing.accountUsageTitle', 'Account usage');
      var body = used >= max
        ? tr('marketing.limitReachedHelp', 'Limit reached for {platform}. Remove an assigned ad account or contact support to increase it.')
        : tr('marketing.limitAvailableHelp', '{remaining} of {max} {platform} account slots available.');
      return '<div class="marketing-platform-usage' + stateClass + '">' +
        '<div class="marketing-platform-usage-copy">' +
          '<span>' + escapeHtml(title) + '</span>' +
          '<strong>' + escapeHtml(tr('marketing.limitCompact', '{used} / {max} used')
            .replace(/\{used\}/g, used)
            .replace(/\{max\}/g, max)
            .replace(/\{platform\}/g, label)) + '</strong>' +
        '</div>' +
        '<div class="marketing-platform-usage-meter" aria-hidden="true"><span style="width:' + escapeHtml(Math.max(0, Math.min(100, Math.round((used / max) * 100)))) + '%"></span></div>' +
        '<p>' + escapeHtml(body
          .replace(/\{platform\}/g, label)
          .replace(/\{remaining\}/g, Math.max(0, max - used))
          .replace(/\{max\}/g, max)
          .replace(/\{used\}/g, used)) + '</p>' +
      '</div>';
    }

    function connectionGuideMarkup(platform) {
      var label = platformLabel(platform);
      var steps = [
        tr('marketing.guideStepConnect', 'Click Connect.'),
        tr('marketing.guideStepContinue', 'In Windsor, click Continue.'),
        tr('marketing.guideStepGrant', 'Grant {platform} access.').replace(/\{platform\}/g, label),
        tr('marketing.guideStepFinish', 'Click Finish in the top-right.'),
        tr('marketing.guideStepRefresh', 'Return here and Refresh Status.')
      ];
      return '<section class="marketing-connection-guide">' +
        '<strong>' + escapeHtml(tr('marketing.guideTitle', 'How to connect')) + '</strong>' +
        '<ol>' + steps.map(function (step) { return '<li>' + escapeHtml(step) + '</li>'; }).join('') + '</ol>' +
      '</section>';
    }

    function mappingRows(current, platform) {
      var linkedAccounts = Array.isArray(current.linkedAccounts) ? current.linkedAccounts : [];
      if (!shownAccounts.length) {
        return '<p class="marketing-map-empty">' + escapeHtml(tr('marketing.noKhodAccounts', 'No Khod accounts are available to map.')) + '</p>';
      }

      return shownAccounts.map(function (dashboardAccount) {
        var assigned = mappedAccounts(current, dashboardAccount);
        var limit = platformLimit(current, assigned.length, dashboardAccount.id);
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
          var ownedElsewhere = !!ownerId && !accountOwnsMappingKey(dashboardAccount, ownerId);
          var ownerAccount = shownAccounts.concat(khodAccounts).filter(function (account) {
            return accountOwnsMappingKey(account, ownerId);
          })[0];
          var shouldPreselect = !allMode && current.diagnostics && current.diagnostics.assignmentRequired && !assigned.length && !ownedElsewhere;
          var currency = detectedCurrency || assignedCurrencies[id] || '';
          var currencyLocked = !!detectedCurrency || ownedElsewhere;
          return '<label class="marketing-mapping-choice">' +
            '<input type="checkbox" value="' + escapeHtml(id) + '"' + (assignedIds[id] || shouldPreselect ? ' checked' : '') +
              (ownedElsewhere ? ' disabled data-locked="1"' : '') + '>' +
            '<span class="marketing-source-copy"><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(id) + '</small>' +
              (ownedElsewhere ? '<em>' + escapeHtml(tr('marketing.assignedTo', 'Assigned to')) + ' ' + escapeHtml(ownerAccount ? ownerAccount.label : ownerId) + '</em>' : '') +
            '</span>' +
            '<select class="marketing-source-currency" data-source-currency="' + escapeHtml(id) + '"' + (detectedCurrency ? ' data-detected-currency="1"' : '') + (currencyLocked ? ' disabled' : '') + '>' +
              currencyOptions(currency) +
            '</select>' +
          '</label>';
        }).join('');

        return '<details class="marketing-mapping-row"' + (allMode ? '' : ' open') + ' data-marketing-map-row="' + escapeHtml(dashboardAccount.id) + '" data-marketing-map-key="' + escapeHtml(accountMappingKey(dashboardAccount)) + '" data-marketing-limit-max="' + escapeHtml(limit.max) + '">' +
          '<summary>' +
            '<span class="marketing-account-label">' + escapeHtml(dashboardAccount.label) + '</span>' +
            '<span class="marketing-row-pills">' +
              '<span class="marketing-assigned-pill">' + assigned.length + ' ' + escapeHtml(tr('marketing.assigned', 'assigned')) + '</span>' +
              limitPillMarkup(current, assigned.length, platform, dashboardAccount.id) +
            '</span>' +
          '</summary>' +
          '<div class="marketing-mapping-choices">' + choices + '</div>' +
          limitMarkup(current, assigned.length, platform, dashboardAccount.id) +
          (allMode ? '' :
            '<button class="marketing-secondary marketing-save-map-btn" type="button" data-marketing-save-map="' + escapeHtml(dashboardAccount.id) + '"' +
              (current.loading ? ' disabled' : '') + '>' + escapeHtml(tr('marketing.saveMapping', 'Save mapping')) + '</button>') +
        '</details>';
      }).join('');
    }

    function assignedAccountsMarkup(current, assigned, platform) {
      var label = platformLabel(platform);
      return '<section class="marketing-mapping-board">' +
        '<h4>' + escapeHtml(tr('marketing.assignedTitle', 'Assigned ' + label + ' account').replace(/\{platform\}/g, label)) + '</h4>' +
        '<p>' + escapeHtml(tr('marketing.assignedBody', 'This Khod account is linked only to the ' + label + ' account assigned to it.').replace(/\{platform\}/g, label)) + '</p>' +
        '<div class="marketing-mapping-choices">' + assigned.map(function (source) {
          var id = String(source.id || '');
          var name = String(source.name || id);
          var currency = String(source.currency || '').toUpperCase();
          return '<div class="marketing-mapping-choice is-readonly">' +
            '<span class="marketing-source-copy"><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(id) + '</small></span>' +
            (currency ? '<span class="marketing-source-currency is-readonly">' + escapeHtml(currency) + '</span>' : '') +
          '</div>';
        }).join('') + '</div>' +
        limitMarkup(current, assigned.length, platform) +
      '</section>';
    }

    function unassignedMarkup(current, platform) {
      var label = platformLabel(platform);
      return '<section class="marketing-mapping-board">' +
        '<h4>' + escapeHtml(tr('marketing.assignmentTitle', label + ' account not assigned').replace(/\{platform\}/g, label)) + '</h4>' +
        '<div class="marketing-inline-warning">' + escapeHtml(tr('marketing.assignmentMemberBody', 'No ' + label + ' ad account has been assigned to this Khod account yet. Connect ' + label + ' or ask an admin to assign the correct account.').replace(/\{platform\}/g, label)) + '</div>' +
      '</section>';
    }

    function singleAssignmentMarkup(current, platform) {
      var label = platformLabel(platform);
      return '<section class="marketing-mapping-board">' +
        '<h4>' + escapeHtml(tr('marketing.finishAssignmentTitle', 'Finish ' + label + ' assignment').replace(/\{platform\}/g, label)) + '</h4>' +
        '<p>' + escapeHtml(tr('marketing.finishAssignmentBody', 'The ' + label + ' accounts detected from this single-account connection are selected for this Khod account. Choose currency where needed, then save.').replace(/\{platform\}/g, label)) + '</p>' +
        mappingRows(current, platform) +
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
          (diagnostics.workspaceConnectedAccounts != null ? '<span>' + escapeHtml(tr('marketing.workspaceAccounts', 'Workspace accounts')) + '</span><strong>' + escapeHtml(diagnostics.workspaceConnectedAccounts) + '</strong>' : '') +
        '</div>' +
        (lookup.lookup ? '<p class="marketing-diagnostic-shape">' + escapeHtml(tr('marketing.optionsShape', 'Windsor account lookup')) + ': ' + escapeHtml(JSON.stringify(lookup)) + '</p>' : '') +
        (diagnostics.optionsError ? '<p class="marketing-diagnostic-error">' + escapeHtml(diagnostics.optionsError) + '</p>' : '') +
        '<div class="marketing-debug-events">' + events + '</div>' +
      '</details>';
    }

    function platformCard(config) {
      var platform = config.id;
      var label = platformLabel(platform);
      var current = state(platform);
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
        ? tr('marketing.syncMapped', 'Sync Mapped ' + label + ' Accounts').replace(/\{platform\}/g, label)
        : tr('marketing.syncNow', 'Sync Now');
      var canSyncAll = allMode && current.status === 'connected' &&
        Object.keys(current.mappings || {}).some(function (key) { return Array.isArray(current.mappings[key]) && current.mappings[key].length; }) &&
        !current.loading;
      var usage = platformUsage(current, platform);
      var usageFull = Number(usage.used || 0) >= (Number(usage.max || 2) || 2);
      var canConnect = shownAccounts.length > 0 && !current.loading && (!usageFull || current.status === 'connected' || current.reconnectRequired);
      var connectedAccounts = Array.isArray(current.linkedAccounts) ? current.linkedAccounts : [];
      var assignmentRequired = !allMode && current.diagnostics && current.diagnostics.assignmentRequired;
      var mappingContent = '';

      if (!allMode && currentMapping.length) {
        mappingContent = assignedAccountsMarkup(current, currentMapping, platform);
      } else if (current.status === 'connected' && connectedAccounts.length && allMode) {
        mappingContent =
          '<section class="marketing-mapping-board">' +
            '<h4>' + escapeHtml(tr('marketing.mappingTitle', 'Map ' + label + ' accounts to Khod accounts').replace(/\{platform\}/g, label)) + '</h4>' +
            '<p>' + escapeHtml(tr('marketing.mappingBody', 'One Khod account can use multiple ' + label + ' ad accounts. Select all that belong to each account.').replace(/\{platform\}/g, label)) + '</p>' +
            '<div class="marketing-inline-info">' + escapeHtml(tr('marketing.allModeHint', 'Assign currencies, save all mappings once, then sync every mapped account together.')) + '</div>' +
            mappingRows(current, platform) +
            '<div class="marketing-save-all-wrap"><button class="marketing-primary marketing-save-all-btn" data-marketing-save-all="' + escapeHtml(platform) + '" type="button"' +
              (current.loading ? ' disabled' : '') + '>' + escapeHtml(tr('marketing.saveAllMappings', 'Save all mappings')) + '</button></div>' +
          '</section>';
      } else if (assignmentRequired && current.status === 'connected' && connectedAccounts.length) {
        mappingContent = singleAssignmentMarkup(current, platform);
      } else if (assignmentRequired) {
        mappingContent = unassignedMarkup(current, platform);
      } else if (!allMode && current.status !== 'connected') {
        mappingContent = connectionGuideMarkup(platform);
      }

      return '<article class="marketing-platform-card" data-marketing-platform="' + escapeHtml(platform) + '">' +
          (current.error ? '<div class="marketing-message is-error">' + escapeHtml(formatError(current.error, platform, current)) + '</div>' : '') +
          (current.loading ? '<div class="marketing-loading"><span class="dash-preloader-spinner"></span><span>' + escapeHtml(busyLabels[platform] || tr('marketing.working', 'Working...')) + '</span></div>' : '') +
          '<div class="marketing-platform-head">' +
            '<div class="marketing-platform-brand"><span class="marketing-platform-mark ' + escapeHtml(config.markClass || '') + '">' + escapeHtml(config.mark) + '</span>' +
            '<div><strong>' + escapeHtml(config.name) + '</strong><small>' + escapeHtml(tr('marketing.liveFirst', 'Available now')) + '</small></div></div>' +
            '<span class="marketing-status' + connectionClass + '">' + escapeHtml(statusLabel) + '</span>' +
          '</div>' +
          platformUsageMarkup(current, platform) +
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
            '<button class="marketing-primary" data-marketing-connect="' + escapeHtml(platform) + '" type="button"' + (canConnect ? '' : ' disabled') + '>' + escapeHtml((current.status === 'connected' && !assignmentRequired) || current.reconnectRequired ? tr('marketing.reconnect', 'Reconnect') : tr(config.connectKey, config.connectFallback)) + '</button>' +
            '<button class="marketing-secondary" data-marketing-sync="' + escapeHtml(platform) + '" type="button"' + (canSync ? '' : ' disabled') + '>' + escapeHtml(syncButtonLabel) + '</button>' +
            (allMode ? '<button class="marketing-secondary" data-marketing-sync-all="' + escapeHtml(platform) + '" type="button"' + (canSyncAll ? '' : ' disabled') + '>' + escapeHtml(tr('marketing.syncAll', 'Sync All Accounts')) + '</button>' : '') +
            '<button class="marketing-secondary" data-marketing-refresh="' + escapeHtml(platform) + '" type="button"' + (shownAccounts.length && !current.loading ? '' : ' disabled') + '>' + escapeHtml(tr('marketing.refreshStatus', 'Refresh Status')) + '</button>' +
          '</div>' +
          (allMode ? '<p class="marketing-sync-note">' + escapeHtml(tr('marketing.syncSingleOnly', 'Sync all mapped accounts here, then select any account to view the same saved sync result without syncing again.')) + '</p>' : '') +
          '<p class="marketing-sync-note">' + escapeHtml(tr('marketing.windsorCacheNote', 'After renaming ' + label + ' campaigns or adding SKUs, Windsor may return cached report rows for up to 6 hours. For historical changes, clear the Windsor cache, then sync again.').replace(/\{platform\}/g, label)) + '</p>' +
        '</article>';
    }

    function render() {
      mount.innerHTML =
        '<div class="marketing-section">' +
          '<header class="marketing-hero">' +
            '<div>' +
              '<p class="marketing-kicker">' + escapeHtml(tr('marketing.kicker', 'Marketing Integrations')) + '</p>' +
              '<h2>' + escapeHtml(tr('marketing.title', 'Connect advertising data')) + '</h2>' +
              '<p>' + escapeHtml(tr('marketing.subtitle', 'Sync TikTok, Snapchat, and Facebook spend into your existing account calculator. Your operational order metrics stay unchanged.')) + '</p>' +
            '</div>' +
            '<aside class="marketing-security"><strong>' + escapeHtml(tr('marketing.secureTitle', 'Secure connection')) + '</strong><span>' + escapeHtml(tr('marketing.secureBody', 'Authorization and API secrets run through the protected backend, not this dashboard.')) + '</span></aside>' +
          '</header>' +
          '<div class="marketing-platform-grid">' +
            LIVE_PLATFORMS.map(platformCard).join('') +
          '</div>' +
        '</div>';
      bind();
    }

    function setBusy(label, platform) {
      busyLabels[platform || 'tiktok'] = label || '';
      if (store && typeof store.setLoading === 'function') {
        store.setLoading(true, selectedAccountId, platform);
      }
      render();
    }

    function loadStatus(platform) {
      platform = platform || 'tiktok';
      var label = platformLabel(platform);
      if (!shownAccounts.length || !store || typeof store.load !== 'function') return Promise.resolve();
      log('refresh_status:started', { accountId: selectedAccountId, platform: platform });
      setBusy(tr('marketing.loadingStatus', 'Checking ' + label + ' connection...').replace(/\{platform\}/g, label), platform);
      return store.load(selectedAccountId, platform).then(function (result) {
        busyLabels[platform] = '';
        log('refresh_status:finished', {
          platform: platform,
          status: result && result.status,
          error: result && result.error || '',
          linkedAccountCount: result && result.linkedAccountCount || 0
        });
        if (pollTimer && pollPlatform === platform && (!result || result.status === 'connected' || result.status === 'disconnected' || result.error || result.reconnectRequired)) {
          clearInterval(pollTimer);
          pollTimer = null;
          pollPlatform = '';
          log('refresh_status:poll_stopped', { platform: platform, status: result && result.status || '', error: result && result.error || '' });
        }
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

    function platformOfButton(button) {
      var card = button && button.closest ? button.closest('[data-marketing-platform]') : null;
      return card ? (card.getAttribute('data-marketing-platform') || 'tiktok') : (button && (button.getAttribute('data-marketing-save-all') || button.getAttribute('data-marketing-connect') || button.getAttribute('data-marketing-sync') || button.getAttribute('data-marketing-sync-all') || button.getAttribute('data-marketing-refresh')) || 'tiktok');
    }

    function saveMapping(button) {
      var targetId = button.getAttribute('data-marketing-save-map') || '';
      var platform = platformOfButton(button);
      var label = platformLabel(platform);
      var card = button.closest('[data-marketing-platform]');
      var row = (card || mount).querySelector('[data-marketing-map-row="' + CSS.escape(targetId) + '"]');
      var sourceAccounts = sourcesForRow(row);
      if (missingCurrency([{ sourceAccounts: sourceAccounts }])) {
        store.set(Object.assign({}, state(platform), { loading: false, error: tr('marketing.currencyRequired', 'Select a currency for every assigned ' + label + ' account.').replace(/\{platform\}/g, label) }), selectedAccountId, platform);
        render();
        return Promise.resolve();
      }
      log('mapping:save_started', { dashboardAccountId: targetId, platform: platform, selectedCount: sourceAccounts.length });
      setBusy(tr('marketing.loadingSave', 'Saving mapping...'), platform);
      return window.api.saveMarketingMapping(targetId, platform, sourceAccounts).then(function (result) {
        busyLabels[platform] = '';
        log('mapping:save_finished', {
          platform: platform,
          dashboardAccountId: targetId,
          ok: !!(result && result.ok),
          selectedCount: sourceAccounts.length,
          error: result && result.error || ''
        });
        store.set(result && result.ok ? result : Object.assign({}, state(platform), {
          loading: false,
          error: result && result.error || tr('marketing.mappingFailed', 'Unable to save mapping.')
        }), selectedAccountId, platform);
        render();
      });
    }

    function saveAllMappings(platform) {
      platform = platform || 'tiktok';
      var label = platformLabel(platform);
      var card = mount.querySelector('[data-marketing-platform="' + CSS.escape(platform) + '"]');
      var rows = Array.prototype.slice.call((card || mount).querySelectorAll('[data-marketing-map-row]'));
      var payloads = rows.map(function (row) {
        return {
          dashboardAccountId: row.getAttribute('data-marketing-map-row') || '',
          dashboardAccountKey: row.getAttribute('data-marketing-map-key') || '',
          sourceAccounts: sourcesForRow(row)
        };
      }).filter(function (mapping) { return !!mapping.dashboardAccountId; });
      if (missingCurrency(payloads)) {
        store.set(Object.assign({}, state(platform), { loading: false, error: tr('marketing.currencyRequired', 'Select a currency for every assigned ' + label + ' account.').replace(/\{platform\}/g, label) }), selectedAccountId, platform);
        render();
        return Promise.resolve();
      }

      log('mapping:save_all_started', { platform: platform, accountCount: payloads.length });
      setBusy(tr('marketing.loadingSaveAll', 'Saving all mappings...'), platform);
      return window.api.saveAllMarketingMappings(platform, payloads).then(function (result) {
        log('mapping:save_all_finished', { platform: platform, accountCount: payloads.length, ok: !!(result && result.ok), error: result && result.error || '' });
        busyLabels[platform] = '';
        store.set(result && result.ok ? result : Object.assign({}, state(platform), result || {}, {
          loading: false,
          error: result && result.error || tr('marketing.mappingFailed', 'Unable to save mapping.')
        }), selectedAccountId, platform);
        render();
      }).catch(function (error) {
        busyLabels[platform] = '';
        log('mapping:save_all_finished', { platform: platform, accountCount: payloads.length, ok: false, error: error.message || String(error) });
        store.set(Object.assign({}, state(platform), {
          loading: false,
          error: error.message || tr('marketing.mappingFailed', 'Unable to save mapping.')
        }), selectedAccountId, platform);
        render();
      });
    }

    function bind() {
      var connectButtons = mount.querySelectorAll('[data-marketing-connect]');
      var syncButtons = mount.querySelectorAll('[data-marketing-sync]');
      var syncAllButtons = mount.querySelectorAll('[data-marketing-sync-all]');
      var refreshButtons = mount.querySelectorAll('[data-marketing-refresh]');
      var saveAllButtons = mount.querySelectorAll('[data-marketing-save-all]');
      var saveButtons = mount.querySelectorAll('[data-marketing-save-map]');

      Array.prototype.forEach.call(connectButtons, function (connectButton) {
        connectButton.addEventListener('click', function () {
          var platform = platformOfButton(connectButton);
          log('button:connect', { accountId: selectedAccountId, platform: platform });
          connectButton.disabled = true;
          connectButton.textContent = tr('marketing.loadingConnect', 'Connecting securely...');
          setBusy(tr('marketing.loadingConnect', 'Connecting securely...'), platform);
          window.api.connectMarketing(selectedAccountId, platform).then(function (result) {
            busyLabels[platform] = '';
            log('connect:finished', result || {});
            store.set(result, selectedAccountId, platform);
            render();
            if (result && result.authorizationUrl && typeof window.api.openExternalUrl === 'function') {
              window.api.openExternalUrl(result.authorizationUrl);
              if (pollTimer) clearInterval(pollTimer);
              pollPlatform = platform;
              pollTimer = setInterval(function () { loadStatus(platform); }, 5000);
            }
          });
        });
      });

      Array.prototype.forEach.call(saveButtons, function (button) {
        button.addEventListener('click', function () {
          saveMapping(button);
        });
      });

      function applyDraftLocks() {
        Array.prototype.forEach.call(mount.querySelectorAll('[data-marketing-platform]'), function (card) {
          var platform = card.getAttribute('data-marketing-platform') || 'tiktok';
          var owners = {};
          var persistedMappings = state(platform).mappings || {};
          Object.keys(persistedMappings).forEach(function (ownerId) {
            (Array.isArray(persistedMappings[ownerId]) ? persistedMappings[ownerId] : []).forEach(function (source) {
              var sourceId = String(source && source.id || '');
              if (sourceId && !owners[sourceId]) owners[sourceId] = ownerId;
            });
          });
          Array.prototype.forEach.call(card.querySelectorAll('[data-marketing-map-row]'), function (row) {
            var ownerId = row.getAttribute('data-marketing-map-row') || '';
            Array.prototype.forEach.call(row.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]:checked'), function (input) {
              if (!owners[input.value]) owners[input.value] = ownerId;
            });
          });
          Array.prototype.forEach.call(card.querySelectorAll('[data-marketing-map-row]'), function (row) {
            var ownerId = row.getAttribute('data-marketing-map-row') || '';
            var ownerAccount = shownAccounts.concat(khodAccounts).filter(function (account) {
              return accountOwnsMappingKey(account, ownerId);
            })[0] || ownerId;
            var max = Number(row.getAttribute('data-marketing-limit-max') || 2) || 2;
            var checkedCount = row.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]:checked').length;
            var limitReached = checkedCount >= max;
            var pill = row.querySelector('[data-marketing-limit-pill]');
            if (pill) {
              pill.textContent = tr('marketing.limitCompact', '{used} / {max} used')
                .replace(/\{used\}/g, checkedCount)
                .replace(/\{max\}/g, max)
                .replace(/\{platform\}/g, platformLabel(platform));
              pill.classList.toggle('is-at-limit', checkedCount >= max);
              pill.classList.toggle('is-over-limit', checkedCount > max);
            }
            Array.prototype.forEach.call(row.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]'), function (input) {
              var locked = !!owners[input.value] && !accountOwnsMappingKey(ownerAccount, owners[input.value]);
              input.disabled = locked || (!input.checked && limitReached);
              var currencySelect = row.querySelector('[data-source-currency="' + CSS.escape(input.value) + '"]');
              if (currencySelect) currencySelect.disabled = locked || (!input.checked && limitReached) || currencySelect.getAttribute('data-detected-currency') === '1';
            });
          });
        });
      }

      Array.prototype.forEach.call(mount.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]'), function (input) {
        input.addEventListener('change', function () {
          var row = input.closest('[data-marketing-map-row]');
          var rowPlatform = platformOfButton(input);
          var max = Number(row && row.getAttribute('data-marketing-limit-max') || 2) || 2;
          var selectedCount = row ? row.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]:checked').length : 0;
          if (input.checked && selectedCount > max) {
            input.checked = false;
            store.set(Object.assign({}, state(rowPlatform), {
              loading: false,
              error: tr('marketing.limitExceeded', 'This account can use up to {max} {platform} ad accounts. You selected {selected}. Contact support to increase the limit.')
                .replace(/\{platform\}/g, platformLabel(rowPlatform))
                .replace(/\{max\}/g, max)
                .replace(/\{selected\}/g, selectedCount)
            }), selectedAccountId, rowPlatform);
            render();
            return;
          }
          if (input.checked) {
            Array.prototype.forEach.call(mount.querySelectorAll('.marketing-mapping-choice input[type="checkbox"]'), function (other) {
              if (other !== input && other.value === input.value && platformOfButton(other) === platformOfButton(input)) other.checked = false;
            });
          }
          applyDraftLocks();
        });
      });
      applyDraftLocks();

      Array.prototype.forEach.call(saveAllButtons, function (saveAllButton) {
        saveAllButton.addEventListener('click', function () {
          saveAllMappings(platformOfButton(saveAllButton));
        });
      });

      Array.prototype.forEach.call(syncButtons, function (syncButton) {
        syncButton.addEventListener('click', function () {
          var platform = platformOfButton(syncButton);
          log('button:sync', { accountId: selectedAccountId, platform: platform });
          setBusy(tr('marketing.loadingSync', 'Syncing marketing data...'), platform);
          var period = fullData && fullData.meta && fullData.meta.period || {};
          var roi = window.DashboardRoiState ? window.DashboardRoiState.get(selectedAccountId, {}) : {};
          var syncPayload = {
            dateFrom: period.from || period.dateFrom || period.start || '',
            dateTo: period.to || period.dateTo || period.end || '',
            targetCurrency: 'SAR',
            egpRate: roi.egpRate || 52
          };
          var syncRequest = store && typeof store.sync === 'function'
            ? store.sync(selectedAccountId, syncPayload, platform)
            : window.api.syncMarketingData(selectedAccountId, platform, syncPayload);
          syncRequest.then(function (result) {
            busyLabels[platform] = '';
            log('sync:finished', result || {});
            if (!store || typeof store.sync !== 'function') store.set(result, selectedAccountId, platform);
            render();
            if (result && result.ok && window.DashboardRoiState && typeof window.DashboardRoiState.notify === 'function') {
              window.DashboardRoiState.notify();
            }
          });
        });
      });

      Array.prototype.forEach.call(syncAllButtons, function (syncAllButton) {
        syncAllButton.addEventListener('click', function () {
          var platform = platformOfButton(syncAllButton);
          var period = fullData && fullData.meta && fullData.meta.period || {};
          var accountSettings = khodAccounts.map(function (account) {
            var roi = window.DashboardRoiState ? window.DashboardRoiState.get(account.id, {}) : {};
            return { dashboardAccountId: account.id, dashboardAccountKey: account.key, dashboardAccountKeys: account.keys || [account.key], currency: 'SAR', egpRate: roi.egpRate || 52 };
          });
          var currentMappings = state(platform).mappings || {};
          var mappings = khodAccounts.map(function (account) {
            var sourceAccounts = [];
            (account.keys || [account.key]).some(function (key) {
              if (!Array.isArray(currentMappings[key])) return false;
              sourceAccounts = currentMappings[key];
              return true;
            });
            return {
              dashboardAccountId: account.id,
              dashboardAccountKey: account.key,
              sourceAccounts: sourceAccounts
            };
          }).filter(function (mapping) { return mapping.sourceAccounts.length; });
          log('button:sync_all', { platform: platform, accountCount: accountSettings.length });
          setBusy(tr('marketing.loadingSyncAll', 'Syncing all accounts...'), platform);
          window.api.syncAllMarketingData(platform, {
            dateFrom: period.from || period.dateFrom || period.start || '',
            dateTo: period.to || period.dateTo || period.end || '',
            accountSettings: accountSettings,
            mappings: mappings
          }).then(function (result) {
            busyLabels[platform] = '';
            log('sync_all:finished', result || {});
            if (result && result.ok && result.accountStatuses) {
              Object.keys(result.accountStatuses).forEach(function (accountId) {
                store.set(result.accountStatuses[accountId], accountId, platform);
              });
            }
            store.set(result, selectedAccountId, platform);
            render();
          });
        });
      });

      Array.prototype.forEach.call(refreshButtons, function (refreshButton) {
        refreshButton.addEventListener('click', function () {
          var platform = platformOfButton(refreshButton);
          log('button:refresh', { accountId: selectedAccountId, platform: platform, status: state(platform).status });
          loadStatus(platform);
        });
      });
    }

    log('section:mounted', { accountId: selectedAccountId, allMode: allMode, shownAccounts: shownAccounts.length });
    render();
    LIVE_PLATFORMS.forEach(function (platform) { loadStatus(platform.id); });

    return function cleanupMarketingConnections() {
      if (pollTimer) clearInterval(pollTimer);
      pollPlatform = '';
    };
  };
})();
