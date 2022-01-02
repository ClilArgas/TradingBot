const tr = (hlc) => {
  const hl = hlc[0] - hlc[1];
  const hpc = Math.abs(hlc[0] - hlc[2]);
  const lpc = Math.abs(hlc[1] - hlc[2]);
  // console.log([hl, hpc, lpc, Math.max(hl, hpc, lpc)]);
  return Math.floor(Math.max(hl, hpc, lpc) * 100) / 100;
};
const averageTrueRange = (hlc, period = 14) => {
  const atr = [];
  for (let i = 0; i < hlc.length; i++) {
    hlc[i].push(tr(hlc[i]));
    if (i >= period - 1) {
      let sum = 0;
      for (let j = i; j >= i - (period - 1); j--) {
        j === 0 ? (sum += hlc[0][0] - hlc[0][1]) : (sum += hlc[j][3]);
      }
      atr.push(Math.floor((sum / period) * 100) / 100);
    } else {
      atr.push(NaN);
    }
  }
  return atr;
  // console.log(candles);
};

exports.superTrend = (candles, hlc, period = 10, multiplier = 3) => {
  const atr = averageTrueRange(hlc, period);
  const upperBand = [];
  const lowerBand = [];
  const supertrend = [];
  hlc.forEach((el, i) => {
    lowerBand.push((el[0] + el[1]) / 2 - multiplier * atr[i]);
    upperBand.push((el[0] + el[1]) / 2 + multiplier * atr[i]);
  });

  const closePrices = candles.map((candle) => candle[4]);
  // SETS THE UPTREND AT FIRST TO TRUE AT ALL TIME
  for (let i = 0; i < candles.length; i++) supertrend.push(true);
  //IMPLEMNTATION OF THE LOGIC OF THE SUPERTREND
  for (let i = period; i < candles.length; i++) {
    //SWITCH TREND FROM DOWN TREND TO UPTREND
    if (closePrices[i] > upperBand[i - 1]) supertrend[i] = true;
    // SWITCH TREND FROM UPTREND TO DOWNTREND
    else if (closePrices[i] < lowerBand[i - 1]) supertrend[i] = false;
    //STICK WITH THE SAME TREND
    else supertrend[i] = supertrend[i - 1];
    //ADJUSTING THE BANDS ACORDDING TO TREND
    if (supertrend && lowerBand[i] < lowerBand[i - 1])
      lowerBand[i] = lowerBand[i - 1];
    if (!supertrend && upperBand[i] > upperBand[i - 1])
      upperBand[i] = upperBand[i - 1];
  }
  return supertrend;
};
