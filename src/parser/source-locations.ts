export const WORD_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Same source order for lint diagnostics and the visual DOCX preview. */
export function mainParagraphs(body: Element): Element[] {
  return Array.from(body.getElementsByTagNameNS(WORD_NS, "p")).filter((p) => {
    for (
      let parent: Element | null = p;
      parent && parent !== body;
      parent = parent.parentElement
    ) {
      if (
        parent.namespaceURI === WORD_NS &&
        ["del", "moveFrom", "txbxContent"].includes(parent.localName)
      )
        return false;
    }
    return true;
  });
}
