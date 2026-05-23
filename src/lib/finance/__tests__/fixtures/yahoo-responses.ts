export const validPriceResponse = {
  price: {
    regularMarketPrice: 189.43,
    regularMarketChange: 1.27,
    regularMarketChangePercent: 0.00675,
    regularMarketVolume: 54_321_000,
    marketCap: 2_950_000_000_000,
    currency: 'USD',
    shortName: 'Apple Inc.',
    longName: 'Apple Inc.',
    symbol: 'AAPL',
  },
  summaryDetail: {
    marketCap: 2_950_000_000_000,
    fiftyTwoWeekHigh: 199.62,
    fiftyTwoWeekLow: 164.08,
  },
};

export const partialPriceResponse = {
  price: {
    regularMarketPrice: 412.18,
    regularMarketChange: -0.42,
    regularMarketChangePercent: -0.00101,
    regularMarketVolume: null,
    marketCap: null,
    currency: 'USD',
    shortName: 'SPDR S&P 500 ETF Trust',
    longName: null,
    symbol: 'SPY',
  },
  summaryDetail: {},
};

export const emptyPriceResponse = {
  price: {
    regularMarketPrice: null,
    regularMarketChange: null,
    regularMarketChangePercent: null,
    regularMarketVolume: null,
    marketCap: null,
    currency: null,
    shortName: null,
    longName: null,
    symbol: 'XXXX',
  },
  summaryDetail: {},
};

export const etfPriceResponse = {
  price: {
    regularMarketPrice: 521.04,
    regularMarketChange: 2.18,
    regularMarketChangePercent: 0.0042,
    regularMarketVolume: 41_000_000,
    marketCap: null,
    currency: 'USD',
    shortName: 'SPDR S&P 500',
    longName: 'SPDR S&P 500 ETF Trust',
    symbol: 'SPY',
  },
  summaryDetail: {
    marketCap: null,
    totalAssets: 480_000_000_000,
  },
};

export const adrPriceResponse = {
  price: {
    regularMarketPrice: 142.78,
    regularMarketChange: 0.93,
    regularMarketChangePercent: 0.00655,
    regularMarketVolume: 7_200_000,
    marketCap: 740_000_000_000,
    currency: 'USD',
    shortName: 'Taiwan Semiconductor',
    longName: 'Taiwan Semiconductor Manufacturing Company Limited',
    symbol: 'TSM',
  },
  summaryDetail: {
    marketCap: 740_000_000_000,
  },
};

export const validEarningsResponse = {
  earnings: {
    earningsChart: {
      quarterly: [
        { date: '4Q2024', actual: 2.18, estimate: 2.1 },
        { date: '1Q2025', actual: 1.65, estimate: 1.58 },
        { date: '2Q2025', actual: 1.4, estimate: 1.35 },
        { date: '3Q2025', actual: 1.64, estimate: 1.6 },
      ],
      currentQuarterEstimate: 2.35,
    },
  },
  earningsTrend: {
    trend: [
      { period: '0q', growth: 0.12 },
      { period: '+1q', growth: 0.09 },
    ],
  },
  financialData: {
    currentPrice: 189.43,
    targetMeanPrice: 215.0,
    revenueGrowth: 0.062,
    earningsGrowth: 0.11,
    profitMargins: 0.247,
  },
};

export const validAnalystResponse = {
  recommendationTrend: {
    trend: [
      {
        period: '0m',
        strongBuy: 12,
        buy: 18,
        hold: 8,
        sell: 1,
        strongSell: 0,
      },
      {
        period: '-1m',
        strongBuy: 11,
        buy: 19,
        hold: 8,
        sell: 1,
        strongSell: 0,
      },
      {
        period: '-2m',
        strongBuy: 10,
        buy: 17,
        hold: 9,
        sell: 2,
        strongSell: 0,
      },
      {
        period: '-3m',
        strongBuy: 10,
        buy: 16,
        hold: 10,
        sell: 2,
        strongSell: 0,
      },
    ],
  },
  upgradeDowngradeHistory: {
    history: [
      {
        firm: 'Morgan Stanley',
        toGrade: 'Overweight',
        fromGrade: 'Equal-Weight',
        action: 'up',
        epochGradeDate: 1_700_000_000,
      },
      {
        firm: 'Goldman Sachs',
        toGrade: 'Buy',
        fromGrade: 'Neutral',
        action: 'up',
        epochGradeDate: 1_695_000_000,
      },
    ],
  },
};

export const validOptionsResponse = {
  options: [
    {
      expirationDate: 1_710_000_000,
      calls: [
        {
          strike: 180,
          lastPrice: 12.5,
          impliedVolatility: 0.27,
          openInterest: 5400,
          volume: 1200,
        },
        {
          strike: 190,
          lastPrice: 6.1,
          impliedVolatility: 0.25,
          openInterest: 8100,
          volume: 3300,
        },
      ],
      puts: [
        {
          strike: 180,
          lastPrice: 3.2,
          impliedVolatility: 0.26,
          openInterest: 4400,
          volume: 900,
        },
      ],
    },
  ],
  expirationDates: [1_710_000_000, 1_712_592_000],
  strikes: [170, 180, 190, 200],
  hasMiniOptions: false,
  underlyingSymbol: 'AAPL',
};

export const emptyOptionsResponse = {
  options: [],
  expirationDates: [],
  strikes: [],
  hasMiniOptions: false,
  underlyingSymbol: 'SPY',
};

export const validProfileResponse = {
  assetProfile: {
    sector: 'Technology',
    industry: 'Consumer Electronics',
    fullTimeEmployees: 161_000,
    longBusinessSummary:
      'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.',
    website: 'https://www.apple.com',
    country: 'United States',
  },
  defaultKeyStatistics: {
    enterpriseValue: 3_010_000_000_000,
    forwardPE: 28.5,
    profitMargins: 0.247,
    pegRatio: 2.9,
    beta: 1.26,
  },
};

export const validNewsResponse = {
  news: [
    {
      title: 'Apple announces new product line at WWDC',
      publisher: 'Reuters',
      link: 'https://example.com/apple-wwdc',
      providerPublishTime: 1_705_000_000,
      uuid: 'abc-1',
      type: 'STORY',
    },
    {
      title: 'iPhone shipments beat estimates',
      publisher: 'Bloomberg',
      link: 'https://example.com/iphone-shipments',
      providerPublishTime: 1_704_900_000,
      uuid: 'abc-2',
      type: 'STORY',
    },
    {
      title: 'Analysts raise Apple price targets',
      publisher: 'CNBC',
      link: 'https://example.com/apple-targets',
      providerPublishTime: 1_704_800_000,
      uuid: 'abc-3',
      type: 'STORY',
    },
    {
      title: null,
      publisher: 'Spam Source',
      link: null,
      providerPublishTime: null,
      uuid: 'spam-1',
      type: 'STORY',
    },
  ],
};

export const etfQuoteSummaryResponse = {
  price: etfPriceResponse.price,
  summaryDetail: etfPriceResponse.summaryDetail,
};

export const adrQuoteSummaryResponse = {
  price: adrPriceResponse.price,
  summaryDetail: adrPriceResponse.summaryDetail,
  earnings: {
    earningsChart: {
      quarterly: [],
      currentQuarterEstimate: null,
    },
  },
};
