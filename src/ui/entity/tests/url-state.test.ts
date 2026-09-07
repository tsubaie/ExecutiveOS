import { describe, it, expect } from 'vitest';
import { resolveUrlState, changeUrl } from '../url-state';
describe('Entity URL state', () => {
  it('EP-B01 create wins over detail and opening a row removes create', () => {
    expect(resolveUrlState(new URLSearchParams('new=1&id=old')).id).toBeNull();
    expect(changeUrl(new URLSearchParams('new=1'), { id: 'next' })).toBe('id=next');
  });
  it('EP-B01 changing a view clears multi-selection and detail', () => {
    const result = new URLSearchParams(
      changeUrl(new URLSearchParams('id=old&sel=a,b&q=test'), { view: 'trash' }),
    );
    expect(result.has('sel')).toBe(false);
    expect(result.has('id')).toBe(false);
    expect(result.get('q')).toBe('test');
  });
  it('EP-B01 changing the sort clears selection and detail like a view change', () => {
    const result = new URLSearchParams(
      changeUrl(new URLSearchParams('id=old&sel=a&view=inbox'), { sort: 'title' }),
    );
    expect(result.get('sort')).toBe('title');
    expect(result.has('sel')).toBe(false);
    expect(result.has('id')).toBe(false);
    expect(resolveUrlState(new URLSearchParams('sort=title')).sort).toBe('title');
    expect(resolveUrlState(new URLSearchParams('')).sort).toBe('');
  });
  it('EP-B04 a missing detail id remains addressable until close', () => {
    expect(resolveUrlState(new URLSearchParams('id=missing')).id).toBe('missing');
    expect(changeUrl(new URLSearchParams('id=missing'), { id: null })).toBe('');
  });
});
