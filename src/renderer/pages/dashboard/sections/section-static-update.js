(function () {
  'use strict';

  var state = window.StaticDashboardUpdateState || {
    accounts: {},
    periodKey: '',
    results: [],
    busy: false
  };
  window.StaticDashboardUpdateState = state;

  function tr(key, params) {
    return window.dashboardI18n ? window.dashboardI18n.t(key, params) : key;
  }

  function esc(value) {
    if (window.KhodUI && typeof window.KhodUI.esc === 'function') return window.KhodUI.esc(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function period() {
    var selected = window.DashboardPeriodState && window.DashboardPeriodState.get
      ? window.DashboardPeriodState.get()
      : {};
    return {
      dateFrom: selected.dateFrom || selected.from || selected.start || '',
      dateTo: selected.dateTo || selected.to || selected.end || ''
    };
  }

  function accountLabel(account) {
    return String(account && (
      account.label || account.name || account.memberName || account.khodEmail ||
      account.email || account.id
    ) || tr('shell.account'));
  }

  function visibleAccounts(data) {
    var meta = data && data.meta || {};
    var activeId = String(meta.activeAccountId || (window.getActiveAccountId && window.getActiveAccountId()) || '__all__');
    var source = Array.isArray(meta.accountOptions) ? meta.accountOptions : (window.dashboardAccountsList || []);
    var seen = {};
    var accounts = source.map(function (account) {
      var id = String(account && (account.id || account.value) || '');
      if (!id || id === '__all__' || seen[id]) return null;
      seen[id] = true;
      return Object.assign({}, account, { id: id });
    }).filter(Boolean);

    if (!accounts.length && Array.isArray(window._kbotAccounts)) {
      accounts = window._kbotAccounts.map(function (account) {
        return account && account.id ? Object.assign({}, account, { id: String(account.id) }) : null;
      }).filter(Boolean);
    }
    if (activeId !== '__all__') {
      var selected = accounts.filter(function (account) { return account.id === activeId; });
      return selected.length ? selected : [{ id: activeId, label: meta.activeAccountLabel || activeId }];
    }
    return accounts;
  }

  function accountState(id) {
    if (!state.accounts[id]) {
      state.accounts[id] = { fileName: '', buffer: null, inspect: null, error: '', status: 'idle' };
    }
    return state.accounts[id];
  }

  function payloadFor(accountId, allowSuspiciousReplacement) {
    var selected = period();
    var item = accountState(accountId);
    return {
      accountId: accountId,
      dateFrom: selected.dateFrom,
      dateTo: selected.dateTo,
      khodBuffer: item.buffer,
      allowSuspiciousReplacement: allowSuspiciousReplacement === true
    };
  }

  function readFile(file) {
    return file.arrayBuffer().then(function (buffer) { return new Uint8Array(buffer); });
  }

  function statusText(item) {
    if (item.status === 'inspecting') return tr('static.inspecting');
    if (item.error) return item.error;
    if (item.inspect && item.inspect.ok) {
      var warning = item.inspect.warnings && item.inspect.warnings[0];
      return tr('static.rows', { count: item.inspect.parsedRows || 0 }) +
        (warning ? ' - ' + tr('static.outsideIgnored', { count: warning.count || 0 }) : '');
    }
    if (item.fileName) return tr('static.choose');
    return tr('static.missing');
  }

  function statusClass(item) {
    if (item.error) return 'is-error';
    if (item.status === 'inspecting') return 'is-working';
    if (item.inspect && item.inspect.ok) {
      return item.inspect.requiresConfirmation || (item.inspect.warnings && item.inspect.warnings.length) ? 'is-warning' : 'is-ready';
    }
    return '';
  }

  function renderCard(account) {
    var item = accountState(account.id);
    var identity = account.email || account.khodEmail || account.memberName || '';
    var ready = item.inspect && item.inspect.ok;
    return '<article class="static-update-card" data-account-id="' + esc(account.id) + '">' +
      '<div class="static-update-account">' +
        '<div><strong>' + esc(accountLabel(account)) + '</strong>' +
          (identity ? '<span>' + esc(identity) + '</span>' : '') +
        '</div>' +
        '<span class="static-update-badge ' + (ready ? 'is-ready' : '') + '">' +
          (ready ? tr('static.ready') : tr('static.required')) +
        '</span>' +
      '</div>' +
      '<label class="static-update-upload ' + statusClass(item) + '">' +
        '<input type="file" data-static-file="' + esc(account.id) + '" accept=".xlsx,.xls,.csv" ' + (state.busy ? 'disabled' : '') + '>' +
        '<span class="static-update-upload-icon">' + (window.icon ? window.icon('upload', { size: 22, color: 'currentColor' }) : '') + '</span>' +
        '<span class="static-update-upload-copy">' +
          '<strong>' + tr('static.khodSheet') + '</strong>' +
          '<span class="static-update-file-name">' + esc(item.fileName || tr('static.choose')) + '</span>' +
          '<small>' + esc(statusText(item)) + '</small>' +
        '</span>' +
        '<span class="static-update-upload-action">' + (item.fileName ? tr('static.replace') : tr('static.choose')) + '</span>' +
      '</label>' +
    '</article>';
  }

  function renderResults(accounts) {
    if (!state.results.length) return '';
    var labels = {};
    accounts.forEach(function (account) { labels[account.id] = accountLabel(account); });
    return '<section class="static-update-results">' +
      '<h3>' + tr('static.summaryTitle') + '</h3>' +
      state.results.map(function (result) {
        var className = result.status === 'success' ? 'is-success' : result.status === 'skipped' ? 'is-skipped' : 'is-failure';
        var text = result.status === 'success'
          ? tr('static.success', { count: result.count || 0 }) +
            (result.warnings && result.warnings.length ? ' - ' + tr('static.warningCount', { count: result.warnings.length }) : '')
          : result.status === 'skipped'
            ? (result.message || tr('static.skipped'))
            : tr('static.failed', { error: result.error || tr('static.notSaved') });
        return '<div class="static-update-result ' + className + '"><strong>' +
          esc(labels[result.accountId] || result.accountId) + '</strong><span>' + esc(text) + '</span></div>';
      }).join('') +
    '</section>';
  }

  function confirmReplacement(risky, accounts) {
    var labels = {};
    accounts.forEach(function (account) { labels[account.id] = accountLabel(account); });
    var details = risky.map(function (item) {
      var validation = item.validation || {};
      return (labels[item.accountId] || item.accountId) + ': ' +
        (validation.existingRows || 0) + ' -> ' + (validation.incomingRows || 0);
    }).join('\n');
    var options = {
      title: tr('static.confirmTitle'),
      message: tr('static.confirmBody', { details: details }),
      confirmText: tr('static.confirmAction'),
      cancelText: tr('static.cancel'),
      danger: true
    };
    if (window.KhodUI && typeof window.KhodUI.confirm === 'function') return window.KhodUI.confirm(options);
    return Promise.resolve(window.confirm(options.message));
  }

  window.renderSectionStaticUpdate = function renderSectionStaticUpdate(mount, data, ctx) {
    var fullData = ctx && ctx.data ? ctx.data : data || {};
    var accounts = visibleAccounts(fullData);
    var selected = period();
    var nextPeriodKey = selected.dateFrom + '|' + selected.dateTo;
    var needsInspection = [];
    if (state.periodKey !== nextPeriodKey) {
      state.periodKey = nextPeriodKey;
      Object.keys(state.accounts).forEach(function (id) {
        var item = accountState(id);
        if (!item.buffer) return;
        item.inspect = null;
        item.error = '';
        item.status = 'idle';
        needsInspection.push(id);
      });
      state.results = [];
    }

    function render() {
      var readyCount = accounts.filter(function (account) {
        var item = accountState(account.id);
        return item.inspect && item.inspect.ok;
      }).length;
      mount.innerHTML =
        '<div class="static-update-section">' +
          '<div class="static-update-hero">' +
            '<div><span class="static-update-kicker">' + tr('static.kicker') + '</span>' +
              '<h2>' + tr('static.title') + '</h2><p>' + tr('static.subtitle') + '</p></div>' +
            '<div class="static-update-period"><span>' + tr('static.period') + '</span><strong>' +
              esc(selected.dateFrom || '--') + ' - ' + esc(selected.dateTo || '--') +
              '</strong><small>' + tr('static.periodNote') + '</small></div>' +
          '</div>' +
          '<div class="static-update-grid">' + accounts.map(renderCard).join('') + '</div>' +
          (!accounts.length ? '<div class="static-update-empty">' + tr('shell.noDataTitle') + '</div>' : '') +
          '<div class="static-update-actions">' +
            '<span>' + (readyCount ? tr('static.readyAccounts', { count: readyCount }) : tr('static.noneReady')) + '</span>' +
            '<button type="button" class="dash-update-btn" id="static-update-submit" ' +
              (!readyCount || state.busy ? 'disabled' : '') + '>' +
              (state.busy ? tr('static.updating') : tr('static.update')) +
            '</button>' +
          '</div>' +
          renderResults(accounts) +
        '</div>';
      bind();
      if (window.KhodUI) window.KhodUI.enhance(mount);
    }

    function inspectAccount(accountId) {
      var item = accountState(accountId);
      if (!item.buffer || !window.api || typeof window.api.inspectStaticDashboardUpdate !== 'function') return Promise.resolve(null);
      item.status = 'inspecting';
      item.error = '';
      item.inspect = null;
      render();
      return window.api.inspectStaticDashboardUpdate(payloadFor(accountId, false)).then(function (result) {
        item.status = 'idle';
        item.inspect = result && result.ok ? result : null;
        item.error = result && result.ok ? '' : (result && result.error || 'Sheet validation failed.');
        render();
        return result;
      }).catch(function (error) {
        item.status = 'idle';
        item.inspect = null;
        item.error = error && error.message ? error.message : String(error);
        render();
        return null;
      });
    }

    function bind() {
      Array.prototype.forEach.call(mount.querySelectorAll('[data-static-file]'), function (input) {
        input.addEventListener('change', function () {
          var file = input.files && input.files[0];
          var accountId = input.getAttribute('data-static-file');
          if (!file || !accountId) return;
          var item = accountState(accountId);
          item.fileName = file.name;
          item.inspect = null;
          item.error = '';
          item.status = 'inspecting';
          render();
          readFile(file).then(function (buffer) {
            item.buffer = buffer;
            return inspectAccount(accountId);
          }).catch(function (error) {
            item.status = 'idle';
            item.error = error && error.message ? error.message : String(error);
            render();
          });
        });
      });

      var submit = mount.querySelector('#static-update-submit');
      if (submit) submit.addEventListener('click', applyReadyAccounts);
    }

    function applyReadyAccounts() {
      if (state.busy) return;
      var ready = accounts.filter(function (account) { return !!accountState(account.id).buffer; });
      if (!ready.length) return;
      state.busy = true;
      state.results = [];
      render();

      Promise.all(ready.map(function (account) {
        return window.api.inspectStaticDashboardUpdate(payloadFor(account.id, false)).then(function (result) {
          return { account: account, result: result };
        }).catch(function (error) {
          return { account: account, result: { ok: false, error: error && error.message ? error.message : String(error) } };
        });
      })).then(function (inspections) {
        var valid = inspections.filter(function (entry) { return entry.result && entry.result.ok; });
        var risky = valid.filter(function (entry) { return entry.result.requiresConfirmation; }).map(function (entry) { return entry.result; });
        var invalidResults = inspections.filter(function (entry) { return !entry.result || !entry.result.ok; }).map(function (entry) {
          return { accountId: entry.account.id, status: 'failure', error: entry.result && entry.result.error || 'Sheet validation failed.' };
        });
        return (risky.length ? confirmReplacement(risky, accounts) : Promise.resolve(true)).then(function (confirmed) {
          var allowed = valid.filter(function (entry) { return confirmed || !entry.result.requiresConfirmation; });
          var canceled = valid.filter(function (entry) { return !confirmed && entry.result.requiresConfirmation; }).map(function (entry) {
            return { accountId: entry.account.id, status: 'skipped', message: tr('static.notSaved') };
          });
          return Promise.all(allowed.map(function (entry) {
            return window.api.applyStaticDashboardUpdate(payloadFor(entry.account.id, confirmed && entry.result.requiresConfirmation)).then(function (result) {
              if (result && result.ok && result.saved) {
                return { accountId: entry.account.id, status: 'success', count: result.parsedRows || 0, warnings: result.warnings || [] };
              }
              return { accountId: entry.account.id, status: 'failure', error: result && result.error || tr('static.notSaved') };
            }).catch(function (error) {
              return { accountId: entry.account.id, status: 'failure', error: error && error.message ? error.message : String(error) };
            });
          })).then(function (applied) {
            var uploaded = {};
            ready.forEach(function (account) { uploaded[account.id] = true; });
            var missing = accounts.filter(function (account) { return !uploaded[account.id]; }).map(function (account) {
              return { accountId: account.id, status: 'skipped', message: tr('static.skipped') };
            });
            return invalidResults.concat(canceled, applied, missing);
          });
        });
      }).then(function (results) {
        state.results = results;
        state.busy = false;
        render();
        var succeeded = results.some(function (result) { return result.status === 'success'; });
        if (succeeded && ctx && ctx.options && typeof ctx.options.onStaticUpdateComplete === 'function') {
          ctx.options.onStaticUpdateComplete();
        }
      }).catch(function (error) {
        state.results = [{ accountId: '', status: 'failure', error: error && error.message ? error.message : String(error) }];
        state.busy = false;
        render();
      });
    }

    render();
    needsInspection.forEach(function (accountId) { inspectAccount(accountId); });
  };
})();
