/**
 * A function that makes orders on the binance market. with precentage and with your wallet currency
 * @param {String} symbol the symbol you want to trade
 * @param {String} side buy | sell
 * @param {Exchange} exchange  your private exchange
 * @param {Number} precentage how much of your wallet/deal you want to put in/out
 */
exports.makeOrder = async (symbol, side, exchange, amount, sl, tp) => {
  try {
    const order = await exchange.createMarketOrder(symbol, side, amount);
    console.log(order);
  } catch (err) {
    console.log(err);
  }
};


console.log('yahel argas');