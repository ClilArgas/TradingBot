const dotenv = require('dotenv');
const schedule = require('node-schedule');
const ccxt = require('ccxt');
const ta = require('./utils/ta');
const orders = require('./utils/orders');

const SL_PRECENTAGE = 0.005;
const TP_PRECENTAGE = 0.01;

dotenv.config({ path: './config.env' });
const exchange = new ccxt.binance({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
});
let candles,
  hlc,
  orderDetails,
  shortTrend,
  longTrend,
  inPosition = false;
const init = async () => {
  candles = await exchange.fetchOHLCV('ETH/USDT', '15m');
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
const checkBuySellSignals = async (shortTrend, longTrend, orderDetails) => {
  //taking the last two candles and checking if there was a change in the trend and giving buy/sell signals & checking if the longTrend is an uptrend
  const shortCrucialField = shortTrend.slice(-3, -1);
  const longCrucialField = longTrend.slice(-3, -1);
  if (
    (longCrucialField[1] && !shortCrucialField[0] && shortCrucialField[1]) ||
    (shortCrucialField[1] && !longCrucialField[0] && longCrucialField[1])
  ) {
    if (!inPosition) {
      orderDetails = await orders.makeOrder('buy', exchange, 100, candles);
      console.log('make a buy order');
      console.log(candles[candles.length - 1][4]);
      inPosition = true;
    }
  }
  if (
    (shortCrucialField[0] && !shortCrucialField[1]) ||
    (longCrucialField[0] && !longCrucialField[1])
  ) {
    if (inPosition && orderDetails.orderSide === 'buy') {
      //const order = await exchange.createMarketOrder(
      //  'ETH/USDT',
      //  'sell',
      //   orderDetails.orderAmount
      // );
      console.log('make a sell oreder');
      console.log(candles[candles.length - 1][4]);
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
      console.log('make a sell oreder');
      console.log(candles[candles.length - 1][4]);
      inPosition = true;
    }
  }
  if (
    (!shortCrucialField[0] && shortCrucialField[1]) ||
    (!longCrucialField[0] && longCrucialField[1])
  ) {
    if (inPosition && orderDetails.orderSide === 'sell') {
      //const order = await exchange.createMarketOrder(
      //  'ETH/USDT',
      //   'buy',
      //   orderDetails.orderAmount
      // );
      console.log('make a buy order');
      console.log(candles[candles.length - 1][4]);
      orderDetails = undefined;
      inPosition = false;
    }
  }
};
const checkSLTP = async (orderDetails) => {
  if (!inPosition) return;
  if (orderDetails.orderSide === 'buy') {
    const sl = orderDetails.orderPrice * (1 - SL_PRECENTAGE);
    const tp = orderDetails.orderPrice * (1 + TP_PRECENTAGE);
    const currPrice = candles[candles.length - 1][4];
    if (currPrice >= tp) {
      //const order = await exchange.createMarketOrder(
      //   'ETH/USDT',
      //  'sell',
      //  orderDetails.orderAmount
      //  );
      console.log('make a sell order');
      console.log(currPrice);
      orderDetails = undefined;
      inPosition = false;
    }
    if (currPrice <= sl) {
      // const order = await exchange.createMarketOrder(
      //  'ETH/USDT',
      //  'sell',
      //  orderDetails.orderAmount
      //);
      console.log('make a sell order');
      console.log(currPrice);
      //console.log(order);
      orderDetails = undefined;
      inPosition = false;
    }
  }
  if (orderDetails.orderSide === 'sell') {
    const sl = orderDetails.orderPrice * (1 + SL_PRECENTAGE);
    const tp = orderDetails.orderPrice * (1 - TP_PRECENTAGE);
    const currPrice = candles[candles.length - 1][4];
    if (currPrice <= tp) {
      // const order = await exchange.createMarketOrder(
      //   'ETH/USDT',
      //   'buy',
      //   orderDetails.orderAmount
      // );
      //console.log(order);
      console.log('make a buy order');
      console.log(currPrice);
      orderDetails = undefined;
      inPosition = false;
    }
    if (currPrice >= sl) {
      // const order = await exchange.createMarketOrder(
      //   'ETH/USDT',
      //   'buy',
      //   orderDetails.orderAmount
      // );
      console.log('make a buy order');
      console.log(currPrice);
      //console.log(order);
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
    await checkBuySellSignals(shortTrend, longTrend, orderDetails);
    await checkSLTP(orderDetails);
  }
);

process.on('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0));
});
