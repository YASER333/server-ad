const { Parser } = require('json2csv');
const XLSX = require('xlsx');
let PDFDocument;
try {
  // Lazy require to avoid crashing if not installed yet; instruct user to install pdfkit
  PDFDocument = require('pdfkit');
} catch (e) {
  PDFDocument = null;
}

const attendanceToCsv = (rows = []) => {
  const fields = [
    { label: 'Student Name', value: 'student_name' },
    { label: 'Roll Number', value: 'roll_number' },
    { label: 'Department', value: 'department' },
    { label: 'Program Type', value: 'program_type' },
    { label: 'Date', value: 'date' },
    { label: 'AM', value: 'am_attendance' },
    { label: 'PM', value: 'pm_attendance' },
    { label: 'Training Event', value: 'training_event' },
    { label: 'Trainer Name', value: 'trainer_name' },
    { label: 'Remarks', value: 'remarks' }
  ];
  const parser = new Parser({ fields });
  return parser.parse(rows);
};

const summaryToCsv = (rows = []) => {
  const fields = [
    { label: 'Student Name', value: 'student_name' },
    { label: 'Roll Number', value: 'roll_number' },
    { label: 'Department', value: 'department' },
    { label: 'Program Type', value: 'program_type' },
    { label: 'Full Days', value: 'fullDays' },
    { label: 'Half Days', value: 'halfDays' },
    { label: 'Absent Days', value: 'absentDays' },
    { label: 'Attendance %', value: 'percentage' }
  ];
  const parser = new Parser({ fields });
  return parser.parse(rows);
};

module.exports = {
  attendanceToCsv,
  summaryToCsv,
  // Excel helpers
  rowsToExcelBuffer: (rows = [], columns = [], sheetName = 'Report') => {
    // columns: [{ header: 'Student Name', key: 'student_name' }, ...]
    const data = [columns.map((c) => c.header)];
    for (const row of rows) {
      data.push(columns.map((c) => row[c.key]));
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  },
  // Basic PDF generators; these return Buffer
  buildDailyPdfBuffer: async ({ header = {}, rows = [] }) => {
    if (!PDFDocument) throw new Error('PDF generation requires pdfkit. Please install it: npm i pdfkit');
    return await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on('data', (d) => chunks.push(d));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      let index = 1;
      doc.fontSize(14).text('RVSCAS', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(12).text('School of Computer Science Department', { align: 'center' });
      doc.moveDown(0.5);
      if (header.company) doc.text(`Company: ${header.company}`);
      if (header.event) doc.text(`Event: ${header.event}`);
      if (header.dateRange) doc.text(`Date: ${header.dateRange}`);
      doc.moveDown(0.5);
      const totalPresent = rows.filter((r) => r.present).length;
      const totalStudents = rows.length;
      doc.text(`No. of participation: ${totalPresent}/${totalStudents}`);
      doc.moveDown(0.5);
      for (const r of rows) {
        const status = r.present ? 'present' : 'absent';
        doc.text(`${index}) ${r.student_name} (${r.roll_number}) (${r.department}) - ${status}`);
        index += 1;
      }
      doc.end();
    });
  },
  buildCompanyPdfBuffer: async ({ header = {}, rows = [] }) => {
    if (!PDFDocument) throw new Error('PDF generation requires pdfkit. Please install it: npm i pdfkit');
    return await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on('data', (d) => chunks.push(d));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(14).text('RVSCAS', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(12).text('School of Computer Science Department', { align: 'center' });
      doc.moveDown(0.5);
      if (header.company) doc.text(`Company: ${header.company}`);
      if (header.dateRange) doc.text(`Date: ${header.dateRange}`);
      doc.moveDown(0.5);

      const grouped = rows.reduce((acc, row) => {
        const company = row.company || 'Unknown Company';
        if (!acc[company]) acc[company] = [];
        acc[company].push(row);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([company, students]) => {
        doc.fontSize(12).text(`Company: ${company}`);
        doc.moveDown(0.2);
        doc.text('Student Name                  Department');
        doc.moveDown(0.2);
        students.forEach((s) => {
          doc.text(`${s.student_name}    ${s.department}`);
        });
        doc.moveDown(0.3);
        doc.text(`Total Students: ${students.length}`);
        doc.moveDown(0.6);
      });
      doc.end();
    });
  },
  buildDepartmentPdfBuffer: async ({ header = {}, rows = [] }) => {
    if (!PDFDocument) throw new Error('PDF generation requires pdfkit. Please install it: npm i pdfkit');
    return await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on('data', (d) => chunks.push(d));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(14).text('RVSCAS', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(12).text('School of Computer Science Department', { align: 'center' });
      doc.moveDown(0.5);
      doc.text('Department-wise Report');
      if (header.dateRange) doc.text(`Date: ${header.dateRange}`);
      if (header.generatedOn) doc.text(`Generated: ${header.generatedOn}`);
      doc.moveDown(0.5);

      const grouped = rows.reduce((acc, row) => {
        const dept = row.department || 'Unknown Department';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(row);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([dept, items]) => {
        doc.fontSize(12).text(`Department: ${dept}`);
        doc.moveDown(0.2);
        doc.text('Student Name                  Date         Company');
        doc.moveDown(0.2);
        items.forEach((r) => {
          doc.text(`${r.student_name}    ${r.dateStr}    ${r.training_company || ''}`);
        });
        doc.moveDown(0.3);
        doc.text(`Total Students: ${items.length}`);
        doc.moveDown(0.6);
      });
      doc.end();
    });
  },
  buildCompaniesSummaryPdfBuffer: async ({ header = {}, rows = [] }) => {
    if (!PDFDocument) throw new Error('PDF generation requires pdfkit. Please install it: npm i pdfkit');
    return await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on('data', (d) => chunks.push(d));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(14).text('RVSCAS', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(12).text('School of Computer Science Department', { align: 'center' });
      doc.moveDown(0.5);
      doc.text('Training Companies');
      if (header.dateRange) doc.text(`Period: ${header.dateRange}`);
      doc.moveDown(0.5);
      doc.text('Company Name          Date (from - to)          Total students');
      doc.moveDown(0.2);
      rows.forEach((r) => {
        doc.text(`${r.company}    ${r.from_to}    ${r.total_students}`);
      });
      doc.moveDown(1);
      const uniqueCompanies = new Set(rows.map((r) => r.company));
      doc.text(`Total company = ${uniqueCompanies.size}`);
      doc.end();
    });
  }
};

