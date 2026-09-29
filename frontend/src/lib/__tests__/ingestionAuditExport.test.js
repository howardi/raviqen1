import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditWorkbook } from "../ingestionAuditExport.js";

test("audit workbook is a genuine XLSX ZIP with exact numeric amount and currency text", async () => {
  const data = await buildAuditWorkbook([{timestamp:"2026-09-28T10:00:00Z",document_id:"id-1",source_reference:"INV-100",entity_name:"Sample Ltd",sector:"Hospitality",validated_amount:30153118.25,currency_iso:"NGN",formatted_amount:"₦30,153,118.25",risk_score:72,risk_level:"high",verdict_summary:"Evidence only",status:"PENDING_REVIEW",source_filename:"test.csv",batch_id:"batch-1"}]).arrayBuffer();
  const bytes = new Uint8Array(data);
  assert.equal(new DataView(data).getUint32(0, true), 0x04034b50);
  const utf8 = new TextDecoder().decode(bytes);
  assert.match(utf8, /<c r="F2"><v>30153118\.25<\/v><\/c>/);
  assert.match(utf8, /₦30,153,118\.25/);
  assert.match(utf8, /INV-100/);
  assert.equal(new DataView(data).getUint32(bytes.length - 22, true), 0x06054b50);
});