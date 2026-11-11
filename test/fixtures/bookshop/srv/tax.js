module.exports = function tax (net) {
  // @protected-begin tax-calc
  const rate = 0.19
  return Math.round(net * rate * 100) / 100
  // @protected-end
}
