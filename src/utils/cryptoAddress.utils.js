class CryptoAddressValidator {
  // BTC addresses can be P2PKH (1...), P2SH (3...), or Bech32 (bc1...)
  validateBTC(address) {
    const p2pkhRegex = /^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const p2shRegex = /^[3][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const bech32Regex = /^(bc1)[a-z0-9]{39,87}$/;

    return p2pkhRegex.test(address) || p2shRegex.test(address) || bech32Regex.test(address);
  }

  // Dash addresses start with 'X'
  validateDASH(address) {
    const dashRegex = /^[X7][a-km-zA-HJ-NP-Z1-9]{33}$/;
    return dashRegex.test(address);
  }

  // DOGE addresses start with 'D'
  validateDOGE(address) {
    const dogeRegex = /^[D9][a-km-zA-HJ-NP-Z1-9]{33}$/;
    return dogeRegex.test(address);
  }

  // LTC addresses can start with 'L', 'M', or 'ltc1' (Bech32)
  validateLTC(address) {
    const legacyRegex = /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/;
    const bech32Regex = /^(ltc1)[a-z0-9]{39,87}$/;

    return legacyRegex.test(address) || bech32Regex.test(address);
  }

  // Main validation method
  validate(method, address) {
    if (!address || typeof address !== 'string') {
      return false;
    }

    address = address.trim();

    switch (method.toUpperCase()) {
      case 'BTC':
        return this.validateBTC(address);
      case 'DASH':
        return this.validateDASH(address);
      case 'DOGE':
        return this.validateDOGE(address);
      case 'LTC':
        return this.validateLTC(address);
      default:
        return false;
    }
  }

  getMinimumAmount(method) {
    const minimums = {
      BTC: 50000,
      DASH: 30000,
      DOGE: 30000,
      LTC: 30000,
    };

    return minimums[method.toUpperCase()] || null;
  }

  // Get fee for method
  getFee(method) {
    return 0;
  }

  // Check if method is supported
  isSupportedMethod(method) {
    const supported = ['BTC', 'DASH', 'DOGE', 'LTC'];
    return supported.includes(method.toUpperCase());
  }
}

module.exports = new CryptoAddressValidator();
