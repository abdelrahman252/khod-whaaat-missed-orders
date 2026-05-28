(function () {
  'use strict';

  // Make sure KHOD_LOCALES is initialized by the time this runs
  window.KHOD_LOCALES = window.KHOD_LOCALES || {};

  function getVal(obj, path, args) {
    var parts = path.split('.');
    var val = obj;
    for (var i = 0; i < parts.length; i++) {
      if (val == null) return null;
      val = val[parts[i]];
    }
    if (val == null) return null;

    if (typeof val === 'string' && args) {
      for (var key in args) {
        val = val.replace(new RegExp('\\{' + key + '\\}', 'g'), args[key]);
      }
    }
    return val;
  }

  function translate(namespace, key, args) {
    var lang = window._kbotLang || 'ar'; // fallback to ar
    var langDict = window.KHOD_LOCALES[lang];
    if (!langDict) return key;

    var nsDict = langDict[namespace];
    if (!nsDict) return key;

    var result = getVal(nsDict, key, args);
    if (result != null) return result;
    if (args && args.default != null) return args.default;
    return key;
  }

  window.t_anl = function(key, args) {
    return translate('analytics', key, args);
  };

  window.t_ops = function(key, args) {
    return translate('operations', key, args);
  };

})();
