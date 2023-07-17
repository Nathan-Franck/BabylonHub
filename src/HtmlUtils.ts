
// skmple div generator function that takes style args aand returns a div
export function newElement<T extends keyof HTMLElementTagNameMap>(
  elemType: T,
  parent: HTMLElement,
  params: Omit<Partial<HTMLElementTagNameMap[T]>, "style"> & {
    style: Partial<CSSStyleDeclaration>
  }
) {
  const div = document.createElement(elemType);
  Object.assign(div, params);
  Object.assign(div.style, params.style);
  parent.appendChild(div);
  return div;
}
