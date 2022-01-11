const dotenv = require('dotenv');
const schedule = require('node-schedule');
const ccxt = require('ccxt');
const ta = require('./utils/ta');
const orders = require('./utils/orders');

const SL_PRECENTAGE = 0.005;
const TP_PRECENTAGE = 0.01;
const options = {
  defaultType: 'margin',
};
dotenv.config({ path: './config.env' });
const exchange = new ccxt.binance({
  apiKey: process.env.API_KEY,
  secret: process.env.API_SECRET,
  options,
});
let candles,
  hlc,
  orderDetails,
  shortTrend,
  longTrend,
  inPosition = false;
let timeOfStopLossTakeProfit = 1;
const init = async () => {
  candles = await exchange.fetchOHLCV('ETH/USDT', '15m');
  //candle[0] = date, candle[1] = openPrice, candle[2]=highPrice, candle[3]=lowestPrice, candle[4]=closePrice, candle[5]= volume
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
const checkFields = async function (shortCrucialField, longCrucialField, side) {
  const otherSide = side === 'buy' ? 'sell' : 'buy';
  //checking if theres a change in trends, that both sides are in the same trend thats the GetIn signal
  const conditionGetInPosition =
    side === 'buy'
      ? (longCrucialField[1] &&
          !shortCrucialField[0] &&
          shortCrucialField[1]) ||
        (shortCrucialField[1] && !longCrucialField[0] && longCrucialField[1])
      : (!longCrucialField[1] &&
          shortCrucialField[0] &&
          !shortCrucialField[1]) ||
        (!shortCrucialField[1] && longCrucialField[0] && !longCrucialField[1]);
  // checking if theres a change in one of the trends, so if there are not the same thats the getoutOfposition signal
  const conditionGetOutOfPosition =
    side === 'buy'
      ? (shortCrucialField[0] && !shortCrucialField[1]) ||
        (longCrucialField[0] && !longCrucialField[1])
      : (!shortCrucialField[0] && shortCrucialField[1]) ||
        (!longCrucialField[0] && longCrucialField[1]);
  if (conditionGetInPosition) {
    if (
      !inPosition &&
      timeOfStopLossTakeProfit !== candles[candles.length - 1][0]
    ) {
      orderDetails = await orders.makeOrder(side, exchange, 100, candles);
      console.log(candles[candles.length - 1][4]);
      inPosition = true;
    }
  }

  if (conditionGetOutOfPosition) {
    if (inPosition && orderDetails?.orderSide === side) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        otherSide,
        orderDetails.orderAmount
      );
      console.log(order);
      console.log(candles[candles.length - 1][4]);
      orderDetails = undefined;
      inPosition = false;
    }
  }
};
const checkBuySellSignals = async (shortTrend, longTrend) => {
  //taking the last two candles and checking if there was a change in the trend and giving buy/sell signals & checking if the longTrend is an uptrend
  const shortCrucialField = shortTrend.slice(-3, -1);
  const longCrucialField = longTrend.slice(-3, -1);
  // const shortCrucialField = [false, true];
  // const longCrucialField = [true, true];
  await checkFields(shortCrucialField, longCrucialField, 'buy');
  await checkFields(shortCrucialField, longCrucialField, 'sell');
};
const checkSLTP = async (orderDetails) => {
  if (!inPosition) return;
  if (orderDetails && orderDetails.orderSide === 'buy') {
    const sl = orderDetails.orderPrice * (1 - SL_PRECENTAGE);
    const tp = orderDetails.orderPrice * (1 + TP_PRECENTAGE);
    const currPrice = candles[candles.length - 1][4];
    if (currPrice >= tp) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'sell',
        orderDetails.orderAmount
      );
      console.log(order);
      console.log(currPrice);
      orderDetails = undefined;
      inPosition = false;
      timeOfStopLossTakeProfit = candles[candles.length - 1][0];
    }
    if (currPrice <= sl) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'sell',
        orderDetails.orderAmount
      );
      console.log(order);
      console.log(currPrice);
      orderDetails = undefined;
      inPosition = false;
      timeOfStopLossTakeProfit = candles[candles.length - 1][0];
    }
  }
  if (orderDetails && orderDetails.orderSide === 'sell') {
    const sl = orderDetails.orderPrice * (1 + SL_PRECENTAGE);
    const tp = orderDetails.orderPrice * (1 - TP_PRECENTAGE);
    const currPrice = candles[candles.length - 1][4];
    if (currPrice <= tp) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'buy',
        orderDetails.orderAmount
      );
      console.log(order);
      console.log(currPrice);
      orderDetails = undefined;
      inPosition = false;
      timeOfStopLossTakeProfit = candles[candles.length - 1][0];
    }
    if (currPrice >= sl) {
      const order = await exchange.createMarketOrder(
        'ETH/USDT',
        'buy',
        orderDetails.orderAmount
      );
      console.log(currPrice);
      console.log(order);
      orderDetails = undefined;
      inPosition = false;
      timeOfStopLossTakeProfit = candles[candles.length - 1][0];
    }
  }
};
const rule = new schedule.RecurrenceRule();
rule.second = 1;
const fetchBars = schedule.scheduleJob(
  '0,5,10,15,20,25,30,35,40,45,50,55 * * * * *',
  async () => {
    try {
      await main();
      await checkBuySellSignals(shortTrend, longTrend);
      await checkSLTP(orderDetails);
    } catch (err) {
      console.log(err);
    }
  }
);

process.on('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0));
});
