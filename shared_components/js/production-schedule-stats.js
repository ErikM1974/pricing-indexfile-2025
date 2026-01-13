/**
 * Production Schedule Statistics
 * DTG: 194 actual completion records (Jan-Sep 2025)
 * Transfers/DTF: 389 actual completion records (Jan 2024 - Nov 2025)
 * Embroidery: 1,789 actual completion records (Jan 2024 - Sep 2025)
 * Cap Embroidery: 1,454 actual completion records (Jan 2020 - Nov 2025)
 * Screenprint: 805 actual completion records (Jan 2019 - Sep 2025)
 * Updated: 2026-01-10
 *
 * This file contains precomputed turnaround time statistics
 * used by the staff dashboard production predictor widget.
 */

const PRODUCTION_STATS = {
  "dtg": {
    "byMonth": {
      "1": {
        "avg": 9.4,
        "min": 3,
        "max": 23,
        "median": 7,
        "samples": 18
      },
      "2": {
        "avg": 11.6,
        "min": 2,
        "max": 37,
        "median": 8,
        "samples": 14
      },
      "3": {
        "avg": 10.2,
        "min": 1,
        "max": 34,
        "median": 8,
        "samples": 26
      },
      "4": {
        "avg": 8.5,
        "min": 1,
        "max": 34,
        "median": 6,
        "samples": 25
      },
      "5": {
        "avg": 15.1,
        "min": 1,
        "max": 35,
        "median": 14,
        "samples": 29
      },
      "6": {
        "avg": 12.6,
        "min": 0,
        "max": 31,
        "median": 13,
        "samples": 34
      },
      "7": {
        "avg": 12.1,
        "min": 2,
        "max": 35,
        "median": 11,
        "samples": 30
      },
      "8": {
        "avg": 14.4,
        "min": 5,
        "max": 33,
        "median": 14,
        "samples": 15
      },
      "9": {
        "avg": 9.7,
        "min": 2,
        "max": 21,
        "median": 6,
        "samples": 3
      },
      "10": {
        "avg": 12,
        "min": 5,
        "max": 25,
        "median": 12,
        "samples": 0
      },
      "11": {
        "avg": 12,
        "min": 5,
        "max": 25,
        "median": 12,
        "samples": 0
      },
      "12": {
        "avg": 12,
        "min": 5,
        "max": 25,
        "median": 12,
        "samples": 0
      }
    },
    "overall": {
      "avg": 11.8,
      "min": 0,
      "max": 37,
      "median": 10,
      "samples": 194
    }
  },
  "dtgRush": {
    "byMonth": {
      "1": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 50
      },
      "2": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 50
      },
      "3": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 52
      },
      "4": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 52
      },
      "5": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 49
      },
      "6": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 49
      },
      "7": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 49
      },
      "8": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 62
      },
      "9": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 65
      },
      "10": {
        "avg": 13.3,
        "min": 13,
        "max": 14,
        "median": 13,
        "samples": 75
      },
      "11": {
        "avg": 13.1,
        "min": 13,
        "max": 14,
        "median": 13,
        "samples": 49
      },
      "12": {
        "avg": 13,
        "min": 13,
        "max": 13,
        "median": 13,
        "samples": 43
      }
    },
    "overall": {
      "avg": 13.1,
      "min": 13,
      "max": 14,
      "median": 13,
      "samples": 645
    }
  },
  "embroidery": {
    "byMonth": {
      "1": {
        "avg": 14.5,
        "min": 2,
        "max": 47,
        "median": 13,
        "samples": 169
      },
      "2": {
        "avg": 13.5,
        "min": 0,
        "max": 50,
        "median": 12,
        "samples": 158
      },
      "3": {
        "avg": 13.8,
        "min": 1,
        "max": 41,
        "median": 11,
        "samples": 168
      },
      "4": {
        "avg": 15.2,
        "min": 0,
        "max": 99,
        "median": 12,
        "samples": 158
      },
      "5": {
        "avg": 16.0,
        "min": 1,
        "max": 143,
        "median": 13,
        "samples": 138
      },
      "6": {
        "avg": 15.2,
        "min": 0,
        "max": 85,
        "median": 13,
        "samples": 128
      },
      "7": {
        "avg": 14.8,
        "min": 0,
        "max": 50,
        "median": 13,
        "samples": 140
      },
      "8": {
        "avg": 15.5,
        "min": 1,
        "max": 98,
        "median": 13,
        "samples": 110
      },
      "9": {
        "avg": 15.0,
        "min": 4,
        "max": 171,
        "median": 13,
        "samples": 78
      },
      "10": {
        "avg": 16.0,
        "min": 1,
        "max": 117,
        "median": 14,
        "samples": 133
      },
      "11": {
        "avg": 18.0,
        "min": 3,
        "max": 115,
        "median": 14,
        "samples": 111
      },
      "12": {
        "avg": 17.5,
        "min": 1,
        "max": 100,
        "median": 14,
        "samples": 98
      }
    },
    "overall": {
      "avg": 15.3,
      "min": 0,
      "max": 171,
      "median": 13,
      "samples": 1789
    }
  },
  "capEmbroidery": {
    "byMonth": {
      "1": {
        "avg": 16.2,
        "min": 7,
        "max": 75,
        "median": 14,
        "samples": 108
      },
      "2": {
        "avg": 15.4,
        "min": 4,
        "max": 60,
        "median": 13,
        "samples": 98
      },
      "3": {
        "avg": 15.8,
        "min": 2,
        "max": 65,
        "median": 13,
        "samples": 112
      },
      "4": {
        "avg": 17.5,
        "min": 1,
        "max": 65,
        "median": 15,
        "samples": 128
      },
      "5": {
        "avg": 16.8,
        "min": 3,
        "max": 72,
        "median": 14,
        "samples": 138
      },
      "6": {
        "avg": 17.4,
        "min": 0,
        "max": 68,
        "median": 14,
        "samples": 126
      },
      "7": {
        "avg": 18.2,
        "min": 1,
        "max": 53,
        "median": 15,
        "samples": 136
      },
      "8": {
        "avg": 17.5,
        "min": 2,
        "max": 63,
        "median": 14,
        "samples": 118
      },
      "9": {
        "avg": 17.2,
        "min": 0,
        "max": 70,
        "median": 14,
        "samples": 106
      },
      "10": {
        "avg": 18.4,
        "min": 5,
        "max": 77,
        "median": 15,
        "samples": 98
      },
      "11": {
        "avg": 19.2,
        "min": 5,
        "max": 93,
        "median": 16,
        "samples": 108
      },
      "12": {
        "avg": 19.0,
        "min": 2,
        "max": 88,
        "median": 15,
        "samples": 78
      }
    },
    "overall": {
      "avg": 17.2,
      "min": 0,
      "max": 93,
      "median": 14,
      "samples": 1454
    }
  },
  "screenprint": {
    "byMonth": {
      "1": {
        "avg": 24.5,
        "min": 3,
        "max": 77,
        "median": 21,
        "samples": 43
      },
      "2": {
        "avg": 22.8,
        "min": 8,
        "max": 100,
        "median": 20,
        "samples": 40
      },
      "3": {
        "avg": 24.2,
        "min": 7,
        "max": 113,
        "median": 21,
        "samples": 56
      },
      "4": {
        "avg": 27.5,
        "min": 2,
        "max": 96,
        "median": 24,
        "samples": 68
      },
      "5": {
        "avg": 29.8,
        "min": 2,
        "max": 112,
        "median": 26,
        "samples": 66
      },
      "6": {
        "avg": 28.2,
        "min": 0,
        "max": 71,
        "median": 26,
        "samples": 74
      },
      "7": {
        "avg": 26.8,
        "min": 6,
        "max": 76,
        "median": 24,
        "samples": 58
      },
      "8": {
        "avg": 27.4,
        "min": 4,
        "max": 69,
        "median": 24,
        "samples": 56
      },
      "9": {
        "avg": 27.8,
        "min": 7,
        "max": 82,
        "median": 24,
        "samples": 52
      },
      "10": {
        "avg": 28.6,
        "min": 3,
        "max": 150,
        "median": 26,
        "samples": 78
      },
      "11": {
        "avg": 31.2,
        "min": 8,
        "max": 86,
        "median": 27,
        "samples": 74
      },
      "12": {
        "avg": 32.5,
        "min": 9,
        "max": 57,
        "median": 29,
        "samples": 66
      }
    },
    "overall": {
      "avg": 27.4,
      "min": 0,
      "max": 150,
      "median": 24,
      "samples": 805
    }
  },
  "transfers": {
    "byMonth": {
      "1": {
        "avg": 13.1,
        "min": 6,
        "max": 29,
        "median": 11,
        "samples": 23
      },
      "2": {
        "avg": 18.5,
        "min": 8,
        "max": 67,
        "median": 14,
        "samples": 20
      },
      "3": {
        "avg": 18.2,
        "min": 5,
        "max": 55,
        "median": 15,
        "samples": 34
      },
      "4": {
        "avg": 14.0,
        "min": 4,
        "max": 79,
        "median": 10,
        "samples": 43
      },
      "5": {
        "avg": 17.4,
        "min": 2,
        "max": 43,
        "median": 14,
        "samples": 49
      },
      "6": {
        "avg": 20.0,
        "min": 1,
        "max": 106,
        "median": 13,
        "samples": 28
      },
      "7": {
        "avg": 15.2,
        "min": 7,
        "max": 41,
        "median": 13,
        "samples": 27
      },
      "8": {
        "avg": 14.5,
        "min": 4,
        "max": 35,
        "median": 14,
        "samples": 39
      },
      "9": {
        "avg": 22.2,
        "min": 0,
        "max": 94,
        "median": 11,
        "samples": 38
      },
      "10": {
        "avg": 15.1,
        "min": 1,
        "max": 36,
        "median": 13,
        "samples": 50
      },
      "11": {
        "avg": 16.4,
        "min": 3,
        "max": 42,
        "median": 14,
        "samples": 31
      },
      "12": {
        "avg": 18.0,
        "min": 5,
        "max": 53,
        "median": 10,
        "samples": 7
      }
    },
    "overall": {
      "avg": 16.3,
      "min": 0,
      "max": 106,
      "median": 13,
      "samples": 389
    }
  },
  "capacityByMonth": {
    "1": {
      "wideOpen": 94,
      "moderate": 6,
      "soldOut": 0,
      "samples": 68
    },
    "2": {
      "wideOpen": 88,
      "moderate": 9,
      "soldOut": 3,
      "samples": 66
    },
    "3": {
      "wideOpen": 96,
      "moderate": 3,
      "soldOut": 1,
      "samples": 69
    },
    "4": {
      "wideOpen": 79,
      "moderate": 18,
      "soldOut": 3,
      "samples": 68
    },
    "5": {
      "wideOpen": 63,
      "moderate": 4,
      "soldOut": 33,
      "samples": 67
    },
    "6": {
      "wideOpen": 36,
      "moderate": 45,
      "soldOut": 19,
      "samples": 69
    },
    "7": {
      "wideOpen": 39,
      "moderate": 31,
      "soldOut": 29,
      "samples": 51
    },
    "8": {
      "wideOpen": 62,
      "moderate": 10,
      "soldOut": 28,
      "samples": 69
    },
    "9": {
      "wideOpen": 74,
      "moderate": 4,
      "soldOut": 22,
      "samples": 81
    },
    "10": {
      "wideOpen": 84,
      "moderate": 15,
      "soldOut": 1,
      "samples": 93
    },
    "11": {
      "wideOpen": 85,
      "moderate": 15,
      "soldOut": 0,
      "samples": 65
    },
    "12": {
      "wideOpen": 75,
      "moderate": 25,
      "soldOut": 0,
      "samples": 53
    }
  },
  "metadata": {
    "dtgRecords": 194,
    "dtgSource": "Actual completion data (Jan-Sep 2025)",
    "transfersRecords": 389,
    "transfersSource": "Actual completion data (Jan 2024 - Nov 2025)",
    "embroideryRecords": 1789,
    "embroiderySource": "Actual completion data (Jan 2024 - Sep 2025)",
    "capEmbroideryRecords": 1454,
    "capEmbroiderySource": "Actual completion data (Jan 2020 - Nov 2025)",
    "screenprintRecords": 805,
    "screenprintSource": "Actual completion data (Jan 2019 - Sep 2025)",
    "updatedAt": "2026-01-10"
  }
};

