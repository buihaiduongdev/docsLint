import { readFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export function richDocx() {
  const files = unzipSync(
    new Uint8Array(readFileSync("public/sample-report.docx")),
  );
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const r =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const p = (text: string, props = "", run = "") =>
    `<w:p><w:pPr>${props}</w:pPr><w:r><w:rPr>${run}</w:rPr><w:t>${text}</w:t></w:r></w:p>`;
  const duplicate = p("Đoạn trùng nhau.", '<w:jc w:val="left"/>');
  files["word/document.xml"] =
    strToU8(`<w:document xmlns:w="${w}" xmlns:r="${r}"
    xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
    xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
    ${p("Báo cáo có định dạng", '<w:pStyle w:val="Heading1"/>')}
    ${p("Chữ có định dạng", '<w:jc w:val="center"/>', '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="32"/><w:b/><w:i/><w:u w:val="single"/><w:color w:val="C03040"/>')}
    ${duplicate}
    <w:tbl><w:tblPr><w:tblW w:w="7000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:color="000000"/><w:insideV w:val="single" w:sz="8" w:color="000000"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3500"/><w:gridCol w:w="3500"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/><w:shd w:fill="E6EFDA"/></w:tcPr>${p("Ô thứ nhất")}</w:tc><w:tc>${duplicate}</w:tc></w:tr></w:tbl>
    ${duplicate}
    <w:p><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Hình mẫu"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Hình mẫu"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
    ${p("Mục thứ nhất", '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}
    ${p("Mục thứ hai", '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}
    <w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1134" w:bottom="1440" w:left="1701" w:header="720"/></w:sectPr>
    </w:body></w:document>`);
  files["word/header1.xml"] = strToU8(
    `<w:hdr xmlns:w="${w}">${p("Đầu trang báo cáo")}</w:hdr>`,
  );
  files["word/media/image.png"] = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  files["word/_rels/document.xml.rels"] = strToU8(
    strFromU8(files["word/_rels/document.xml.rels"]).replace(
      "</Relationships>",
      `<Relationship Id="rIdImage" Type="${r}/image" Target="media/image.png"/><Relationship Id="rIdHeader" Type="${r}/header" Target="header1.xml"/></Relationships>`,
    ),
  );
  files["[Content_Types].xml"] = strToU8(
    strFromU8(files["[Content_Types].xml"]).replace(
      "</Types>",
      '<Default Extension="png" ContentType="image/png"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>',
    ),
  );
  files["word/numbering.xml"] = strToU8(
    strFromU8(files["word/numbering.xml"])
      .replace('w:val="bullet"', 'w:val="decimal"')
      .replace('w:val="•"', 'w:val="%1."'),
  );
  return zipSync(files);
}
