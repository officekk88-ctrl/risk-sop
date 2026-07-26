import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CONSULTATION_ATTACHMENTS, prepareConsultationAttachments } from "../src/lib/consultation-attachments";

test("咨询附件会解析 UTF-8 文本并保留文件名", async () => {
  const file = new File(["消防通道不得堆放杂物。"], "现场记录.txt", { type: "text/plain" });
  const result = await prepareConsultationAttachments([file]);

  assert.deepEqual(result.names, ["现场记录.txt"]);
  assert.match(result.textContext, /消防通道不得堆放杂物/);
  assert.equal(result.images.length, 0);
});

test("咨询附件会把有效 PNG 作为视觉输入", async () => {
  const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const file = new File([pngHeader], "粘贴图片.png", { type: "image/png" });
  const result = await prepareConsultationAttachments([file]);

  assert.equal(result.images.length, 1);
  assert.match(result.images[0].image_url, /^data:image\/png;base64,/);
});

test("咨询附件拒绝伪造扩展名和超出数量限制", async () => {
  const spoofed = new File(["not a pdf"], "伪造材料.pdf", { type: "application/pdf" });
  await assert.rejects(() => prepareConsultationAttachments([spoofed]), /内容与扩展名不一致/);

  const files = Array.from({ length: MAX_CONSULTATION_ATTACHMENTS + 1 }, (_, index) => new File(["ok"], `${index}.txt`, { type: "text/plain" }));
  await assert.rejects(() => prepareConsultationAttachments(files), /最多添加/);
});
