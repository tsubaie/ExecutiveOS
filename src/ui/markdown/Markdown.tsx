'use client';
import { createContext, useContext, type ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/ui/cn';
import { schema } from './schema';
// The only markdown renderer (ADR 0015). Output is React elements: raw HTML is skipped, the
// sanitize schema drops images and unsafe links, and every block carries dir="auto" so mixed
// Arabic and English content lays out per paragraph. Lists pad both sides: an item resolves its
// own direction, so its marker may hang on either side of the list.
type Hast = { type: string; value?: string; children?: Hast[] };
type Extra = { node?: Hast | undefined };
// The toggle a preview offers for its checklist items, by the checkbox's position in the render
// (NOTES-B25); without one the checkboxes stay inert.
const Checklist = createContext<((index: number) => void) | null>(null);
// The text of the list item a checkbox belongs to, which names the checkbox.
const ItemText = createContext('');
// Inside a list item. A paragraph there leaves direction to the item: with its own dir="auto"
// its text would be skipped when the item resolves direction, and the item's bullet would land
// on the wrong side of Arabic text.
const InItem = createContext(false);
function hastText(node: Hast): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(hastText).join('');
}
function checkboxIndex(element: HTMLInputElement) {
  const root = element.closest('[data-checklist]');
  return root ? Array.from(root.querySelectorAll('input[type="checkbox"]')).indexOf(element) : -1;
}
function Paragraph({ node, className, ...props }: ComponentProps<'p'> & Extra) {
  void node;
  const inItem = useContext(InItem);
  return (
    <p
      dir={inItem ? undefined : 'auto'}
      className={cn('whitespace-pre-wrap', className)}
      {...props}
    />
  );
}
// A checklist item drops its bullet and names its checkbox after its own text.
function ListItem({ node, className, children, ...props }: ComponentProps<'li'> & Extra) {
  const task = Boolean(className?.includes('task-list-item'));
  return (
    <li dir="auto" className={cn(task && 'list-none', className)} {...props}>
      <InItem.Provider value={true}>
        <ItemText.Provider value={task && node ? hastText(node).trim() : ''}>
          {children}
        </ItemText.Provider>
      </InItem.Provider>
    </li>
  );
}
function Checkbox({ node, checked, disabled, type, ...props }: ComponentProps<'input'> & Extra) {
  void node;
  void disabled;
  void type;
  const toggle = useContext(Checklist);
  const name = useContext(ItemText);
  return (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      disabled={!toggle}
      aria-label={name || undefined}
      // The base layer gives inputs a minimum height for touch; a checkbox is inline text-sized.
      className="pointer-events-auto me-1.5 size-3.5 min-h-0 align-[-2px]"
      onChange={(event) => toggle?.(checkboxIndex(event.currentTarget))}
      {...props}
    />
  );
}
function Heading1({ node, ...props }: ComponentProps<'h1'> & Extra) {
  void node;
  return <h1 dir="auto" {...props} />;
}
function Heading2({ node, ...props }: ComponentProps<'h2'> & Extra) {
  void node;
  return <h2 dir="auto" {...props} />;
}
function Heading3({ node, ...props }: ComponentProps<'h3'> & Extra) {
  void node;
  return <h3 dir="auto" {...props} />;
}
function Heading4({ node, ...props }: ComponentProps<'h4'> & Extra) {
  void node;
  return <h4 dir="auto" {...props} />;
}
function Heading5({ node, ...props }: ComponentProps<'h5'> & Extra) {
  void node;
  return <h5 dir="auto" {...props} />;
}
function Heading6({ node, ...props }: ComponentProps<'h6'> & Extra) {
  void node;
  return <h6 dir="auto" {...props} />;
}
function Quote({ node, ...props }: ComponentProps<'blockquote'> & Extra) {
  void node;
  return <blockquote dir="auto" {...props} />;
}
function Cell({ node, ...props }: ComponentProps<'td'> & Extra) {
  void node;
  return <td dir="auto" {...props} />;
}
function HeaderCell({ node, ...props }: ComponentProps<'th'> & Extra) {
  void node;
  return <th dir="auto" {...props} />;
}
function Anchor({ node, href, children }: ComponentProps<'a'> & Extra) {
  void node;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">
      {children}
    </a>
  );
}
// Inside a control (the editable preview) a link cannot be a link; it keeps its look as text.
function StaticAnchor({ node, children }: ComponentProps<'a'> & Extra) {
  void node;
  return <span className="text-accent underline">{children}</span>;
}
const components: Components = {
  a: Anchor,
  p: Paragraph,
  li: ListItem,
  input: Checkbox,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  blockquote: Quote,
  td: Cell,
  th: HeaderCell,
};
export function Markdown({
  content,
  className,
  interactive = true,
  onToggle = null,
}: {
  content: string;
  className?: string;
  interactive?: boolean;
  onToggle?: ((index: number) => void) | null;
}) {
  return (
    <div
      data-checklist=""
      className={cn(
        'grid gap-3 text-sm leading-relaxed break-words [&_a]:text-accent [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-text-muted [&_code]:rounded [&_code]:bg-surface-raised [&_code]:px-1 [&_code]:text-[0.9em] [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_hr]:border-border [&_ol]:list-decimal [&_ol]:px-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-raised [&_pre]:p-3 [&_table]:text-xs [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-start [&_ul]:list-disc [&_ul]:px-5',
        className,
      )}
    >
      <Checklist.Provider value={onToggle}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, schema]]}
          components={interactive ? components : { ...components, a: StaticAnchor }}
          skipHtml
        >
          {content}
        </ReactMarkdown>
      </Checklist.Provider>
    </div>
  );
}
