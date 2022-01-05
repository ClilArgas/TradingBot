/**
 * A function that makes orders on the binance market. with precentage and with your wallet currency
 * @param {Array} candles the array of candles.
 * @param {String} side buy | sell
 * @param {Exchange} exchange  your private exchange
 * @param {Number} precentage how much of your wallet/deal you want to put in/out
 */
exports.makeOrder = async (side, exchange, precentage = 100, candles) => {
  try {
    const balance = await exchange.fetchBalance();
    const usdtBalance = balance.USDT.free;
    const amount =
      (usdtBalance / candles[candles.length - 1][4]) *
      ((0.99 * precentage) / 100);
    const order = await exchange.createMarketOrder('ETH/USDT', side, amount);
    console.log(order);
    //returns the price details
    const orderDetails = {
      orderPrice: candles[candles.length - 1][4],
      orderSide: side,
      orderAmount: amount,
    };
    return orderDetails;
  } catch (err) {
    console.log(err);
  }
};
