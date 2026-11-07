// expo-crypto is a native module and returns nothing under jest. Back it with Node's crypto.
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('node:crypto');
  return {
    randomUUID: () => nodeCrypto.randomUUID(),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm, data) =>
      nodeCrypto.createHash('sha256').update(data).digest('hex'),
  };
});
