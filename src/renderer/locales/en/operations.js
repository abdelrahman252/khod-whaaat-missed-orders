(function () {
  'use strict';
  window.KHOD_LOCALES = window.KHOD_LOCALES || {};
  window.KHOD_LOCALES.en = window.KHOD_LOCALES.en || {};
  window.KHOD_LOCALES.en.operations = {
    liveMonitor: {
      title: "Live Execution Monitor",
      live: "LIVE",
      status: "Status",
      idle: "Idle",
      running: "Running",
      runtime: "Runtime",
      ordersSubmitted: "Orders Submitted",
      failedOrders: "Failed Orders",
      currentAccount: "Current Account",
      currentOrder: "Current Order",
      progress: "Progress",
      activityFeed: "Live Activity Feed",
      clear: "Clear",
      waiting: "Waiting for bot activity...",
      viewLog: "View Full Live Log",
      vsLast15m: "vs last 15m",
      feed: {
        orderFailed: "Order #{order} failed: {error}",
        orderSubmitted: "Order #{order} submitted",
        runCompleted: "Run completed"
      }
    },
    history: {
      title: "Run History",
      total: "total",
      prev: "Prev",
      next: "Next",
      empty: "No runs yet. Run the bot to see history.",
      multiAccount: "Multi-account run",
      failed: "Failed",
      completed: "Completed",
      ordersCount: "orders"
    },
    insights: {
      title: "Run Smart Insights",
      subtitle: "Calculated from your run history",
      empty: "Run the bot a few times to generate insights.",
      cardLabel: "Insight {index}",
      actions: {
        viewProducts: "View Products",
        viewDetails: "View Details"
      },
      trend: "Orders <strong>{trend} by {pct}%</strong> compared to the previous 7 days. {extra}",
      increased: "increased",
      decreased: "decreased",
      goodJob: "Good job! Keep it up.",
      failedCity: "Failed orders in <strong>{city}</strong> account for <strong>{pct}%</strong> of all failures. {count} failed orders detected.",
      bestProduct: "Best selling product this week: <strong>{product}</strong> with {count} orders.",
      productSpread: "<strong>{count} products</strong> appeared in this run history. Top demand is still <strong>{top}</strong>.",
      tipTime: "Tip: Consider running more accounts between <strong>{start}–{end}</strong>. This is your highest performance window.",
      pendingCod: "Total COD pending: <strong>{amount}</strong> across {count} orders.",
      topAccount: "Top account by volume is <strong>{account}</strong> with {count} orders.",
      deliveryRate: "Delivered rate is <strong>{pct}%</strong> with {count} delivered orders.",
      avgRunVolume: "Average run volume is <strong>{avg} orders</strong> across {runs} runs.",
      failedRate: "Failed rate is <strong>{pct}%</strong> with {count} failed orders."
    },
    accountPerf: {
      title: "Account Performance",
      sortOrders: "By Orders",
      sortRevenue: "By Revenue",
      empty: "No account data yet.",
      ordersCount: "orders"
    },
    productPerf: {
      title: "Product Performance",
      detailed: "Detailed",
      products: "products",
      allAccounts: "All Accounts",
      searchPlaceholder: "Search product...",
      clearSort: "Clear Sort",
      empty: "No product data yet.",
      pageOf: "Page {current} of {total}",
      footnote: "Delivered % = Delivered / Total  ·  Failed % = Failed / Total",
      cols: {
        product: "Product",
        orders: "Orders",
        revenue: "Revenue (SAR)",
        deliveredPct: "Delivered %",
        failedPct: "Failed %",
        performance: "Performance"
      }
    },
    utils: {
      time: {
        justNow: "just now",
        mAgo: "{m}m ago",
        hAgo: "{h}h ago",
        dAgo: "{d}d ago"
      }
    },
    orderDetails: {
      title: "Order Details",
      backToOrders: "← Back to Orders",
      empty: "Select a run from History to view order details",
      emptyTitle: "Select a run with orders",
      emptyBody: "To see order details, select a Run History item that has submitted orders.",
      emptyAction: "Go to Run History",
      orderOf: "Order {current} of {total}",
      unknown: "Unknown",
      searchPlaceholder: "Search name or phone...",
      amountToCollect: "Amount to Collect",
      orderValue: "Order Value",
      orderDate: "Order Date",
      city: "City",
      tabOverview: "Overview",
      tabCustomer: "Customer Info",
      tabHistory: "History & Attempts",
      tabNotes: "Notes",
      noNotes: "No notes for this run.",
      noOrderData: "No order data.",
      noCustomerData: "No customer data.",
      timelineTitle: "Timeline",
      fields: {
        recipientName: "Recipient Name",
        phone1: "Phone 1",
        phone2: "Phone 2",
        cityArea: "City / Area",
        address: "Address",
        account: "Account (Data Entry)",
        productName: "Product Name",
        sku: "SKU",
        name: "Name",
        phone: "Phone",
        region: "Region",
        runId: "Run ID",
        runTime: "Run Time",
        submitted: "Submitted",
        failed: "Failed"
      },
      timelineSteps: {
        botStarted: "Bot Started",
        processingOrder: "Processing Order",
        failed: "Failed",
        delivered: "Delivered",
        pending: "Pending"
      }
    }
  };
})();
