const getDayValue = (am, pm) => {
  if (am && pm) return 1;
  if (am || pm) return 0.5;
  return 0;
};

const summarizeAttendance = (records = []) => {
  return records.reduce(
    (acc, record) => {
      const value = getDayValue(record.am_attendance, record.pm_attendance);
      acc.totalDays += 1;
      acc.presentValue += value;
      if (value === 1) acc.fullDays += 1;
      if (value === 0.5) acc.halfDays += 1;
      if (value === 0) acc.absentDays += 1;
      return acc;
    },
    {
      totalDays: 0,
      presentValue: 0,
      fullDays: 0,
      halfDays: 0,
      absentDays: 0
    }
  );
};

const calculatePercentage = (summary) => {
  if (!summary.totalDays) return 0;
  return Number(((summary.presentValue / summary.totalDays) * 100).toFixed(2));
};

module.exports = {
  getDayValue,
  summarizeAttendance,
  calculatePercentage
};

