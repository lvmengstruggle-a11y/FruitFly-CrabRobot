import { describe, expect, it } from 'vitest';
import { messages, translate } from './index';

describe('i18n', () => {
  it('uses the same keys in Chinese and English', () => {
    expect(Object.keys(messages.zh).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it('interpolates flight labels', () => {
    expect(translate('en', 'flyLabel', { id: 3 })).toBe('CRAB #3');
    expect(translate('zh', 'flyLabel', { id: 3 })).toBe('螃蟹 #3');
    expect(translate('zh', 'load.weights', { pct: 40 })).toBe('正在加载压缩连接组… 40%');
  });

  it('returns the key when a phrase is missing', () => {
    expect(translate('zh', 'missing-key')).toBe('missing-key');
  });
});
