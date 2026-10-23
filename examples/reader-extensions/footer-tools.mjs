export function heading(title) {
  const element = globalThis.document.createElement('h2');
  element.textContent = title;
  return element;
}
