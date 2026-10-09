function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var templateId = '17YubntTUx2Blrm-z9SljsqLAGdkxl6Z8-yBYP4KkbSg'; 
    var outputFolderId = '1tidqVbWwC7LPUoctyDcMb5K_Zo1PH2kM'; 
    
    var folder = DriveApp.getFolderById(outputFolderId);
    var projectName = data.project_name || data.company_name || 'Laporan';
    var docName = 'Comm - ' + projectName;
    
    var newFile = DriveApp.getFileById(templateId).makeCopy(docName, folder);
    var doc = DocumentApp.openById(newFile.getId());
    var body = doc.getBody();
    
    var sections = [
      { condition: data.has_clarifier, start: '{{BEGIN_SECTION_CLARIFIER}}', end: '{{END_SECTION_CLARIFIER}}' },
      { condition: data.has_dosing, start: '{{BEGIN_SECTION_DOSING}}', end: '{{END_SECTION_DOSING}}' },
      { condition: data.has_birm, start: '{{BEGIN_SECTION_BIRM}}', end: '{{END_SECTION_BIRM}}' },
      { condition: data.has_mmf, start: '{{BEGIN_SECTION_MMF}}', end: '{{END_SECTION_MMF}}' },
      { condition: data.has_acf, start: '{{BEGIN_SECTION_ACF}}', end: '{{END_SECTION_ACF}}' },
      { condition: data.has_softener, start: '{{BEGIN_SECTION_SOFTENER}}', end: '{{END_SECTION_SOFTENER}}' },
      { condition: data.has_uf, start: '{{BEGIN_SECTION_UF}}', end: '{{END_SECTION_UF}}' },
      { condition: data.has_ro, start: '{{BEGIN_SECTION_RO}}', end: '{{END_SECTION_RO}}' },
      { condition: data.is_ro_large, start: '{{BEGIN_SECTION_RO_LARGE}}', end: '{{END_SECTION_RO_LARGE}}' },
      { condition: data.has_recycle, start: '{{BEGIN_SECTION_RECYCLE}}', end: '{{END_SECTION_RECYCLE}}' },
      { condition: data.has_mixedbed, start: '{{BEGIN_SECTION_MIXEDBED}}', end: '{{END_SECTION_MIXEDBED}}' }
    ];

    for (var i = 0; i < sections.length; i++) {
      if (sections[i].condition) {
        body.replaceText(sections[i].start, '');
        body.replaceText(sections[i].end, '');
      } else {
        deleteSection(body, sections[i].start, sections[i].end);
      }
    }
    
    var variables = [
      ['{{SYSTEM_TITLE}}', data.system_title || 'WATER TREATMENT PLANT'],
      ['{{COMPANY_NAME}}', data.company_name],
      ['{{PO_NUMBER}}', data.po_number],
      ['{{LOCATION}}', data.location],
      ['{{ALAMAT}}', data.alamat || ''],
      ['{{OWNER_COMPANY}}', data.owner_company],
      ['{{OWNER_NAME}}', data.owner_name],
      ['{{CONTRACTOR_NAME}}', data.contractor_name],
      ['{{CHECKLIST_ITEMS}}', data.checklist_items],
      
      ['{{TAG_PI_SOFT_IN}}', data.tag_pi_soft_in || '........'], ['{{TAG_PI_SOFT_OUT}}', data.tag_pi_soft_out || '........'],
      ['{{TAG_PS_UF_FEED}}', data.tag_ps_uf_feed || '........'], ['{{TAG_PS_UF_BW}}', data.tag_ps_uf_bw || '........'],
      ['{{TAG_PI_UF_IN}}', data.tag_pi_uf_in || '........'], ['{{TAG_PI_UF_OUT}}', data.tag_pi_uf_out || '........'], ['{{TAG_FI_UF}}', data.tag_fi_uf || '........'],
      
      ['{{TAG_PI_01}}', data.tag_pi_01 || '........'], ['{{TAG_PI_02}}', data.tag_pi_02 || '........'],
      ['{{TAG_PI_03}}', data.tag_pi_03 || '........'], ['{{TAG_PI_04}}', data.tag_pi_04 || '........'],
      ['{{TAG_PI_05}}', data.tag_pi_05 || '........'], ['{{TAG_PI_06}}', data.tag_pi_06 || '........'],
      ['{{TAG_FI_01}}', data.tag_fi_01 || '........'], ['{{TAG_FI_02}}', data.tag_fi_02 || '........'], ['{{TAG_FI_03}}', data.tag_fi_03 || '........']
    ];
    
    for (var i = 0; i < variables.length; i++) {
      var val = variables[i][1] ? variables[i][1] : '........';
      body.replaceText(variables[i][0], val);
    }
    
    doc.saveAndClose();
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', documentUrl: newFile.getUrl(), fileName: newFile.getName() })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

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
