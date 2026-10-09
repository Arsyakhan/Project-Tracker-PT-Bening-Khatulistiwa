function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var templateId = '1EkVlnf3xQZT4vvXc8SF_W9hWz8QXfwWqgYETn4rcwf0'; 
    var outputFolderId = '1jdQ0D_SJ7FvOLzhUGdNh0U3DzrA1DSrv'; 
    
    var folder = DriveApp.getFolderById(outputFolderId);
    var projectName = data.project_name || 'Laporan';
    var docName = 'HO - ' + projectName;
    
    var newFile = DriveApp.getFileById(templateId).makeCopy(docName, folder);
    var doc = DocumentApp.openById(newFile.getId());
    var body = doc.getBody();
    
    var sections = [
      { condition: data.has_raw_water, start: '{{BEGIN_SECTION_RAW_WATER}}', end: '{{END_SECTION_RAW_WATER}}' },
      { condition: data.has_clarifier, start: '{{BEGIN_SECTION_CLARIFIER}}', end: '{{END_SECTION_CLARIFIER}}' },
      { condition: data.has_filter_1, start: '{{BEGIN_SECTION_FILTER_1}}', end: '{{END_SECTION_FILTER_1}}' },
      { condition: data.has_filter_2, start: '{{BEGIN_SECTION_FILTER_2}}', end: '{{END_SECTION_FILTER_2}}' },
      { condition: data.has_uf, start: '{{BEGIN_SECTION_UF}}', end: '{{END_SECTION_UF}}' },
      { condition: data.has_int_tank, start: '{{BEGIN_SECTION_INT_TANK}}', end: '{{END_SECTION_INT_TANK}}' },
      { condition: data.has_softener, start: '{{BEGIN_SECTION_SOFTENER}}', end: '{{END_SECTION_SOFTENER}}' },
      { condition: data.has_ro, start: '{{BEGIN_SECTION_RO}}', end: '{{END_SECTION_RO}}' },
      { condition: data.has_cip, start: '{{BEGIN_SECTION_CIP_DOSING}}', end: '{{END_SECTION_CIP_DOSING}}' },
      { condition: data.has_panel, start: '{{BEGIN_SECTION_PANEL}}', end: '{{END_SECTION_PANEL}}' }
    ];

    for (var i = 0; i < sections.length; i++) {
      if (sections[i].condition) {
        body.replaceText(sections[i].start, '');
        body.replaceText(sections[i].end, '');
      } else {
        deleteSection(body, sections[i].start, sections[i].end);
      }
    }

    // ====== FIELD BIASA (bukan Additional Items) ======
    var variables = [
      ['{{SYSTEM_TITLE}}', data.system_title], ['{{CONTRACTOR_NAME}}', data.contractor_name],
      ['{{BUYER_COMPANY}}', data.buyer_company], ['{{PROJECT_NAME}}', data.project_name],
      ['{{PO_NUMBER}}', data.po_number], ['{{LOCATION}}', data.location],

      ['{{RW_TANK_MAT}}', data.rw_tank_mat], ['{{RW_TANK_CAP}}', data.rw_tank_cap], ['{{RW_TANK_UNIT}}', data.rw_tank_unit], ['{{RW_TANK_QTY}}', data.rw_tank_qty],
      ['{{RW_PUMP_BRAND}}', data.rw_pump_brand], ['{{RW_PUMP_MODEL}}', data.rw_pump_model], ['{{RW_PUMP_CAP}}', data.rw_pump_cap], ['{{RW_PUMP_KW}}', data.rw_pump_kw], ['{{RW_PUMP_QTY}}', data.rw_pump_qty],

      ['{{CLARIFIER_CAP}}', data.clarifier_cap], ['{{CLARIFIER_UNIT}}', data.clarifier_unit], ['{{CLARIFIER_MAT}}', data.clarifier_mat],

      ['{{F1_TYPE}}', data.f1_type], ['{{F1_CAP}}', data.f1_cap], ['{{F1_UNIT}}', data.f1_unit], ['{{F1_TANK_SIZE}}', data.f1_tank_size], ['{{F1_MEDIA_VOL}}', data.f1_media_vol], ['{{F1_MEDIA_UNIT}}', data.f1_media_unit], ['{{F1_MEDIA_TYPE}}', data.f1_media_type], ['{{F1_VALVE}}', data.f1_valve], ['{{F1_QTY}}', data.f1_qty],
      ['{{F2_TYPE}}', data.f2_type], ['{{F2_CAP}}', data.f2_cap], ['{{F2_UNIT}}', data.f2_unit], ['{{F2_TANK_SIZE}}', data.f2_tank_size], ['{{F2_MEDIA_VOL}}', data.f2_media_vol], ['{{F2_MEDIA_UNIT}}', data.f2_media_unit], ['{{F2_MEDIA_TYPE}}', data.f2_media_type], ['{{F2_VALVE}}', data.f2_valve], ['{{F2_QTY}}', data.f2_qty],

      ['{{UF_MODEL}}', data.uf_model], ['{{UF_CAP}}', data.uf_cap], ['{{UF_UNIT}}', data.uf_unit],
      ['{{UF_FWP_BRAND}}', data.uf_fwp_brand], ['{{UF_FWP_MODEL}}', data.uf_fwp_model], ['{{UF_FWP_CAP}}', data.uf_fwp_cap], ['{{UF_FWP_KW}}', data.uf_fwp_kw], ['{{UF_FWP_QTY}}', data.uf_fwp_qty],
      ['{{UF_BWP_BRAND}}', data.uf_bwp_brand], ['{{UF_BWP_MODEL}}', data.uf_bwp_model], ['{{UF_BWP_CAP}}', data.uf_bwp_cap], ['{{UF_BWP_KW}}', data.uf_bwp_kw], ['{{UF_BWP_QTY}}', data.uf_bwp_qty],
      ['{{UF_BLOWER_BRAND}}', data.uf_blower_brand], ['{{UF_BLOWER_MODEL}}', data.uf_blower_model], ['{{UF_BLOWER_KW}}', data.uf_blower_kw], ['{{UF_BLOWER_QTY}}', data.uf_blower_qty],
      ['{{UF_MEM_BRAND}}', data.uf_mem_brand], ['{{UF_MEM_MODEL}}', data.uf_mem_model], ['{{UF_MEM_QTY}}', data.uf_mem_qty],
      ['{{UF_SV_QTY}}', data.uf_sv_qty], ['{{UF_PS_QTY}}', data.uf_ps_qty], ['{{UF_FM_QTY}}', data.uf_fm_qty], ['{{UF_PG_QTY}}', data.uf_pg_qty],
      ['{{UF_CIP_TANK_MAT}}', data.uf_cip_tank_mat], ['{{UF_CIP_TANK_CAP}}', data.uf_cip_tank_cap], ['{{UF_CIP_TANK_UNIT}}', data.uf_cip_tank_unit],

      ['{{INT_TANK_CAP}}', data.int_tank_cap], ['{{INT_TANK_UNIT}}', data.int_tank_unit], ['{{INT_TANK_MAT}}', data.int_tank_mat],
      ['{{SOFT_MODEL}}', data.soft_model], ['{{SOFT_CAP}}', data.soft_cap], ['{{SOFT_UNIT}}', data.soft_unit], ['{{SOFT_TANK_SIZE}}', data.soft_tank_size], ['{{SOFT_CONTROLLER}}', data.soft_controller], ['{{SOFT_RESIN_VOL}}', data.soft_resin_vol], ['{{SOFT_RESIN_UNIT}}', data.soft_resin_unit], ['{{SOFT_BRINE_CAP}}', data.soft_brine_cap], ['{{SOFT_BRINE_UNIT}}', data.soft_brine_unit],

      ['{{RO_MODEL}}', data.ro_model], ['{{RO_CAP}}', data.ro_cap], ['{{RO_UNIT}}', data.ro_unit],
      ['{{RO_FWP_BRAND}}', data.ro_fwp_brand], ['{{RO_FWP_MODEL}}', data.ro_fwp_model], ['{{RO_FWP_CAP}}', data.ro_fwp_cap], ['{{RO_FWP_KW}}', data.ro_fwp_kw], ['{{RO_FWP_QTY}}', data.ro_fwp_qty],
      ['{{RO_BP_BRAND}}', data.ro_bp_brand], ['{{RO_BP_MODEL}}', data.ro_bp_model], ['{{RO_BP_KW}}', data.ro_bp_kw], ['{{RO_BP_QTY}}', data.ro_bp_qty],
      ['{{RO_MEM_BRAND}}', data.ro_mem_brand], ['{{RO_MEM_MODEL}}', data.ro_mem_model], ['{{RO_MEM_QTY}}', data.ro_mem_qty],
      ['{{RO_VESSEL_BRAND}}', data.ro_vessel_brand], ['{{RO_VESSEL_MODEL}}', data.ro_vessel_model], ['{{RO_VESSEL_QTY}}', data.ro_vessel_qty],
      ['{{RO_CFH_MAT}}', data.ro_cfh_mat], ['{{RO_CFH_MODEL}}', data.ro_cfh_model], ['{{RO_CFH_QTY}}', data.ro_cfh_qty],
      ['{{RO_CF_SIZE}}', data.ro_cf_size], ['{{RO_CF_QTY}}', data.ro_cf_qty],
      ['{{RO_FM_PROD_MODEL}}', data.ro_fm_prod_model], ['{{RO_FM_PROD_QTY}}', data.ro_fm_prod_qty],
      ['{{RO_FM_REJ_MODEL}}', data.ro_fm_rej_model], ['{{RO_FM_REJ_QTY}}', data.ro_fm_rej_qty],
      ['{{RO_COND_MODEL}}', data.ro_cond_model], ['{{RO_COND_QTY}}', data.ro_cond_qty],

      ['{{AS_TANK_MAT}}', data.as_tank_mat], ['{{AS_TANK_CAP}}', data.as_tank_cap], ['{{AS_TANK_QTY}}', data.as_tank_qty],
      ['{{AS_PUMP_BRAND}}', data.as_pump_brand], ['{{AS_PUMP_MODEL}}', data.as_pump_model], ['{{AS_PUMP_CAP}}', data.as_pump_cap], ['{{AS_PUMP_QTY}}', data.as_pump_qty],

      ['{{CIP_PUMP_BRAND}}', data.ro_cip_pump_brand], ['{{CIP_PUMP_MODEL}}', data.ro_cip_pump_model], ['{{CIP_PUMP_KW}}', data.ro_cip_pump_kw], ['{{CIP_PUMP_QTY}}', data.ro_cip_pump_qty],
      ['{{CIP_TANK_MAT}}', data.ro_cip_tank_mat], ['{{CIP_TANK_CAP}}', data.ro_cip_tank_cap], ['{{CIP_TANK_QTY}}', data.ro_cip_tank_qty],

      ['{{STD_CIP_PUMP_BRAND}}', data.std_cip_pump_brand], ['{{STD_CIP_PUMP_MODEL}}', data.std_cip_pump_model], ['{{STD_CIP_PUMP_CAP}}', data.std_cip_pump_cap], ['{{STD_CIP_PUMP_QTY}}', data.std_cip_pump_qty],
      ['{{STD_CIP_TANK_MAT}}', data.std_cip_tank_mat], ['{{STD_CIP_TANK_CAP}}', data.std_cip_tank_cap], ['{{STD_CIP_TANK_UNIT}}', data.std_cip_tank_unit], ['{{STD_CIP_TANK_QTY}}', data.std_cip_tank_qty],

      ['{{PANEL_SIZE}}', data.panel_size]
    ];

    for (var i = 0; i < variables.length; i++) {
      var key = variables[i][0];
      var val = variables[i][1];
      if (val === undefined || val === null || val === '') val = '.......';
      body.replaceText(key, val);
    }

    // ====== FIELD "ADDITIONAL ITEMS" (diproses terpisah: hapus baris kalau kosong) ======
    var additionalItems = [
      ['{{RW_ADDITIONAL_ITEMS}}', data.rw_additional_items],
      ['{{CLARIFIER_ADDITIONAL_ITEMS}}', data.clarifier_additional_items],
      ['{{F1_ADDITIONAL_ITEMS}}', data.f1_additional_items],
      ['{{F2_ADDITIONAL_ITEMS}}', data.f2_additional_items],
      ['{{UF_ADDITIONAL_ITEMS}}', data.uf_additional_items],
      ['{{INT_ADDITIONAL_ITEMS}}', data.int_additional_items],
      ['{{SOFT_ADDITIONAL_ITEMS}}', data.soft_additional_items],
      ['{{RO_ADDITIONAL_ITEMS}}', data.ro_additional_items],
      ['{{AS_ADDITIONAL_ITEMS}}', data.as_additional_items],
      ['{{CIP_ADDITIONAL_ITEMS}}', data.ro_cip_additional_items],
      ['{{STD_CIP_ADDITIONAL_ITEMS}}', data.std_cip_additional_items],
      ['{{PANEL_ADDITIONAL_ITEMS}}', data.panel_additional_items]
    ];

    for (var j = 0; j < additionalItems.length; j++) {
      replaceOrRemoveLine(body, additionalItems[j][0], additionalItems[j][1]);
    }
    
    doc.saveAndClose();
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', documentUrl: newFile.getUrl(), fileName: newFile.getName() })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// Hapus modul besar (section) jika checkbox tidak dicentang
function deleteSection(body, startTag, endTag) {
  var start = body.findText(startTag), end = body.findText(endTag);
  if (start && end) {
    var startIndex = body.getChildIndex(start.getElement().getParent());
    var endIndex = body.getChildIndex(end.getElement().getParent());
    if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
      for (var i = endIndex; i >= startIndex; i--) body.removeChild(body.getChild(i));
    }
  }
}

// BARU: kalau isi ada -> format jadi sub-bullet rapi
// kalau kosong -> HAPUS SELURUH BARIS placeholder-nya (bukan cuma teksnya)
function replaceOrRemoveLine(body, key, val) {
  var found = body.findText(key);
  if (!found) return; // placeholder sudah hilang (mis. section-nya sudah dihapus duluan)

  if (val === undefined || val === null || val === '') {
    var element = found.getElement().getParent();
    var index = body.getChildIndex(element);
    if (index !== -1) body.removeChild(element);
  } else {
    var formatted = '   * ' + String(val).replace(/\n/g, '\n   * ');
    body.replaceText(key, formatted);
  }
}
