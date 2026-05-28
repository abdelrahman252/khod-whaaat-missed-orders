(function () {
  'use strict';
  window.KHOD_LOCALES = window.KHOD_LOCALES || {};
  window.KHOD_LOCALES.ar = window.KHOD_LOCALES.ar || {};
  window.KHOD_LOCALES.ar.operations = {
    liveMonitor: {
      title: "مراقب التنفيذ المباشر",
      live: "مباشر",
      status: "الحالة",
      idle: "خامل",
      running: "قيد التشغيل",
      runtime: "وقت التشغيل",
      ordersSubmitted: "الطلبات المرسلة",
      failedOrders: "الطلبات الفاشلة",
      currentAccount: "الحساب الحالي",
      currentOrder: "الطلب الحالي",
      progress: "التقدم",
      activityFeed: "سجل النشاط المباشر",
      clear: "مسح",
      waiting: "في انتظار نشاط الروبوت...",
      viewLog: "عرض السجل المباشر بالكامل",
      vsLast15m: "مقابل آخر 15 دقيقة",
      feed: {
        orderFailed: "فشل الطلب #{order}: {error}",
        orderSubmitted: "تم إرسال الطلب #{order}",
        runCompleted: "اكتمل التشغيل"
      }
    },
    history: {
      title: "سجل التشغيل",
      total: "إجمالي",
      prev: "السابق",
      next: "التالي",
      empty: "لا توجد عمليات تشغيل بعد. قم بتشغيل الروبوت لرؤية السجل.",
      multiAccount: "تشغيل متعدد الحسابات",
      failed: "فشل",
      completed: "مكتمل",
      ordersCount: "طلبات"
    },
    insights: {
      title: "رؤى التشغيل الذكية",
      subtitle: "محسوبة من سجل التشغيل الخاص بك",
      empty: "قم بتشغيل الروبوت عدة مرات لإنشاء رؤى.",
      cardLabel: "رؤية {index}",
      actions: {
        viewProducts: "عرض المنتجات",
        viewDetails: "عرض التفاصيل"
      },
      trend: "الطلبات <strong>{trend} بنسبة {pct}%</strong> مقارنة بالأيام السبعة الماضية. {extra}",
      increased: "زادت",
      decreased: "انخفضت",
      goodJob: "عمل جيد! استمر.",
      failedCity: "الطلبات الفاشلة في <strong>{city}</strong> تمثل <strong>{pct}%</strong> من جميع الإخفاقات. تم اكتشاف {count} طلبات فاشلة.",
      bestProduct: "المنتج الأفضل مبيعًا هذا الأسبوع: <strong>{product}</strong> بعدد {count} طلبات.",
      productSpread: "ظهر <strong>{count} منتج</strong> في سجل التشغيل. أعلى طلب ما زال على <strong>{top}</strong>.",
      tipTime: "نصيحة: فكر في تشغيل المزيد من الحسابات بين <strong>{start}–{end}</strong>. هذه هي نافذة الأداء الأعلى لديك.",
      pendingCod: "إجمالي الدفع عند الاستلام المعلق: <strong>{amount}</strong> عبر {count} طلبات.",
      topAccount: "أعلى حساب من حيث الحجم هو <strong>{account}</strong> بعدد {count} طلبات.",
      deliveryRate: "نسبة التوصيل <strong>{pct}%</strong> مع {count} طلبات موصلة.",
      avgRunVolume: "متوسط حجم التشغيل <strong>{avg} طلب</strong> عبر {runs} تشغيلات.",
      failedRate: "نسبة الفشل <strong>{pct}%</strong> مع {count} طلبات فاشلة."
    },
    accountPerf: {
      title: "أداء الحساب",
      sortOrders: "حسب الطلبات",
      sortRevenue: "حسب الإيرادات",
      empty: "لا توجد بيانات حساب بعد.",
      ordersCount: "طلبات"
    },
    productPerf: {
      title: "أداء المنتج",
      detailed: "مفصل",
      products: "منتجات",
      allAccounts: "كل الحسابات",
      searchPlaceholder: "ابحث عن منتج...",
      clearSort: "مسح الترتيب",
      empty: "لا توجد بيانات منتج بعد.",
      pageOf: "صفحة {current} من {total}",
      footnote: "نسبة التوصيل = التوصيل / الإجمالي  ·  نسبة الفشل = الفشل / الإجمالي",
      cols: {
        product: "المنتج",
        orders: "الطلبات",
        revenue: "الإيرادات (ر.س)",
        deliveredPct: "نسبة التوصيل",
        failedPct: "نسبة الفشل",
        performance: "الأداء"
      }
    },
    utils: {
      time: {
        justNow: "الآن",
        mAgo: "قبل {m} دقيقة",
        hAgo: "قبل {h} ساعة",
        dAgo: "قبل {d} يوم"
      }
    },
    orderDetails: {
      title: "تفاصيل الطلب",
      backToOrders: "← العودة للطلبات",
      empty: "حدد تشغيلاً من السجل لعرض تفاصيل الطلب",
      emptyTitle: "اختر تشغيلاً يحتوي على طلبات",
      emptyBody: "لعرض تفاصيل الطلب، اختر عنصراً من سجل التشغيل يحتوي على طلبات مرسلة.",
      emptyAction: "اذهب إلى سجل التشغيل",
      orderOf: "الطلب {current} من {total}",
      unknown: "غير معروف",
      searchPlaceholder: "ابحث بالاسم أو الهاتف...",
      amountToCollect: "المبلغ المراد تحصيله",
      orderValue: "قيمة الطلب",
      orderDate: "تاريخ الطلب",
      city: "المدينة",
      tabOverview: "نظرة عامة",
      tabCustomer: "بيانات العميل",
      tabHistory: "السجل والمحاولات",
      tabNotes: "ملاحظات",
      noNotes: "لا توجد ملاحظات لهذا التشغيل.",
      noOrderData: "لا توجد بيانات للطلب.",
      noCustomerData: "لا توجد بيانات للعميل.",
      timelineTitle: "الخط الزمني",
      fields: {
        recipientName: "اسم المستلم",
        phone1: "هاتف 1",
        phone2: "هاتف 2",
        cityArea: "المدينة / المنطقة",
        address: "العنوان",
        account: "الحساب (مدخل البيانات)",
        productName: "اسم المنتج",
        sku: "رمز المنتج",
        name: "الاسم",
        phone: "الهاتف",
        region: "المنطقة",
        runId: "معرف التشغيل",
        runTime: "وقت التشغيل",
        submitted: "تم الإرسال",
        failed: "فشل"
      },
      timelineSteps: {
        botStarted: "بدأ الروبوت",
        processingOrder: "معالجة الطلب",
        failed: "فشل",
        delivered: "تم التوصيل",
        pending: "قيد الانتظار"
      }
    }
  };
})();