/**
 * Production Holidays - dates that cannot be due dates
 * Includes US federal holidays and annual factory closure (Dec 26-31)
 * Used by ProductionPredictor to calculate valid due dates
 */
const PRODUCTION_HOLIDAYS = [
    // 2025 US Federal Holidays
    '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26',
    '2025-06-19', '2025-07-04', '2025-09-01', '2025-10-13',
    '2025-11-11', '2025-11-27', '2025-11-28', '2025-12-25',
    // 2025 Factory Closure (Dec 26-31)
    '2025-12-26', '2025-12-27', '2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31',

    // 2026 US Federal Holidays
    '2026-01-01', '2026-01-02', '2026-01-19', '2026-02-16', '2026-05-25',
    '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12',
    '2026-11-11', '2026-11-26', '2026-11-27', '2026-12-25',
    // 2026 Factory Closure (Dec 26-31)
    '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',

    // 2027 US Federal Holidays
    '2027-01-01', '2027-01-02', '2027-01-18', '2027-02-15', '2027-05-31',
    '2027-06-18', '2027-07-05', '2027-09-06', '2027-10-11',
    '2027-11-11', '2027-11-25', '2027-11-26', '2027-12-24',
    // 2027 Factory Closure (Dec 26-31)
    '2027-12-26', '2027-12-27', '2027-12-28', '2027-12-29', '2027-12-30', '2027-12-31',

    // 2028 US Federal Holidays
    '2028-01-01', '2028-01-02', '2028-01-17', '2028-02-21', '2028-05-29',
    '2028-06-19', '2028-07-04', '2028-09-04', '2028-10-09',
    '2028-11-10', '2028-11-23', '2028-11-24', '2028-12-25',
    // 2028 Factory Closure (Dec 26-31)
    '2028-12-26', '2028-12-27', '2028-12-28', '2028-12-29', '2028-12-30', '2028-12-31',

    // 2029 US Federal Holidays
    '2029-01-01', '2029-01-02', '2029-01-15', '2029-02-19', '2029-05-28',
    '2029-06-19', '2029-07-04', '2029-09-03', '2029-10-08',
    '2029-11-12', '2029-11-22', '2029-11-23', '2029-12-25',
    // 2029 Factory Closure (Dec 26-31)
    '2029-12-26', '2029-12-27', '2029-12-28', '2029-12-29', '2029-12-30', '2029-12-31',

    // 2030 US Federal Holidays
    '2030-01-01', '2030-01-02', '2030-01-21', '2030-02-18', '2030-05-27',
    '2030-06-19', '2030-07-04', '2030-09-02', '2030-10-14',
    '2030-11-11', '2030-11-28', '2030-11-29', '2030-12-25',
    // 2030 Factory Closure (Dec 26-31)
    '2030-12-26', '2030-12-27', '2030-12-28', '2030-12-29', '2030-12-30', '2030-12-31',

    // 2031 (partial - for year boundary)
    '2031-01-01', '2031-01-02'
];

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PRODUCTION_STATS, PRODUCTION_HOLIDAYS };
}
