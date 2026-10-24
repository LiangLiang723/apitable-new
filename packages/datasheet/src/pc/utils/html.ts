import DOMPurify from 'dompurify';

/**
 * Converts an html snippet into plain text.
 *
 * DOMPurify removes the markup, and reading `textContent` from a detached
 * template guarantees that no tag fragment can survive: a single regular
 * expression based strip leaves input such as `<<script>x</script>` with a
 * `<` in place, which is exactly the case a sanitizer has to cover.
 */
export const htmlToPlainText = (html: string): string => {
  if (!html) {
    return '';
  }
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(html);
  return template.content.textContent || '';
};
