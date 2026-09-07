export function Component() {
  const t = useTranslations('common');
  const mode = 'hello';
  return [t('hello', { name: 'x' }), t('missing'), t(`${mode}Title`), t(mode)];
}
