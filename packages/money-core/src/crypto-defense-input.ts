export type CryptoFunctionSignature = {
  selector: string;
  signature?: string;
  risk: 'info' | 'watch' | 'elevated' | 'critical';
};

export type DecodedCryptoInput = {
  selector: string | null;
  signature?: string;
  risk: CryptoFunctionSignature['risk'];
  recognized: boolean;
};

const SELECTOR_PATTERN = /^0x[0-9a-fA-F]{8}$/;

export const CRYPTO_FUNCTION_SIGNATURES: Readonly<Record<string, CryptoFunctionSignature>> = {
  '0xbaa2abde': { selector: '0xbaa2abde', signature: 'removeLiquidityETH(address,uint256,uint256,uint256,address,uint256)', risk: 'critical' },
  '0x2195995a': { selector: '0x2195995a', signature: 'removeLiquidity', risk: 'critical' },
  '0x5b0d5984': { selector: '0x5b0d5984', signature: 'renounceOwnership', risk: 'watch' },
  '0x40c10f19': { selector: '0x40c10f19', signature: 'mint(address,uint256)', risk: 'elevated' },
  '0x8456cb59': { selector: '0x8456cb59', signature: 'pause()', risk: 'elevated' },
  '0x3659cfe6': { selector: '0x3659cfe6', signature: 'upgradeTo(address)', risk: 'critical' },
  '0x4f1ef286': { selector: '0x4f1ef286', signature: 'upgradeToAndCall(address,bytes)', risk: 'critical' },
};

export function decodeCryptoTransactionInput(rawInput: string | null | undefined): DecodedCryptoInput {
  if (!rawInput || rawInput === '0x') {
    return { selector: null, risk: 'info', recognized: false };
  }

  const selector = rawInput.slice(0, 10).toLowerCase();
  if (!SELECTOR_PATTERN.test(selector)) {
    return { selector: null, risk: 'watch', recognized: false };
  }

  const known = CRYPTO_FUNCTION_SIGNATURES[selector];
  if (!known) return { selector, risk: 'watch', recognized: false };

  return {
    selector,
    signature: known.signature,
    risk: known.risk,
    recognized: true,
  };
}
