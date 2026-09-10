// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import en from '@/core/i18n/messages/en.json';
import { MarkdownField } from '@/ui/markdown/MarkdownField';
import { mount } from './harness';
const content = [
  '# Agenda',
  '',
  '<script>alert(1)</script>',
  '',
  '![leak](https://example.test/pixel.png)',
  '',
  '[site](https://example.test) and [bad](javascript:alert(1))',
  '',
  'نقاط النقاش الرئيسية',
  '',
  '- [ ] item',
].join('\n');
describe('markdown field', () => {
  it('NOTES-A09 preview renders headings and lists, strips scripts, images and unsafe links, and lays Arabic out by paragraph', async () => {
    mount(<MarkdownField label="Content" value={content} />);
    fireEvent.click(screen.getByRole('button', { name: en.common.preview }));
    const heading = await screen.findByRole('heading', { name: 'Agenda' });
    expect(heading.getAttribute('dir')).toBe('auto');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).not.toContain('alert(1)');
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links.filter(Boolean)).toEqual(['https://example.test']);
    expect(links.some((href) => href?.startsWith('javascript'))).toBe(false);
    expect(document.querySelector('a')?.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText('نقاط النقاش الرئيسية').getAttribute('dir')).toBe('auto');
    expect(document.querySelector('li input[type="checkbox"]')).not.toBeNull();
  });
  it('NOTES-B07 leaving the textarea, including by switching to preview, commits a changed draft once', async () => {
    const commit = vi.fn();
    mount(<MarkdownField label="Content" value="before" onCommit={commit} />);
    const box = screen.getByLabelText('Content');
    fireEvent.change(box, { target: { value: 'after' } });
    fireEvent.blur(box);
    expect(commit).toHaveBeenCalledWith('after');
    fireEvent.click(screen.getByRole('button', { name: en.common.preview }));
    await waitFor(() => expect(screen.getByText('after')).toBeTruthy());
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
