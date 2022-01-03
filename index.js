const dotenv = require('dotenv');
const schedule = require('node-schedule');
const ccxt = require('ccxt');
const ta = require('./utils/ta');
const orders = require('./utils/orders');

const amount = 0.004;

dotenv.config({ path: './config.env' });
const exchange = new ccxt.binance({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
});
exchange.createOrder;
let candles,
  hlc,
  orderDetails,
  shortTrend,
  longTrend,
  inPosition = false;
const init = async () => {
  candles = await exchange.fetchOHLCV('ETH/USDT', '1h');
  //candle[0] = date, candle[1] = openPrice, candle[2]=highPrice, candle[3]=lowestPrice, candle[4]=closePrice, candle[5]= volume, candle[6]=uptrend?
  candles.forEach(
    (candle) => (candle[0] = new Date(candle[0]).toLocaleString('he-IL'))
  );
  //for atr only the high low and the prev close
  hlc = candles.map((candle, i, candles) => [
    candle[2],
    candle[3],
    candles[i - 1] ? candles[i - 1][4] : NaN,
  ]);
};
const main = async () => {
  try {
    await init();
    shortTrend = ta.superTrend(candles, hlc);
    longTrend = ta.superTrend(candles, hlc, 20, 5);
  } catch (err) {
    console.log(err);
  }
};
main();
const checkBuySellSignals = async (shortTrend, longTrend) => {
  //taking the last two candles and checking if there was a change in the trend and giving buy/sell signals & checking if the longTrend is an uptrend
  const shortCrucialField = shortTrend.slice(-3, -1);
  const longCrucialField = longTrend.slice(-3, -1);
  if (
    (longCrucialField[1] && !shortCrucialField[0] && shortCrucialField[1]) ||
    (shortCrucialField[1] && !longCrucialField[0] && longCrucialField[1])
  ) {
    if (!inPosition) {
      orderDetails = await orders.makeOrder('buy', exchange, 100, candles);
      inPosition = true;
    }
  }
  if (
    (shortCrucialField[0] && !shortCrucialField[1]) ||
    (longCrucialField[0] && !longCrucialField[1])
  ) {
    if (inPosition) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'sell',
        orderDetails.orderAmount
      );
      console.log(order);
      orderDetails = undefined;
      inPosition = false;
    }
  }
  if (
    (!longCrucialField[1] && shortCrucialField[0] && !shortCrucialField[1]) ||
    (!shortCrucialField[1] && longCrucialField[0] && !longCrucialField[1])
  ) {
    if (!inPosition) {
      orderDetails = await orders.makeOrder('sell', exchange, 100, candles);
      inPosition = true;
    }
  }
  if (
    (!shortCrucialField[0] && shortCrucialField[1]) ||
    (!longCrucialField[0] && longCrucialField[1])
  ) {
    if (inPosition) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'buy',
        orderDetails.orderAmount
      );
      console.log(order);
      orderDetails = undefined;
      inPosition = false;
    }
  }
  // if (longCrucialField) {
  //   if (!shortCrucialField[0] && shortCrucialField[1]) {
  //     if (!inPosition) {
  //       orderDetails = await orders.makeOrder('buy', exchange, 100, candles);
  //       inPosition = true;
  //     }
  //   }
  //   if (shortCrucialField[0] && !shortCrucialField[1]) {
  //     if (inPosition) {
  //       await exchange.createMarketOrder(
  //         'ETH/USDT',
  //         'sell',
  //         orderDetails.orderAmount
  //       );
  //       orderDetails = undefined;
  //       inPosition = false;
  //     }
  //   }
  //   return;
  // }
  // if (shortCrucialField[0] && !shortCrucialField[1]) {
  //   if (!inPosition) {
  //     orderDetails = await orders.makeOrder('sell', exchange, 100, candles);
  //     inPosition = true;
  //   }
  // }
  // if (!shortCrucialField[0] && shortCrucialField[1]) {
  //   if (inPosition) {
  //     await exchange.createMarketOrder(
  //       'ETH/USDT',
  //       'buy',
  //       orderDetails.orderAmount
  //     );
  //     orderDetails = undefined;
  //     inPosition = false;
  //   }
  // }
};
const checkSLTP = async (orderDetails) => {
  if (!inPosition) return;
  if (orderDetails.orderSide === 'buy') {
    const sl = orderDetails.orderPrice * 0.985;
    const tp = orderDetails.orderPrice * 1.03;
    const currPrice = candles[candles.length - 1][4];
    if (currPrice >= tp) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'sell',
        orderDetails.orderAmount
      );
      console.log(order);
      orderDetails = undefined;
      inPosition = false;
    }
    if (currPrice <= sl) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'sell',
        orderDetails.orderAmount
      );
      console.log(order);
      orderDetails = undefined;
      inPosition = false;
    }
  }
  if (orderDetails.orderSide === 'sell') {
    const sl = orderDetails.orderPrice * 1.015;
    const tp = orderDetails.orderPrice * 0.97;
    const currPrice = candles[candles.length - 1][4];
    if (currPrice <= tp) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'buy',
        orderDetails.orderAmount
      );
      console.log(order);
      orderDetails = undefined;
      inPosition = false;
    }
    if (currPrice >= sl) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'buy',
        orderDetails.orderAmount
      );
      console.log(order);
      orderDetails = undefined;
      inPosition = false;
    }
  }
};
const rule = new schedule.RecurrenceRule();
rule.second = 1;
const fetchBars = schedule.scheduleJob(
  '0,5,10,15,20,25,30,35,40,45,50,55 * * * * *',
  async () => {
    await main();
    console.log(candles[candles.length - 1][4]);
  }
);

process.on('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0));
});
