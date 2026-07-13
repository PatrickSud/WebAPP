/**
 * Calculates the ISO week number and ID for a given date.
 * ISO week number starts on Monday, and week 1 is the week containing the first Thursday of the year.
 */
export function getISOWeekDetails(date: Date = new Date()) {
  const target = new Date(date.valueOf());
  
  // ISO day of the week: Monday is 0, Sunday is 6
  const dayNr = (date.getDay() + 6) % 7;
  
  // Set to nearest Thursday: current date + 3 - dayNr
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  
  // Set to Jan 1st of the same year as the nearest Thursday
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = target.getFullYear();
  const weekId = `${year}-${String(weekNumber).padStart(2, '0')}`;
  
  return {
    weekId,
    weekNumber,
    year
  };
}

/**
 * Checks if a given weekId matches the current ISO week.
 */
export function isCurrentWeek(weekId: string): boolean {
  return getISOWeekDetails().weekId === weekId;
}

interface NotificationItem {
  id: string;
  scheduledFor: number;
  sent: boolean;
  type: 'absence_follow_up' | 'people_follow_up';
  message?: string;
}

/**
 * Generates the weekly notification schedule for an absent person.
 * - Notification 1: Day +2 at 10:00 AM
 * - Notification 2: Day +4 at 10:00 AM
 * - Notification 3: Next Saturday at 14:00 PM
 */
export function getNotificationSchedules(baseDate: Date, personName: string): NotificationItem[] {
  // Notification 1: baseDate + 2 days, at 10:00
  const n1 = new Date(baseDate);
  n1.setDate(n1.getDate() + 2);
  n1.setHours(10, 0, 0, 0);

  // Notification 2: baseDate + 4 days, at 10:00
  const n2 = new Date(baseDate);
  n2.setDate(n2.getDate() + 4);
  n2.setHours(10, 0, 0, 0);

  // Notification 3: Next Saturday at 14:00
  const n3 = new Date(baseDate);
  const daysToSaturday = (6 - baseDate.getDay() + 7) % 7;
  n3.setDate(n3.getDate() + daysToSaturday);
  n3.setHours(14, 0, 0, 0);
  
  // If it's already Saturday and 14:00 has passed, schedule for next Saturday
  if (n3.getTime() <= baseDate.getTime()) {
    n3.setDate(n3.getDate() + 7);
  }

  const generateId = (suffix: string) => 
    `${suffix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return [
    {
      id: generateId('n1'),
      scheduledFor: n1.getTime(),
      sent: false,
      type: 'absence_follow_up',
      message: `Olá! Como está indo o contato com ${personName}? Lembre-se de mandar uma mensagem para saber se está tudo bem.`
    },
    {
      id: generateId('n2'),
      scheduledFor: n2.getTime(),
      sent: false,
      type: 'absence_follow_up',
      message: `Passando para lembrar da ministração. Já conseguiu falar com ${personName}? Confirme no app!`
    },
    {
      id: generateId('n3'),
      scheduledFor: n3.getTime(),
      sent: false,
      type: 'absence_follow_up',
      message: `Amanhã temos aula! Não se esqueça de registrar se o contato com ${personName} foi realizado.`
    }
  ];
}
