(function () {
  "use strict";

  let memory = {
    currentProduct: null,
    currentCity: null,
    currentIntent: null,
    currentTimeframe: null,
    pendingMissingInputs: null,
    knownInputs: {
      accountSpend: null,
      productSpend: {},
      currency: null
    },
    lastStrategicQuestion: null,
    assistantWorkflow: null
  };

  function update(parsedIntent) {
    if (!parsedIntent) return;
    if (parsedIntent.entities.products && parsedIntent.entities.products.length > 0) {
      memory.currentProduct = parsedIntent.entities.products[0];
    }
    if (parsedIntent.entities.cities && parsedIntent.entities.cities.length > 0) {
      memory.currentCity = parsedIntent.entities.cities[0];
    }
    memory.currentIntent = parsedIntent.intent;
    memory.lastStrategicQuestion = parsedIntent.rawText || memory.lastStrategicQuestion;
    if (parsedIntent.entities && parsedIntent.entities.dates && parsedIntent.entities.dates.length) {
      memory.currentTimeframe = parsedIntent.entities.dates[0];
    }
  }

  function get() {
    return memory;
  }

  function setPending(pending) {
    memory.pendingMissingInputs = pending || null;
  }

  function clearPending() {
    memory.pendingMissingInputs = null;
  }

  function rememberInput(scope, key, value) {
    if (!scope || !key) return;
    if (scope === "productSpend") {
      memory.knownInputs.productSpend[key] = value;
      return;
    }
    memory.knownInputs[key] = value;
  }

  function setWorkflow(workflow) {
    memory.assistantWorkflow = workflow || null;
  }

  function clear() {
    memory = {
      currentProduct: null,
      currentCity: null,
      currentIntent: null,
      currentTimeframe: null,
      pendingMissingInputs: null,
      knownInputs: {
        accountSpend: null,
        productSpend: {},
        currency: null
      },
      lastStrategicQuestion: null,
      assistantWorkflow: null
    };
  }

  window.KhodAiSessionMemory = {
    update,
    get,
    setPending,
    clearPending,
    rememberInput,
    setWorkflow,
    clear
  };

})();
