import { zipSync, strToU8 } from "fflate";
import { mkdirSync, writeFileSync } from "node:fs";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const p = (text, style = "", run = "") =>
  `<w:p><w:pPr>${style}</w:pPr><w:r><w:rPr>${run}</w:rPr><w:t>${escape(text)}</w:t></w:r></w:p>`;
const h = (text, level) => p(text, `<w:pStyle w:val="Heading${level}"/>`);
const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body>
${h("1. Tổng quan nghiên cứu", 1)}
${p("Sự phát triển của công nghệ số đang thay đổi cách sinh viên tiếp cận và trình bày thông tin. Báo cáo này khảo sát thói quen sử dụng tài liệu số trong hoạt động học tập tại trường đại học.")}
${p("Mục tiêu của nghiên cứu là xây dựng một quy trình kiểm tra tài liệu dễ tiếp cận, giúp người viết chủ động rà soát báo cáo trước khi nộp.", "", '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="24"/>')}
${h("1.1.1. Phạm vi nghiên cứu", 3)}
${p("Nghiên cứu tập trung vào các báo cáo học phần của sinh viên năm thứ ba. Dữ liệu được thu thập thông qua khảo sát và đối chiếu với hướng dẫn trình bày của khoa.", '<w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/>')}
${h("2. Phương pháp thực hiện", 1)}
${p("Nhóm nghiên cứu kết hợp khảo sát trực tuyến với phân tích mẫu tài liệu. Các tiêu chí được lựa chọn gồm cấu trúc tiêu đề, font chữ, cỡ chữ, căn lề và giãn dòng.")}
${p("Thu thập các mẫu báo cáo đã được đồng ý chia sẻ.", '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}
${p("Đối chiếu từng mẫu với bộ tiêu chí thống nhất.", '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}
${h("3. Kết quả và thảo luận", 1)}
${p("Kết quả ban đầu cho thấy các lỗi định dạng thường xuất hiện ở những đoạn được sao chép từ nhiều nguồn. Một bộ quy tắc dùng chung có thể giúp việc rà soát trở nên nhất quán hơn.")}
${h("4. Kết luận", 1)}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1134" w:bottom="1440" w:left="1701"/></w:sectPr>
</w:body></w:document>`;
const styles = `<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:jc w:val="both"/><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
${[1, 2, 3].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="${level - 1}"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/><w:sz w:val="${level === 1 ? 32 : 28}"/></w:rPr></w:style>`).join("")}
</w:styles>`;
const files = {
  "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
  "_rels/.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  "word/document.xml": doc,
  "word/styles.xml": styles,
  "word/numbering.xml": `<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
  "word/_rels/document.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
};
mkdirSync("public", { recursive: true });
writeFileSync(
  "public/sample-report.docx",
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, strToU8(content)]),
    ),
  ),
);
console.log("Created public/sample-report.docx");
