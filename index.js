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
const checkFields = async function (shortTrend, longTrend, side) {
  const otherSide = side === 'buy' ? 'sell' : 'buy';
  //checking if theres a change in trends, that both sides are in the same trend thats the GetIn signal
  const conditionGetInPosition =
    side === 'buy'
      ? (longTrend[1] && !shortTrend[0] && shortTrend[1]) ||
        (shortTrend[1] && !longTrend[0] && longTrend[1])
      : (!longTrend[1] && shortTrend[0] && !shortTrend[1]) ||
        (!shortTrend[1] && longTrend[0] && !longTrend[1]);
  // checking if theres a change in one of the trends, so if there are not the same thats the getoutOfposition signal
  const conditionGetOutOfPosition =
    side === 'buy'
      ? (shortTrend[0] && !shortTrend[1]) || (longTrend[0] && !longTrend[1])
      : (!shortTrend[0] && shortTrend[1]) || (!longTrend[0] && longTrend[1]);
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
  //Checking if both of the trends are in the same direction, at the point that the change to that position we trade in the direction of the trend
  // const shortCrucialField = [false, true];
  // const longCrucialField = [true, true];
  await checkFields(shortTrend, longTrend, 'buy');
  await checkFields(shortTrend, longTrend, 'sell');
};
const checkSLTP = async (orderDetails) => {
  if (!inPosition) return;
  if (orderDetails && orderDetails.orderSide === 'buy') {
    const sl = orderDetails.orderPrice * (1 - SL_PRECENTAGE);
    const tp = orderDetails.orderPrice * (1 + TP_PRECENTAGE);
    const currPrice = candles[candles.length - 1][4];
    const conditionStopLoss = currPrice <= sl;
    const conditionTakeProfit = currPrice >= tp;
    const otherSide = 'sell';
  }
  if (orderDetails && orderDetails.orderSide === 'sell') {
    const sl = orderDetails.orderPrice * (1 + SL_PRECENTAGE);
    const tp = orderDetails.orderPrice * (1 - TP_PRECENTAGE);
    const currPrice = candles[candles.length - 1][4];
    const conditionStopLoss = currPrice >= sl;
    const conditionTakeProfit = currPrice <= tp;
    const otherSide = 'buy';
  }
  if (conditionTakeProfit || conditionStopLoss) {
    const order = await exchange.createMarketOrder(
      'ETH/USDT',
      otherSide,
      orderDetails.orderAmount
    );
    console.log(order);
    console.log(currPrice);
    orderDetails = undefined;
    inPosition = false;
    timeOfStopLossTakeProfit = candles[candles.length - 1][0];
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
